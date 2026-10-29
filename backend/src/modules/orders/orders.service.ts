import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { buildPaymentUrl, frontendUrl, parseTxnRef, txnRefOf, verifyResult, vnpayLive, type IpnCode, type VnpayResult } from '../../integrations/vnpay/vnpay';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { Paginated } from '../../common/utils/pagination';
import { notify, postMessage } from '../chat/chat-messages';
import { onOrderCancelled, onOrderDeposited } from '../weddings/timeline-hooks';
import { OrderJobsService } from './order-jobs.service';
import { completeOrder } from './order-lifecycle';
import { ORDER_INCLUDE, OrderRow, toOrderDto, ymd } from './order-mapping';
import {
  CANCEL_LABEL,
  CategoryOrder,
  CANCEL_REASONS,
  CHANGE_LABEL,
  CHANGE_TYPES,
  CancelReason,
  ChangeType,
  ContentInput,
  HOUR,
  ORDER_STATUSES,
  ParsedContent,
  UUID,
  categoryTakenMessage,
  changeTypesBetween,
  depositedConflict,
  depositOf,
  endOfDayVn,
  fail,
  money,
  orderedUuid,
  parseContent,
  paymentMode,
  sameContent,
  wantsSend,
  startOfDayVn,
  todayVn,
  ymdVn,
} from './order-rules';

export interface ListQuery {
  conversationId?: string;
  q?: string;
  status?: string;
  from?: string;
  to?: string;
  depositFrom?: string;
  depositTo?: string;
  page?: number;
  pageSize?: number;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: OrderJobsService,
  ) {}

  // ================= Tiện ích =================

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true, category_id: true, business_name: true } });
    return v ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  private async conversationOf(o: Pick<OrderRow, 'weddings' | 'vendor_profiles'>) {
    const c = await this.prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: o.weddings!.user_id!, vendor_id: o.vendor_profiles!.user_id! } }, select: { id: true } });
    return c?.id ?? '';
  }

  private loadFull(id: string) {
    return this.prisma.orders.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
  }

  private async dtoOf(id: string) {
    const o = await this.loadFull(id);
    return toOrderDto(o, await this.conversationOf(o));
  }

  /** Đơn của NCC; quét hết hạn / tự hoàn thành riêng đơn của NCC này trước khi đọc. */
  private async ownedByVendor(userId: string, id: string) {
    const vendor = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: vendor.id });
    const o = UUID.test(id) ? await this.prisma.orders.findFirst({ where: { id, vendor_id: vendor.id }, include: ORDER_INCLUDE }) : null;
    return { vendor, order: o ?? fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404) };
  }

  /** Đơn của khách (không có bản nháp); quét riêng đơn của khách này trước khi đọc. */
  private async ownedByCouple(userId: string, id: string) {
    await this.jobs.sweep({ coupleId: userId });
    const o = UUID.test(id) ? await this.prisma.orders.findFirst({ where: { id, weddings: { user_id: userId }, status: { not: 'Draft' } }, include: ORDER_INCLUDE }) : null;
    return o ?? fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  }

  /**
   * Luật "mỗi hạng mục tối đa MỘT đơn Deposited cùng lúc" (một đám cưới): trả đơn Deposited khác cùng hạng mục, hoặc null.
   * Dùng khi khách đặt cọc và khi NCC gửi / tạo lại đơn.
   */
  private async depositedElsewhere(weddingId: string | null, categoryId: string | null, exceptOrderId?: string): Promise<CategoryOrder | null> {
    if (!weddingId || !categoryId) return null;
    const rows = await this.prisma.orders.findMany({
      where: { wedding_id: weddingId, status: 'Deposited' },
      select: { id: true, status: true, order_code: true, vendor_profiles: { select: { business_name: true, category_id: true, service_categories: { select: { name: true } } } } },
    });
    const orders: CategoryOrder[] = rows.map((r) => ({
      id: r.id,
      status: r.status,
      categoryId: r.vendor_profiles?.category_id ?? null,
      code: r.order_code ?? '',
      vendorName: r.vendor_profiles?.business_name ?? '',
      categoryName: r.vendor_profiles?.service_categories?.name ?? '',
    }));
    return depositedConflict(orders, categoryId, exceptOrderId) ?? null;
  }

  /** Mã tiếp theo trong tháng: DH<yyMM><4 số> (đơn), XNC… (giấy xác nhận cọc), HD… (hóa đơn cuối). */
  private async nextCode(prefix: 'DH' | 'XNC' | 'HD') {
    const yymm = new Date(Date.now() + 7 * HOUR).toISOString().slice(2, 7).replace('-', '');
    const start = `${prefix}${yymm}`;
    const last =
      prefix === 'DH'
        ? (await this.prisma.orders.findFirst({ where: { order_code: { startsWith: start } }, orderBy: { order_code: 'desc' }, select: { order_code: true } }))?.order_code
        : (await this.prisma.invoices.findFirst({ where: { invoice_code: { startsWith: start } }, orderBy: { invoice_code: 'desc' }, select: { invoice_code: true } }))?.invoice_code;
    const n = last ? Number(last.slice(start.length)) : 0;
    return `${start}${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, '0')}`;
  }

  /** Nội dung hiện tại của đơn, cùng dạng với nội dung đã kiểm tra (để so sánh thay đổi). */
  private currentOf(o: OrderRow): ParsedContent {
    return {
      customerName: o.customer_name ?? '',
      customerPhone: o.customer_phone ?? '',
      eventDate: ymd(o.event_date),
      note: o.note,
      depositPercent: Number(o.deposit_percent),
      items: o.order_items.map((i) => ({ itemName: i.item_name ?? '', unit: i.unit ?? '', quantity: i.quantity ?? 0, unitPrice: Number(i.unit_price) })),
      total: Number(o.total_amount),
    };
  }

  /** Cột của đơn từ nội dung đã kiểm tra. Bản nháp mà tiền cọc không nhỏ hơn tổng thì lưu cọc 0 (CSDL chỉ cho Draft cọc 0). */
  private orderData(p: ParsedContent) {
    const deposit = depositOf(p.total, p.depositPercent);
    return {
      customer_name: p.customerName,
      customer_phone: p.customerPhone,
      event_date: new Date(p.eventDate),
      note: p.note,
      total_amount: p.total,
      deposit_percent: p.depositPercent,
      deposit_amount: deposit > 0 && deposit < p.total ? deposit : 0,
    };
  }

  private itemRows(orderId: string, p: ParsedContent) {
    return p.items.map((l, i) => ({ id: orderedUuid(i), order_id: orderId, item_name: l.itemName, unit: l.unit, quantity: l.quantity, unit_price: l.unitPrice, amount: l.quantity * l.unitPrice }));
  }

  // ================= Phía cặp đôi =================

  async getForCouple(userId: string, id: string) {
    const o = await this.ownedByCouple(userId, id);
    return toOrderDto(o, await this.conversationOf(o));
  }

  /** Mọi đơn đã gửi của khách (không có bản nháp), mới nhất trước; trang Kế hoạch của khách hiện dưới từng hạng mục theo `category`. */
  async listForCouple(userId: string, q: { status?: string }) {
    await this.jobs.sweep({ coupleId: userId });
    const where: Prisma.ordersWhereInput = { weddings: { user_id: userId }, status: { not: 'Draft' } };
    if (q.status) {
      if (!(ORDER_STATUSES as readonly string[]).includes(q.status) || q.status === 'Draft') return fail('VALIDATION_ERROR', 'Trạng thái đơn không hợp lệ.', 400, { status: 'Trạng thái đơn không hợp lệ.' });
      where.status = q.status;
    }
    const [rows, convs] = await Promise.all([
      this.prisma.orders.findMany({ where, include: ORDER_INCLUDE, orderBy: [{ created_date: 'desc' }, { order_code: 'desc' }], take: 200 }),
      this.prisma.conversations.findMany({ where: { couple_id: userId }, select: { id: true, vendor_id: true } }),
    ]);
    const convByVendor = new Map(convs.map((c) => [c.vendor_id, c.id]));
    return rows.map((o) => toOrderDto(o, convByVendor.get(o.vendor_profiles!.user_id!) ?? ''));
  }

  /**
   * Khách yêu cầu chỉnh sửa. Bốn ô chọn là tùy chọn, nội dung chi tiết bắt buộc. Ghi OrderRevisions (Requested) kèm OrderRevisionChanges và CHỈ MỘT tin hệ thống.
   * - Trước cọc (Pending): Pending -> NeedRevision, BeforeDeposit. NCC "Cập nhật đơn" thì hạn cọc đặt lại 24 giờ.
   * - Sau cọc (Deposited, còn trước ngày thực hiện, chưa có yêu cầu đang chờ): đơn VẪN Deposited, AfterDeposit.
   *   NCC "Chỉnh sửa" để áp dụng (tỷ lệ và tiền cọc giữ nguyên) hoặc từ chối.
   */
  async requestRevision(userId: string, id: string, body: { changes?: unknown; note?: string }) {
    const o = await this.ownedByCouple(userId, id);
    const note = (body?.note ?? '').trim();
    const rawChanges = Array.isArray(body?.changes) ? body.changes : [];
    if (!note) return fail('VALIDATION_ERROR', 'Nhập nội dung chi tiết cần chỉnh sửa.', 400, { note: 'Nhập nội dung chi tiết cần chỉnh sửa.' });
    if (rawChanges.some((c) => !(CHANGE_TYPES as readonly unknown[]).includes(c))) return fail('VALIDATION_ERROR', 'Nội dung muốn đổi không hợp lệ.', 400, { changes: `Chọn trong: ${CHANGE_TYPES.join(', ')}.` });
    const changes = CHANGE_TYPES.filter((t) => rawChanges.includes(t)) as ChangeType[];
    const afterDeposit = o.status === 'Deposited';
    if (o.status !== 'Pending' && !afterDeposit) {
      return fail('ORDER_NOT_REVISABLE', o.status === 'NeedRevision' ? 'Đơn đang chờ nhà cung cấp chỉnh sửa.' : 'Chỉ yêu cầu chỉnh sửa được đơn đang chờ đặt cọc hoặc đã đặt cọc.', 409);
    }
    if (afterDeposit && todayVn() >= ymd(o.event_date)) return fail('ORDER_NOT_REVISABLE', 'Đã đến ngày thực hiện, không gửi yêu cầu chỉnh sửa được nữa. Bạn nhắn nhà cung cấp trong chat nhé.', 409);

    await this.prisma.$transaction(async (tx) => {
      if (afterDeposit) {
        if (await tx.order_revisions.count({ where: { order_id: id, status: 'Requested' } })) return fail('ORDER_NOT_REVISABLE', 'Bạn đã gửi một yêu cầu chỉnh sửa, đang chờ nhà cung cấp xử lý.', 409);
      } else {
        const r = await tx.orders.updateMany({ where: { id, status: 'Pending' }, data: { status: 'NeedRevision' } });
        if (!r.count) return fail('ORDER_NOT_REVISABLE', 'Đơn không còn ở trạng thái chờ đặt cọc.', 409);
      }
      await tx.order_revisions.create({
        data: {
          order_id: id,
          revision_type: afterDeposit ? 'AfterDeposit' : 'BeforeDeposit',
          request_note: note,
          old_total_amount: o.total_amount,
          status: 'Requested',
          order_revision_changes: { create: changes.map((change_type) => ({ change_type })) },
        },
      });
    });

    const conversationId = await this.conversationOf(o);
    const what = changes.map((c) => CHANGE_LABEL[c]).join(', ');
    const deposited = afterDeposit ? ' (đã đặt cọc, tiền cọc giữ nguyên)' : '';
    if (conversationId) {
      await postMessage(this.prisma, { conversationId, senderId: null, orderId: id, isRead: true, content: `Khách yêu cầu chỉnh sửa đơn ${o.order_code}${deposited}: ${what ? `${what} · ` : ''}"${note}"` });
    }
    await notify(this.prisma, {
      userId: o.vendor_profiles!.user_id!,
      type: 'OrderRevisionRequested',
      title: 'Khách yêu cầu chỉnh sửa đơn',
      content: `Khách yêu cầu chỉnh sửa đơn ${o.order_code}${deposited}: ${what ? `${what} · ` : ''}${note}`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
    return this.dtoOf(id);
  }

  /**
   * Thanh toán cọc (docs/api/payments.md). Chế độ theo PAYMENT_MODE (xem paymentMode và vnpayLive):
   * - VNPay thật (integrations/vnpay): trả URL VNPay đã ký; VNPay đưa khách về /plan/deal/:orderId kèm kết quả (FE gọi confirmDeposit)
   *   và gọi IPN (ipnDeposit). Cả hai ghi nhận qua markDepositPaid, chỉ ghi một lần.
   * - 'simulate': ghi nhận thành công ngay.
   * - Còn lại (production chưa đặt PAYMENT_MODE): 501.
   */
  async createDeposit(userId: string, orderId: string, method = '', ip = '') {
    const live = vnpayLive();
    if (!live && paymentMode() !== 'simulate') {
      return fail('PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình cổng thanh toán VNPay. Đặt PAYMENT_MODE=simulate để dùng thanh toán thử.', 501);
    }
    const o = await this.ownedByCouple(userId, orderId);
    if (o.status !== 'Pending') {
      const why: Record<string, string> = {
        Expired: 'Đơn đã hết hạn đặt cọc.',
        NeedRevision: 'Đơn đang chờ nhà cung cấp chỉnh sửa, chưa thanh toán được.',
        Deposited: 'Đơn đã được đặt cọc.',
        Completed: 'Đơn đã hoàn thành.',
        Cancelled: 'Đơn đã bị hủy.',
      };
      return fail('ORDER_NOT_PAYABLE', why[o.status ?? ''] ?? 'Đơn không ở trạng thái chờ đặt cọc.', 409);
    }

    // Quá hạn cọc mà chưa kịp quét (quét riêng giãn cách 15 giây): chuyển Expired ngay, không nhận cọc
    if (o.deposit_due_date && o.deposit_due_date <= new Date()) {
      this.jobs.forget({ coupleId: userId });
      await this.jobs.sweep({ coupleId: userId });
      return fail('ORDER_NOT_PAYABLE', 'Đơn đã hết hạn đặt cọc.', 409);
    }
    // Hạng mục đã có đơn khác đang Deposited: chưa cho cọc (chặn trước khi chuyển tiền)
    const taken = await this.depositedElsewhere(o.wedding_id, o.vendor_profiles?.service_categories?.id ?? null, o.id);
    if (taken) return fail('CATEGORY_ALREADY_DEPOSITED', categoryTakenMessage('COUPLE', taken), 409);

    if (live) {
      // Dòng thanh toán chưa trả (giữ nguyên nếu đã có), để IPN và trang quay về cùng ghi vào
      const payment = await this.prisma.payments.upsert({ where: { order_id: orderId }, create: { order_id: orderId, status: 'Unpaid' }, update: {} });
      const paymentUrl = buildPaymentUrl({
        txnRef: txnRefOf('DEPOSIT', orderId),
        amount: Number(o.deposit_amount),
        orderInfo: `Dat coc don ${o.order_code}`,
        ip,
        method,
        returnUrl: `${frontendUrl()}/plan/deal/${orderId}`,
      });
      return { paymentId: payment.id, paymentUrl };
    }

    const res = await this.markDepositPaid(o, String(randomInt(10_000_000, 99_999_999)), new Date());
    if (res === 'CATEGORY_TAKEN') {
      const other = await this.depositedElsewhere(o.wedding_id, o.vendor_profiles?.service_categories?.id ?? null, o.id);
      return fail('CATEGORY_ALREADY_DEPOSITED', other ? categoryTakenMessage('COUPLE', other) : 'Hạng mục này đã có đơn khác đang đặt cọc.', 409);
    }
    if (res === 'NOT_PENDING') return fail('ORDER_NOT_PAYABLE', 'Đơn không còn ở trạng thái chờ đặt cọc.', 409);
    const payment = await this.prisma.payments.findUniqueOrThrow({ where: { order_id: orderId } });
    return { paymentId: payment.id, paymentUrl: `/plan/deal/${orderId}?vnp_ResponseCode=00` };
  }

  /** VNPay đưa khách quay về trang đơn: kiểm tra chữ ký, số tiền rồi ghi nhận đặt cọc (nếu IPN chưa ghi). */
  async confirmDeposit(userId: string, q: Record<string, string>) {
    if (!vnpayLive()) return fail('PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình cổng thanh toán VNPay.', 501);
    const r = verifyResult(q);
    if (!r.valid) return fail('PAYMENT_SIGNATURE_INVALID', 'Kết quả thanh toán không hợp lệ (sai chữ ký).', 400);
    const t = parseTxnRef(r.txnRef);
    if (t?.kind !== 'DEPOSIT') return fail('PAYMENT_INTENT_NOT_FOUND', 'Mã giao dịch không hợp lệ.', 400);
    const o = await this.ownedByCouple(userId, t.id);
    if (!r.success) return { status: 'FAILED' as const, message: r.message };
    if (Math.round(Number(o.deposit_amount)) !== Math.round(r.amount)) return fail('PAYMENT_AMOUNT_MISMATCH', 'Số tiền thanh toán không khớp tiền cọc.', 409);
    const res = await this.markDepositPaid(o, r.transactionNo, r.paidAt);
    if (res === 'CATEGORY_TAKEN') {
      return { status: 'FAILED' as const, message: 'Hạng mục này đã có đơn khác đang đặt cọc nên đơn chưa được ghi nhận. Vui lòng liên hệ WebPlan để được hỗ trợ hoàn tiền.' };
    }
    if (res === 'NOT_PENDING') {
      return { status: 'FAILED' as const, message: 'Đơn đã thay đổi trạng thái trong lúc thanh toán. Vui lòng liên hệ WebPlan để được hỗ trợ hoàn tiền.' };
    }
    return { status: 'PAID' as const, message: 'Đặt cọc thành công.' };
  }

  /** IPN của VNPay cho giao dịch đặt cọc (chữ ký đã kiểm ở PaymentsGatewayController). */
  async ipnDeposit(orderId: string, r: VnpayResult): Promise<IpnCode> {
    const o = await this.prisma.orders.findUnique({ where: { id: orderId }, include: ORDER_INCLUDE });
    if (!o) return '01';
    if (Math.round(Number(o.deposit_amount)) !== Math.round(r.amount)) return '04';
    if (o.status === 'Deposited' || o.status === 'Completed') return '02';
    // Giao dịch thất bại: không ghi gì, chỉ xác nhận đã nhận thông báo
    if (!r.success) return '00';
    const res = await this.markDepositPaid(o, r.transactionNo, r.paidAt);
    return res === 'PAID' ? '00' : '02';
  }

  /**
   * Ghi nhận đã cọc: Payments Paid, Orders Deposited, Invoices DepositReceipt, tin DepositReceipt (hệ thống gửi), thêm NCC vào
   * kế hoạch của khách, sinh việc chi tiết trên timeline, báo NCC. Chỉ đơn còn Pending mới được ghi (trang quay về và IPN có thể
   * đến cùng lúc). Đơn đã hủy / hết hạn trong lúc khách đang thanh toán thì không ghi, trả NOT_PENDING để báo hoàn tiền.
   */
  private async markDepositPaid(o: OrderRow, transactionCode: string, paidAt: Date): Promise<'PAID' | 'ALREADY' | 'NOT_PENDING' | 'CATEGORY_TAKEN'> {
    const orderId = o.id;
    const taken = await this.prisma.payments.findUnique({ where: { transaction_code: transactionCode }, select: { order_id: true } });
    const txCode = taken && taken.order_id !== orderId ? `${transactionCode}-${orderId.slice(0, 4)}` : transactionCode;
    const receiptCode = await this.nextCode('XNC');
    const categoryId = o.vendor_profiles?.service_categories?.id ?? null;
    const done = await this.prisma.$transaction(async (tx) => {
      // Hai khoản cọc cùng hạng mục của cùng đám cưới không được chạy song song: khóa theo (đám cưới, hạng mục) rồi kiểm tra lại
      if (categoryId) {
        await tx.$executeRaw`select pg_advisory_xact_lock(hashtext(${`${o.wedding_id}:${categoryId}`}))`;
        const other = await tx.orders.findFirst({ where: { wedding_id: o.wedding_id, status: 'Deposited', id: { not: orderId }, vendor_profiles: { category_id: categoryId } }, select: { id: true } });
        if (other) return 'TAKEN' as const;
      }
      const r = await tx.orders.updateMany({ where: { id: orderId, status: 'Pending', OR: [{ deposit_due_date: null }, { deposit_due_date: { gt: paidAt } }] }, data: { status: 'Deposited' } });
      if (!r.count) return false;
      await tx.payments.upsert({
        where: { order_id: orderId },
        create: { order_id: orderId, status: 'Paid', transaction_code: txCode, paid_date: paidAt },
        update: { status: 'Paid', transaction_code: txCode, paid_date: paidAt },
      });
      await tx.invoices.create({ data: { order_id: orderId, invoice_code: receiptCode, type: 'DepositReceipt' } });
      await tx.plan_vendors.upsert({ where: { wedding_id_vendor_id: { wedding_id: o.wedding_id!, vendor_id: o.vendor_id! } }, create: { wedding_id: o.wedding_id!, vendor_id: o.vendor_id! }, update: {} });
      return true;
    });
    if (done === 'TAKEN') {
      this.logger.warn(`Khách đã trả cọc (mã ${txCode}) cho đơn ${o.order_code} nhưng hạng mục đã có đơn khác đang Deposited: không ghi nhận, cần hoàn tiền thủ công.`);
      return 'CATEGORY_TAKEN';
    }
    if (!done) {
      const now = await this.prisma.orders.findUnique({ where: { id: orderId }, select: { status: true } });
      if (now?.status === 'Deposited' || now?.status === 'Completed') return 'ALREADY';
      this.logger.warn(`Khách đã trả cọc (mã ${txCode}) cho đơn ${o.order_code} nhưng đơn đang ở trạng thái ${now?.status}: cần hoàn tiền thủ công.`);
      return 'NOT_PENDING';
    }
    const deposit = Number(o.deposit_amount);

    await onOrderDeposited(this.prisma, { id: o.id, wedding_id: o.wedding_id!, vendor_id: o.vendor_id!, event_date: o.event_date! });
    const conversationId = await this.conversationOf(o);
    if (conversationId) {
      await postMessage(this.prisma, {
        conversationId,
        senderId: null,
        type: 'DepositReceipt',
        orderId,
        isRead: true,
        content: `Giấy xác nhận cọc ${receiptCode}: đã nhận ${money(deposit)} cho đơn ${o.order_code}. Số còn lại ${money(Number(o.total_amount) - deposit)} thanh toán trực tiếp với NCC.`,
      });
    }
    await notify(this.prisma, {
      userId: o.vendor_profiles!.user_id!,
      type: 'OrderDeposited',
      title: 'Đơn đã được đặt cọc',
      content: `Đơn ${o.order_code} đã được đặt cọc ${money(deposit)}.`,
      referenceType: 'Order',
      referenceId: orderId,
    }).catch(() => undefined);
    return 'PAID';
  }

  // ================= Phía nhà cung cấp: đọc =================

  async listForVendor(userId: string, q: ListQuery) {
    const v = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: v.id });
    const convs = await this.prisma.conversations.findMany({ where: { vendor_id: userId }, select: { id: true, couple_id: true } });
    const convByCouple = new Map(convs.map((c) => [c.couple_id, c.id]));

    const where: Prisma.ordersWhereInput = { vendor_id: v.id };
    const and: Prisma.ordersWhereInput[] = [];
    if (q.status) {
      if (!(ORDER_STATUSES as readonly string[]).includes(q.status)) return fail('VALIDATION_ERROR', 'Trạng thái đơn không hợp lệ.', 400, { status: `Chọn trong: ${ORDER_STATUSES.join(', ')}.` });
      where.status = q.status;
    }
    if (q.conversationId) {
      const couple = convs.find((c) => c.id === q.conversationId)?.couple_id;
      if (!couple) return Paginated.of([], 0, { page: 1, pageSize: Math.min(100, Math.max(1, Math.trunc(Number(q.pageSize)) || 20)) });
      where.weddings = { user_id: couple };
    }
    if (q.from && DATE.test(q.from)) and.push({ event_date: { gte: new Date(`${q.from}T00:00:00Z`) } });
    if (q.to && DATE.test(q.to)) and.push({ event_date: { lte: new Date(`${q.to}T00:00:00Z`) } });
    if (q.depositFrom || q.depositTo) {
      const paid: Prisma.DateTimeNullableFilter = {};
      if (q.depositFrom && DATE.test(q.depositFrom)) paid.gte = startOfDayVn(q.depositFrom);
      if (q.depositTo && DATE.test(q.depositTo)) paid.lte = new Date(endOfDayVn(q.depositTo).getTime() + 59_999);
      and.push({ payments: { status: 'Paid', paid_date: paid } });
    }
    const term = q.q?.trim();
    if (term) {
      const digits = term.replace(/\D/g, '');
      and.push({
        OR: [
          { order_code: { contains: term, mode: 'insensitive' } },
          { customer_name: { contains: term, mode: 'insensitive' } },
          { customer_phone: { contains: term } },
          ...(digits.length >= 3 ? [{ customer_phone: { contains: digits } }] : []),
        ],
      });
    }
    if (and.length) where.AND = and;

    const page = Math.max(1, Math.trunc(Number(q.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(q.pageSize)) || 20));
    const [total, rows] = await Promise.all([
      this.prisma.orders.count({ where }),
      this.prisma.orders.findMany({ where, include: ORDER_INCLUDE, orderBy: [{ created_date: 'desc' }, { order_code: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    ]);
    return Paginated.of(
      rows.map((o) => toOrderDto(o, convByCouple.get(o.weddings!.user_id!) ?? '')),
      total,
      { page, pageSize },
    );
  }

  /** Số đơn theo từng trạng thái (7 trạng thái thô), không phụ thuộc bộ lọc. */
  async countsForVendor(userId: string) {
    const v = await this.vendorOf(userId);
    await this.jobs.sweep({ vendorId: v.id });
    const rows = await this.prisma.orders.groupBy({ by: ['status'], where: { vendor_id: v.id }, _count: { _all: true } });
    const counts: Record<string, number> = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0]));
    for (const r of rows) if (r.status) counts[r.status] = r._count._all;
    return counts;
  }

  async getForVendor(userId: string, id: string) {
    const { order } = await this.ownedByVendor(userId, id);
    return toOrderDto(order, await this.conversationOf(order));
  }

  // ================= Phía nhà cung cấp: ghi =================

  /** Tạo đơn trong hội thoại (send = false: lưu nháp, true: gửi luôn). Backend tự suy WeddingId từ hội thoại. */
  async create(userId: string, body: { conversationId?: string; content?: ContentInput; send?: boolean }) {
    const v = await this.vendorOf(userId);
    const conv = body.conversationId && UUID.test(body.conversationId) ? await this.prisma.conversations.findFirst({ where: { id: body.conversationId, vendor_id: userId } }) : null;
    if (!conv) return fail('CONVERSATION_NOT_FOUND', 'Không tìm thấy hội thoại.', 404);
    const wedding = await this.prisma.weddings.findUnique({ where: { user_id: conv.couple_id ?? undefined } });
    if (!wedding) return fail('WEDDING_NOT_SET', 'Khách chưa thiết lập thông tin đám cưới nên chưa tạo được đơn.', 409);

    const send = wantsSend(body);
    const p = parseContent(body.content ?? {}, send ? 'send' : 'draft');
    if (send) {
      // Gửi / tạo lại đơn khi hạng mục đã có đơn Deposited khác: chặn, chưa tạo gì (lưu nháp thì vẫn được)
      const taken = await this.depositedElsewhere(wedding.id, v.category_id);
      if (taken) return fail('CATEGORY_ALREADY_DEPOSITED', categoryTakenMessage('VENDOR', taken), 409);
    }
    const code = await this.nextCode('DH');
    const created = await this.prisma.$transaction(async (tx) => {
      const o = await tx.orders.create({ data: { ...this.orderData(p), vendor_id: v.id, wedding_id: wedding.id, order_code: code, status: 'Draft' } });
      if (p.items.length) await tx.order_items.createMany({ data: this.itemRows(o.id, p) });
      return o;
    });
    if (send) await this.applySend(userId, await this.loadFull(created.id), p);
    return this.dtoOf(created.id);
  }

  async saveDraft(userId: string, id: string, content: ContentInput) {
    const { order } = await this.ownedByVendor(userId, id);
    if (order.status !== 'Draft') return fail('ORDER_NOT_DRAFT', 'Chỉ lưu nháp được đơn chưa gửi. Đơn đã gửi chỉ cập nhật và gửi lại.', 409);
    const p = parseContent(content ?? {}, 'draft');
    await this.prisma.$transaction([
      this.prisma.orders.update({ where: { id }, data: this.orderData(p) }),
      this.prisma.order_items.deleteMany({ where: { order_id: id } }),
      this.prisma.order_items.createMany({ data: this.itemRows(id, p) }),
    ]);
    return this.dtoOf(id);
  }

  /** Gửi đơn Draft lần đầu, hoặc "Cập nhật đơn" khi Pending / NeedRevision (hạn cọc đặt lại 24 giờ, thẻ mới trong chat). */
  async send(userId: string, id: string, body: { content?: ContentInput }) {
    const { order } = await this.ownedByVendor(userId, id);
    if (!['Draft', 'Pending', 'NeedRevision'].includes(order.status ?? '')) {
      return fail('ORDER_NOT_SENDABLE', 'Chỉ gửi được đơn nháp, hoặc cập nhật đơn đang chờ đặt cọc / chờ chỉnh sửa.', 409);
    }
    const taken = await this.depositedElsewhere(order.wedding_id, order.vendor_profiles?.service_categories?.id ?? null, order.id);
    if (taken) return fail('CATEGORY_ALREADY_DEPOSITED', categoryTakenMessage('VENDOR', taken), 409);
    const p = parseContent(body.content ?? {}, 'send', { currentEventDate: order.status === 'Draft' ? undefined : ymd(order.event_date) });
    if (order.status !== 'Draft' && sameContent(p, this.currentOf(order))) return fail('ORDER_NO_CHANGES', 'Chưa có thay đổi nào so với đơn đang gửi.', 400);
    await this.applySend(userId, order, p);
    return this.dtoOf(id);
  }

  /** Lưu nội dung, chuyển Pending, đặt hạn cọc = bây giờ + 24 giờ, tạo Payments Unpaid, ghi OrderRevisions, gửi thẻ đơn mới. */
  private async applySend(userId: string, order: OrderRow, p: ParsedContent) {
    const id = order.id;
    const deposit = depositOf(p.total, p.depositPercent);
    const dueDate = new Date(Date.now() + 24 * HOUR);
    const oldTotal = Number(order.total_amount);

    await this.prisma.$transaction(async (tx) => {
      // Có điều kiện trạng thái: khách vừa cọc (Deposited) hay đơn vừa hết hạn thì không kéo về Pending
      const r = await tx.orders.updateMany({
        where: { id, status: { in: ['Draft', 'Pending', 'NeedRevision'] } },
        data: { ...this.orderData(p), deposit_amount: deposit, deposit_due_date: dueDate, status: 'Pending' },
      });
      if (!r.count) return fail('ORDER_NOT_SENDABLE', 'Đơn vừa đổi trạng thái (khách đã đặt cọc hoặc đơn đã hết hạn). Tải lại để xem.', 409);
      await tx.order_items.deleteMany({ where: { order_id: id } });
      await tx.order_items.createMany({ data: this.itemRows(id, p) });
      if (!order.payments) await tx.payments.create({ data: { order_id: id, status: 'Unpaid' } });
      if (order.status !== 'Draft') {
        // Đóng mọi yêu cầu của khách đang chờ (đọc trong transaction: khách có thể vừa gửi yêu cầu lúc NCC đang soạn)
        const applied = await tx.order_revisions.updateMany({
          where: { order_id: id, revision_type: 'BeforeDeposit', status: 'Requested' },
          data: { status: 'Applied', new_total_amount: p.total, applied_date: new Date() },
        });
        if (!applied.count) await tx.order_revisions.create({ data: { order_id: id, revision_type: 'BeforeDeposit', request_note: null, old_total_amount: oldTotal, new_total_amount: p.total, status: 'Applied', applied_date: new Date() } });
      }
    });

    const conversationId = await this.conversationOf(order);
    const updated = order.status !== 'Draft';
    if (conversationId) {
      await postMessage(this.prisma, {
        conversationId,
        senderId: userId,
        type: 'Order',
        orderId: id,
        content: `Đơn dịch vụ ${order.order_code}: tổng ${money(p.total)}, đặt cọc ${p.depositPercent}% = ${money(deposit)}. Hạn thanh toán cọc: ${ymdVn(dueDate)}.`,
      });
    }
    await notify(this.prisma, {
      userId: order.weddings!.user_id!,
      type: 'OrderSent',
      title: updated ? 'Nhà cung cấp đã gửi lại đơn' : 'Nhà cung cấp đã gửi đơn dịch vụ',
      content: `Đơn ${order.order_code} đang chờ bạn đặt cọc ${money(deposit)}.`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
  }

  /**
   * Sửa đơn sau cọc (Deposited): hạng mục, ngày, ghi chú. Khóa tỷ lệ và tiền cọc; tên, số điện thoại giữ nguyên.
   * Bắt buộc "Nội dung thay đổi" (khách thấy). Ghi OrderRevisions AfterDeposit trạng thái Applied; đơn vẫn Deposited.
   * Khách đang có yêu cầu chỉnh sửa (AfterDeposit, Requested) thì yêu cầu đó cũng thành Applied.
   */
  async editDeposited(userId: string, id: string, body: { content?: ContentInput; changeNote?: string }) {
    const { order } = await this.ownedByVendor(userId, id);
    if (order.status !== 'Deposited') return fail('ORDER_NOT_EDITABLE', 'Chỉ sửa được đơn đã đặt cọc.', 409);
    const changeNote = (body.changeNote ?? '').trim();
    if (!changeNote) return fail('VALIDATION_ERROR', 'Nhập nội dung thay đổi để khách biết.', 400, { changeNote: 'Nhập nội dung thay đổi để khách biết.' });

    const current = this.currentOf(order);
    const p = parseContent({ ...(body.content ?? {}), customerName: current.customerName, customerPhone: current.customerPhone, depositPercent: current.depositPercent }, 'edit', { currentEventDate: current.eventDate });
    const deposit = Number(order.deposit_amount);
    if (p.total < deposit) return fail('ORDER_TOTAL_BELOW_DEPOSIT', `Tổng mới không được nhỏ hơn tiền đã cọc (${money(deposit)}).`, 400);
    if (sameContent(p, current)) return fail('ORDER_NO_CHANGES', 'Chưa có thay đổi nào so với đơn hiện tại.', 400);

    const changes = changeTypesBetween(current, p);
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.orders.updateMany({ where: { id, status: 'Deposited' }, data: { event_date: new Date(p.eventDate), note: p.note, total_amount: p.total } });
      if (!r.count) return fail('ORDER_NOT_EDITABLE', 'Đơn không còn ở trạng thái đã đặt cọc.', 409);
      await tx.order_items.deleteMany({ where: { order_id: id } });
      await tx.order_items.createMany({ data: this.itemRows(id, p) });
      await tx.order_revisions.updateMany({
        where: { order_id: id, revision_type: 'AfterDeposit', status: 'Requested' },
        data: { status: 'Applied', new_total_amount: p.total, applied_date: new Date() },
      });
      await tx.order_revisions.create({
        data: {
          order_id: id,
          revision_type: 'AfterDeposit',
          request_note: changeNote,
          old_total_amount: order.total_amount,
          new_total_amount: p.total,
          status: 'Applied',
          applied_date: new Date(),
          order_revision_changes: { create: changes.map((change_type) => ({ change_type })) },
        },
      });
    });

    const conversationId = await this.conversationOf(order);
    if (conversationId) {
      await postMessage(this.prisma, { conversationId, senderId: userId, type: 'Order', orderId: id, content: `Đơn dịch vụ ${order.order_code} đã được cập nhật: ${changeNote}` });
    }
    await notify(this.prisma, {
      userId: order.weddings!.user_id!,
      type: 'OrderSent',
      title: 'Nhà cung cấp đã cập nhật đơn',
      content: `Đơn ${order.order_code} đã được cập nhật: ${changeNote}`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
    return this.dtoOf(id);
  }

  /**
   * NCC từ chối yêu cầu chỉnh sửa của khách với đơn đã cọc (AfterDeposit, Requested): yêu cầu thành Rejected, đơn giữ nguyên.
   * Lý do (tùy chọn) chỉ nằm trong tin hệ thống, không có cột lưu. Trước cọc không có từ chối: NCC "Cập nhật đơn".
   */
  async rejectRevision(userId: string, id: string, body: { note?: string }) {
    const { order } = await this.ownedByVendor(userId, id);
    if (order.status !== 'Deposited') return fail('REVISION_NOT_FOUND', 'Đơn không có yêu cầu chỉnh sửa đang chờ.', 409);
    const note = body?.note?.trim() || null;
    const r = await this.prisma.order_revisions.updateMany({ where: { order_id: id, revision_type: 'AfterDeposit', status: 'Requested' }, data: { status: 'Rejected' } });
    if (!r.count) return fail('REVISION_NOT_FOUND', 'Đơn không có yêu cầu chỉnh sửa đang chờ.', 409);

    const conversationId = await this.conversationOf(order);
    if (conversationId) {
      await postMessage(this.prisma, { conversationId, senderId: null, orderId: id, isRead: true, content: `NCC đã từ chối yêu cầu chỉnh sửa đơn ${order.order_code}${note ? ` · ${note}` : ''}. Đơn giữ nguyên.` });
    }
    await notify(this.prisma, {
      userId: order.weddings!.user_id!,
      type: 'OrderRevisionRejected',
      title: 'Nhà cung cấp từ chối yêu cầu chỉnh sửa',
      content: `Yêu cầu chỉnh sửa đơn ${order.order_code} không được chấp nhận${note ? `: ${note}` : ''}.`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
    return this.dtoOf(id);
  }

  /** Hoàn tất: chỉ khi Deposited và đã qua EventDate (giờ VN). Tạo hoa hồng vào bảng kê tháng hoàn thành. */
  async complete(userId: string, id: string) {
    const { order } = await this.ownedByVendor(userId, id);
    if (order.status !== 'Deposited') return fail('ORDER_NOT_COMPLETABLE', 'Chỉ hoàn tất được đơn đã đặt cọc.', 409);
    if (todayVn() <= ymd(order.event_date)) return fail('ORDER_EVENT_NOT_PASSED', 'Chỉ hoàn tất được khi đã qua ngày thực hiện.', 409);
    if (!(await completeOrder(this.prisma, id, new Date(), 'VENDOR'))) return fail('ORDER_NOT_COMPLETABLE', 'Đơn không còn ở trạng thái đã đặt cọc.', 409);
    return this.dtoOf(id);
  }

  /** Xuất hóa đơn cuối (mỗi đơn một lần): Deposited hoặc Completed. Tạo Invoices FinalInvoice và gửi tin FinalInvoice (NCC gửi). */
  async finalInvoice(userId: string, id: string) {
    const { order } = await this.ownedByVendor(userId, id);
    if (!['Deposited', 'Completed'].includes(order.status ?? '')) return fail('INVOICE_NOT_AVAILABLE', 'Chỉ xuất được hóa đơn cho đơn đã đặt cọc hoặc đã hoàn thành.', 409);
    if (order.invoices.some((i) => i.type === 'FinalInvoice')) return fail('INVOICE_EXISTS', 'Đơn đã xuất hóa đơn cuối.', 409);

    const code = await this.nextCode('HD');
    await this.prisma.invoices.create({ data: { order_id: id, invoice_code: code, type: 'FinalInvoice' } });
    const total = Number(order.total_amount);
    const deposit = Number(order.deposit_amount);
    const conversationId = await this.conversationOf(order);
    if (conversationId) {
      await postMessage(this.prisma, {
        conversationId,
        senderId: userId,
        type: 'FinalInvoice',
        orderId: id,
        content: `Hóa đơn ${code} cho đơn ${order.order_code}: tổng ${money(total)}, đã cọc ${money(deposit)}, đã thanh toán tiền mặt ${money(total - deposit)}.`,
      });
    }
    return this.dtoOf(id);
  }

  /**
   * NCC hủy đơn đã cọc: chỉ khi Deposited và hôm nay (giờ VN) còn TRƯỚC EventDate. Bắt buộc chọn lý do
   * (CUSTOMER_REQUEST: khách mất cọc; VENDOR_UNABLE: NCC hoàn cọc ngoài hệ thống), ghi chú tùy chọn.
   * Ghi CancelledDate, CancelReason; ghi chú (nếu có) CHỈ đưa vào tin hệ thống trong chat, không lưu cột; tin hệ thống vào chat; không tính hoa hồng; xóa việc chi tiết trên timeline của khách.
   */
  async cancel(userId: string, id: string, body: { reason?: string; note?: string }) {
    const { order } = await this.ownedByVendor(userId, id);
    const reason = body?.reason;
    if (!reason || !(CANCEL_REASONS as readonly string[]).includes(reason)) {
      return fail('VALIDATION_ERROR', 'Chọn lý do hủy đơn.', 400, { reason: `Chọn một trong: ${CANCEL_REASONS.join(', ')}.` });
    }
    if (order.status !== 'Deposited' || todayVn() >= ymd(order.event_date)) {
      return fail('ORDER_NOT_CANCELLABLE', 'Chỉ hủy được đơn đã đặt cọc và còn trước ngày thực hiện.', 422);
    }
    const note = body.note?.trim() || null;

    const r = await this.prisma.orders.updateMany({
      where: { id, status: 'Deposited' },
      data: { status: 'Cancelled', cancelled_date: new Date(), cancel_reason: reason },
    });
    if (!r.count) return fail('ORDER_NOT_CANCELLABLE', 'Đơn không còn ở trạng thái đã đặt cọc.', 422);
    await onOrderCancelled(this.prisma, { id, wedding_id: order.wedding_id!, vendor_id: order.vendor_id! });

    const label = CANCEL_LABEL[reason as CancelReason];
    const conversationId = await this.conversationOf(order);
    if (conversationId) {
      await postMessage(this.prisma, { conversationId, senderId: null, orderId: id, isRead: true, content: `NCC đã hủy đơn ${order.order_code} · Lý do: ${label}${note ? ` · ${note}` : ''}` });
    }
    await notify(this.prisma, {
      userId: order.weddings!.user_id!,
      type: 'OrderCancelled',
      title: 'Đơn dịch vụ đã bị hủy',
      content: `Đơn ${order.order_code} đã bị nhà cung cấp hủy. Lý do: ${label}. Các việc chi tiết của dịch vụ ${order.vendor_profiles?.service_categories?.name ?? ''} đã được gỡ khỏi timeline.`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
    return this.dtoOf(id);
  }
}

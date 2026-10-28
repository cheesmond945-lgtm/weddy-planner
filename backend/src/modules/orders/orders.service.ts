import { Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
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
  changeTypesBetween,
  depositOf,
  endOfDayVn,
  fail,
  money,
  orderedUuid,
  parseContent,
  paymentMode,
  sameContent,
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
    const c = await this.prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: o.weddings.user_id, vendor_id: o.vendor_profiles.user_id } }, select: { id: true } });
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
      customerName: o.customer_name,
      customerPhone: o.customer_phone,
      eventDate: ymd(o.event_date),
      note: o.note,
      depositPercent: Number(o.deposit_percent),
      items: o.order_items.map((i) => ({ itemName: i.item_name, unit: i.unit, quantity: i.quantity, unitPrice: Number(i.unit_price) })),
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

  /**
   * Khách yêu cầu chỉnh sửa (CHỈ khi Pending). Bốn ô chọn là tùy chọn, nội dung chi tiết bắt buộc.
   * Pending -> NeedRevision, ghi OrderRevisions (BeforeDeposit, Requested) kèm OrderRevisionChanges, và CHỈ MỘT tin hệ thống.
   */
  async requestRevision(userId: string, id: string, body: { changes?: unknown; note?: string }) {
    const o = await this.ownedByCouple(userId, id);
    const note = (body?.note ?? '').trim();
    const rawChanges = Array.isArray(body?.changes) ? body.changes : [];
    if (!note) return fail('VALIDATION_ERROR', 'Nhập nội dung chi tiết cần chỉnh sửa.', 400, { note: 'Nhập nội dung chi tiết cần chỉnh sửa.' });
    if (rawChanges.some((c) => !(CHANGE_TYPES as readonly unknown[]).includes(c))) return fail('VALIDATION_ERROR', 'Nội dung muốn đổi không hợp lệ.', 400, { changes: `Chọn trong: ${CHANGE_TYPES.join(', ')}.` });
    const changes = CHANGE_TYPES.filter((t) => rawChanges.includes(t)) as ChangeType[];
    if (o.status !== 'Pending') {
      return fail('ORDER_NOT_REVISABLE', o.status === 'NeedRevision' ? 'Đơn đang chờ nhà cung cấp chỉnh sửa.' : 'Chỉ yêu cầu chỉnh sửa được đơn đang chờ đặt cọc.', 409);
    }

    await this.prisma.$transaction(async (tx) => {
      const r = await tx.orders.updateMany({ where: { id, status: 'Pending' }, data: { status: 'NeedRevision' } });
      if (!r.count) return fail('ORDER_NOT_REVISABLE', 'Đơn không còn ở trạng thái chờ đặt cọc.', 409);
      await tx.order_revisions.create({
        data: {
          order_id: id,
          revision_type: 'BeforeDeposit',
          request_note: note,
          old_total_amount: o.total_amount,
          status: 'Requested',
          order_revision_changes: { create: changes.map((change_type) => ({ change_type })) },
        },
      });
    });

    const conversationId = await this.conversationOf(o);
    const what = changes.map((c) => CHANGE_LABEL[c]).join(', ');
    if (conversationId) {
      await postMessage(this.prisma, { conversationId, senderId: null, orderId: id, isRead: true, content: `Khách yêu cầu chỉnh sửa đơn ${o.order_code}: ${what ? `${what} · ` : ''}"${note}"` });
    }
    await notify(this.prisma, {
      userId: o.vendor_profiles.user_id,
      type: 'OrderRevisionRequested',
      title: 'Khách yêu cầu chỉnh sửa đơn',
      content: `Khách yêu cầu chỉnh sửa đơn ${o.order_code}: ${what ? `${what} · ` : ''}${note}`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
    return this.dtoOf(id);
  }

  /**
   * Thanh toán cọc. Chế độ thanh toán theo PAYMENT_MODE (xem paymentMode): 'simulate' ghi nhận thành công ngay,
   * 'vnpay' chưa tích hợp (501). Thành công: Payments Paid, Orders Deposited, Invoices DepositReceipt, tin DepositReceipt
   * (hệ thống gửi), thêm NCC vào kế hoạch của khách, sinh việc chi tiết trên timeline, báo NCC.
   */
  async createDeposit(userId: string, orderId: string) {
    const mode = paymentMode();
    if (mode !== 'simulate') {
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
      return fail('ORDER_NOT_PAYABLE', why[o.status] ?? 'Đơn không ở trạng thái chờ đặt cọc.', 409);
    }

    const now = new Date();
    const transactionCode = String(randomInt(10_000_000, 99_999_999));
    const receiptCode = await this.nextCode('XNC');
    const deposit = Number(o.deposit_amount);
    const payment = await this.prisma.$transaction(async (tx) => {
      const r = await tx.orders.updateMany({ where: { id: orderId, status: 'Pending' }, data: { status: 'Deposited' } });
      if (!r.count) return fail('ORDER_NOT_PAYABLE', 'Đơn không còn ở trạng thái chờ đặt cọc.', 409);
      const p = await tx.payments.upsert({
        where: { order_id: orderId },
        create: { order_id: orderId, status: 'Paid', transaction_code: transactionCode, paid_date: now },
        update: { status: 'Paid', transaction_code: transactionCode, paid_date: now },
      });
      await tx.invoices.create({ data: { order_id: orderId, invoice_code: receiptCode, type: 'DepositReceipt' } });
      await tx.plan_vendors.upsert({ where: { wedding_id_vendor_id: { wedding_id: o.wedding_id, vendor_id: o.vendor_id } }, create: { wedding_id: o.wedding_id, vendor_id: o.vendor_id }, update: {} });
      return p;
    });

    await onOrderDeposited(this.prisma, { id: o.id, wedding_id: o.wedding_id, vendor_id: o.vendor_id, event_date: o.event_date });
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
      userId: o.vendor_profiles.user_id,
      type: 'OrderDeposited',
      title: 'Đơn đã được đặt cọc',
      content: `Đơn ${o.order_code} đã được đặt cọc ${money(deposit)}.`,
      referenceType: 'Order',
      referenceId: orderId,
    }).catch(() => undefined);
    return { paymentId: payment.id, paymentUrl: `/plan/deal/${orderId}?vnp_ResponseCode=00` };
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
      const paid: Prisma.DateTimeFilter = {};
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
      rows.map((o) => toOrderDto(o, convByCouple.get(o.weddings.user_id) ?? '')),
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
    for (const r of rows) counts[r.status] = r._count._all;
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
    const wedding = await this.prisma.weddings.findUnique({ where: { user_id: conv.couple_id } });
    if (!wedding) return fail('WEDDING_NOT_SET', 'Khách chưa thiết lập thông tin đám cưới nên chưa tạo được đơn.', 409);

    const send = !!body.send;
    const p = parseContent(body.content ?? {}, send ? 'send' : 'draft');
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
    if (!['Draft', 'Pending', 'NeedRevision'].includes(order.status)) {
      return fail('ORDER_NOT_SENDABLE', 'Chỉ gửi được đơn nháp, hoặc cập nhật đơn đang chờ đặt cọc / chờ chỉnh sửa.', 409);
    }
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
    const requested = order.order_revisions.find((r) => r.revision_type === 'BeforeDeposit' && r.status === 'Requested');

    await this.prisma.$transaction(async (tx) => {
      await tx.orders.update({ where: { id }, data: { ...this.orderData(p), deposit_amount: deposit, deposit_due_date: dueDate, status: 'Pending' } });
      await tx.order_items.deleteMany({ where: { order_id: id } });
      await tx.order_items.createMany({ data: this.itemRows(id, p) });
      if (!order.payments) await tx.payments.create({ data: { order_id: id, status: 'Unpaid' } });
      if (order.status !== 'Draft') {
        if (requested) await tx.order_revisions.update({ where: { id: requested.id }, data: { status: 'Applied', new_total_amount: p.total, applied_date: new Date() } });
        else await tx.order_revisions.create({ data: { order_id: id, revision_type: 'BeforeDeposit', request_note: null, old_total_amount: oldTotal, new_total_amount: p.total, status: 'Applied', applied_date: new Date() } });
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
      userId: order.weddings.user_id,
      type: 'OrderSent',
      title: updated ? 'Nhà cung cấp đã gửi lại đơn' : 'Nhà cung cấp đã gửi đơn dịch vụ',
      content: `Đơn ${order.order_code} đang chờ bạn đặt cọc ${money(deposit)}.`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
  }

  /**
   * Sửa đơn sau cọc (Deposited): hạng mục, ngày, ghi chú. Khóa tỷ lệ và tiền cọc; tên, số điện thoại giữ nguyên.
   * Bắt buộc "Nội dung thay đổi" (khách thấy). Ghi OrderRevisions AfterDeposit trạng thái Applied luôn; đơn vẫn Deposited.
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
      await tx.orders.update({ where: { id }, data: { event_date: new Date(p.eventDate), note: p.note, total_amount: p.total } });
      await tx.order_items.deleteMany({ where: { order_id: id } });
      await tx.order_items.createMany({ data: this.itemRows(id, p) });
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
      userId: order.weddings.user_id,
      type: 'OrderSent',
      title: 'Nhà cung cấp đã cập nhật đơn',
      content: `Đơn ${order.order_code} đã được cập nhật: ${changeNote}`,
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
    if (!['Deposited', 'Completed'].includes(order.status)) return fail('INVOICE_NOT_AVAILABLE', 'Chỉ xuất được hóa đơn cho đơn đã đặt cọc hoặc đã hoàn thành.', 409);
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
    await onOrderCancelled(this.prisma, { id, wedding_id: order.wedding_id, vendor_id: order.vendor_id });

    const label = CANCEL_LABEL[reason as CancelReason];
    const conversationId = await this.conversationOf(order);
    if (conversationId) {
      await postMessage(this.prisma, { conversationId, senderId: null, orderId: id, isRead: true, content: `NCC đã hủy đơn ${order.order_code} · Lý do: ${label}${note ? ` · ${note}` : ''}` });
    }
    await notify(this.prisma, {
      userId: order.weddings.user_id,
      type: 'OrderCancelled',
      title: 'Đơn dịch vụ đã bị hủy',
      content: `Đơn ${order.order_code} đã bị nhà cung cấp hủy. Lý do: ${label}.`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
    return this.dtoOf(id);
  }
}

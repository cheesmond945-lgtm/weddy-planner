import { HttpException, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { Paginated } from '../../common/utils/pagination';
import { notify, postMessage } from '../chat/chat-messages';
import { onOrderDeposited } from '../weddings/timeline-hooks';
import {
  ORDER_INCLUDE,
  OrderContentDto,
  OrderRow,
  contentChanges,
  contentOf,
  endOfDayVN,
  paymentStatusOf,
  serviceStatusOf,
  toCoupleOrder,
  toServiceOrder,
  ymd,
  ymdVN,
} from './order-mapping';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PHONE = /^[0-9 +().-]{9,15}$/;
const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export interface ContentBody {
  customerName?: string;
  customerPhone?: string;
  eventDate?: string;
  note?: string | null;
  lines?: { name?: string; unit?: string; quantity?: number; unitPrice?: number }[];
  installments?: { rate?: number | null; amount?: number; dueDate?: string }[];
}

interface ParsedContent {
  customerName: string;
  customerPhone: string;
  eventDate: string;
  note: string | null;
  lines: { name: string; unit: string; quantity: number; unitPrice: number }[];
  percent: number;
  depositDue: string | null;
  total: number;
}

export interface ListQuery {
  conversationId?: string;
  q?: string;
  status?: string;
  paymentStatus?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------- Tiện ích ----------

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true, category_id: true, business_name: true } });
    return v ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  private async conversationOf(o: OrderRow) {
    const c = await this.prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: o.weddings!.user_id!, vendor_id: o.vendor_profiles!.user_id! } } });
    return c?.id ?? '';
  }

  private async cancelReason(orderId: string) {
    const m = await this.prisma.messages.findFirst({ where: { order_id: orderId, sender_id: null, content: { startsWith: 'Đã hủy đơn' } }, orderBy: { sent_date: 'desc' } });
    return m?.content?.includes('Lý do: ') ? m.content.split('Lý do: ').slice(1).join('Lý do: ') : null;
  }

  private async loadFull(id: string) {
    return this.prisma.orders.findUniqueOrThrow({ where: { id }, include: ORDER_INCLUDE });
  }

  private async serviceOrderOf(id: string) {
    const o = await this.loadFull(id);
    return toServiceOrder(o, await this.conversationOf(o), o.status === 'Cancelled' ? await this.cancelReason(o.id) : null);
  }

  private async ownedByVendor(userId: string, id: string) {
    const v = await this.vendorOf(userId);
    const o = UUID.test(id) ? await this.prisma.orders.findFirst({ where: { id, vendor_id: v.id }, include: ORDER_INCLUDE }) : null;
    return { vendor: v, order: o ?? fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404) };
  }

  private async nextCode(prefix: string, field: 'order' | 'receipt' | 'final') {
    const yymm = new Date(Date.now() + 7 * 3600_000).toISOString().slice(2, 7).replace('-', '');
    const code = (n: number) => `${prefix}${yymm}${String(n).padStart(4, '0')}`;
    const start = `${prefix}${yymm}`;
    const count =
      field === 'order'
        ? await this.prisma.orders.count({ where: { order_code: { startsWith: start } } })
        : await this.prisma.invoices.count({ where: { invoice_code: { startsWith: start } } });
    let n = count + 1;
    // Tránh trùng khi có dữ liệu cũ lệch số
    for (let i = 0; i < 20; i++, n++) {
      const exists =
        field === 'order'
          ? await this.prisma.orders.findUnique({ where: { order_code: code(n) } })
          : await this.prisma.invoices.findUnique({ where: { invoice_code: code(n) } });
      if (!exists) return code(n);
    }
    return code(n);
  }

  /** Kiểm tra nội dung đơn. strict = gửi (kiểm tra đủ); không strict = lưu nháp (bỏ qua thiếu sót). */
  private parse(c: ContentBody, strict: boolean): ParsedContent {
    const errors: Record<string, string> = {};
    const customerName = c.customerName?.trim() ?? '';
    const customerPhone = c.customerPhone?.trim() ?? '';
    const eventOk = typeof c.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.eventDate) && !Number.isNaN(Date.parse(c.eventDate));
    const eventDate = eventOk ? c.eventDate! : ymd(new Date());

    const rawLines = (c.lines ?? []).filter((l) => (l.name?.trim() ?? '') !== '' || Number(l.quantity) > 0 || Number(l.unitPrice) > 0);
    const lines = rawLines.map((l) => ({ name: l.name?.trim() ?? '', unit: l.unit?.trim() || 'Gói', quantity: Number(l.quantity) || 0, unitPrice: Number(l.unitPrice) || 0 }));
    const total = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);

    const dep = c.installments?.[0];
    const rate = dep?.rate === null || dep?.rate === undefined ? NaN : Number(dep.rate);
    const rateOk = Number.isInteger(rate) && rate >= 1 && rate <= 99;
    const dueOk = typeof dep?.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dep.dueDate);

    if (strict) {
      if (!customerName) errors.customerName = 'Nhập tên khách hàng.';
      if (!PHONE.test(customerPhone)) errors.customerPhone = 'Số điện thoại gồm 9 đến 15 ký tự (số, khoảng trắng, + ( ) . -).';
      if (!eventOk) errors.eventDate = 'Chọn ngày diễn ra sự kiện.';
      if (!lines.length) errors.lines = 'Thêm ít nhất một dòng báo giá.';
      lines.forEach((l, i) => {
        if (!l.name) errors[`lines.${i}.name`] = 'Nhập tên hạng mục.';
        if (!Number.isInteger(l.quantity) || l.quantity <= 0) errors[`lines.${i}.quantity`] = 'Số lượng là số nguyên lớn hơn 0.';
        if (l.unitPrice < 0) errors[`lines.${i}.unitPrice`] = 'Đơn giá không âm.';
      });
      if (lines.length && total <= 0) errors.lines ??= 'Tổng tiền phải lớn hơn 0.';
      if ((c.installments?.length ?? 0) !== 2) errors.installments = 'Đơn gồm 2 đợt: đặt cọc và thanh toán phần còn lại.';
      if (!rateOk) errors.installments ??= 'Tỷ lệ đặt cọc là số nguyên từ 1 đến 99 (%).';
      if (!dueOk) errors['installments.0.dueDate'] = 'Chọn hạn đặt cọc.';
    }
    if (Object.keys(errors).length) fail('VALIDATION_ERROR', 'Đơn chưa hợp lệ.', 400, errors);

    return {
      customerName,
      customerPhone,
      eventDate,
      note: c.note?.trim() || null,
      lines,
      percent: rateOk ? rate : 30,
      depositDue: dueOk ? dep!.dueDate! : null,
      total,
    };
  }

  private depositOf(p: ParsedContent) {
    return Math.round((p.total * p.percent) / 100);
  }

  private dtoOf(p: ParsedContent, installmentsFrom: OrderContentDto['installments'][number][]): OrderContentDto {
    return {
      customerName: p.customerName,
      customerPhone: p.customerPhone,
      eventDate: p.eventDate,
      note: p.note,
      lines: p.lines.map((l, i) => ({ id: String(i), packageId: null, name: l.name, unit: l.unit, quantity: l.quantity, unitPrice: l.unitPrice, isPolicyFee: false })),
      installments: installmentsFrom,
    };
  }

  /** Nội dung đã phân tích dưới dạng OrderContentDto (để so sánh thay đổi khi gửi lại). */
  private asContent(p: ParsedContent): OrderContentDto {
    const deposit = this.depositOf(p);
    return this.dtoOf(p, [
      { id: 'deposit', name: 'Đợt 1 – Đặt cọc', rate: p.percent, amount: deposit, dueDate: p.depositDue ?? p.eventDate, method: 'VNPAY', note: null },
      { id: 'final', name: 'Đợt 2 – Thanh toán còn lại', rate: 100 - p.percent, amount: p.total - deposit, dueDate: p.eventDate, method: 'CASH', note: null },
    ]);
  }

  private orderData(p: ParsedContent) {
    const deposit = this.depositOf(p);
    return {
      customer_name: p.customerName,
      customer_phone: p.customerPhone,
      event_date: new Date(p.eventDate),
      note: p.note,
      total_amount: p.total,
      deposit_percent: p.percent,
      deposit_amount: deposit,
      deposit_due_date: p.depositDue ? endOfDayVN(p.depositDue) : null,
    };
  }

  private itemRows(orderId: string, p: ParsedContent) {
    return p.lines.map((l) => ({ order_id: orderId, item_name: l.name, unit: l.unit, quantity: l.quantity, unit_price: l.unitPrice, amount: l.quantity * l.unitPrice }));
  }

  // ================= Phía cặp đôi =================

  private async ownedByCouple(userId: string, id: string) {
    const o = UUID.test(id) ? await this.prisma.orders.findFirst({ where: { id, weddings: { user_id: userId }, status: { not: 'Draft' } }, include: ORDER_INCLUDE }) : null;
    return o ?? fail('ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.', 404);
  }

  async getForCouple(userId: string, id: string) {
    const o = await this.ownedByCouple(userId, id);
    return toCoupleOrder(o, await this.conversationOf(o));
  }

  async requestRevision(userId: string, id: string, note: string) {
    const o = await this.ownedByCouple(userId, id);
    const text = (note ?? '').trim();
    if (!text) return fail('VALIDATION_ERROR', 'Nhập nội dung cần chỉnh sửa.', 400);
    if (o.status !== 'Pending') return fail('ORDER_NOT_REVISABLE', 'Chỉ yêu cầu chỉnh sửa được đơn đang chờ đặt cọc.', 409);

    const conversationId = await this.conversationOf(o);
    await this.prisma.$transaction([
      this.prisma.orders.update({ where: { id }, data: { status: 'NeedRevision' } }),
      this.prisma.order_revisions.create({ data: { order_id: id, revision_type: 'BeforeDeposit', request_note: text, old_total_amount: o.total_amount, status: 'Requested' } }),
    ]);
    if (conversationId) {
      await postMessage(this.prisma, { conversationId, senderId: userId, content: `Yêu cầu chỉnh sửa đơn ${o.order_code}:\n${text}`, orderId: id });
      await postMessage(this.prisma, { conversationId, senderId: null, content: 'Đã gửi yêu cầu chỉnh sửa cho nhà cung cấp. Nhà cung cấp sẽ cập nhật và gửi lại đơn.', orderId: id, isRead: true });
    }
    await notify(this.prisma, {
      userId: o.vendor_profiles!.user_id!,
      type: 'OrderRevisionRequested',
      title: 'Khách yêu cầu chỉnh sửa đơn',
      content: `Khách yêu cầu chỉnh sửa đơn ${o.order_code}: ${text}`,
      referenceType: 'Order',
      referenceId: id,
    });
    return toCoupleOrder(await this.loadFull(id), conversationId);
  }

  /**
   * Đặt cọc. Chưa tích hợp cổng VNPay thật (cần tài khoản merchant), nên chạy chế độ giả lập: ghi nhận thanh toán
   * thành công ngay. Đặt PAYMENT_MODE khác "simulate" thì từ chối cho tới khi có tích hợp.
   */
  async createDeposit(userId: string, orderId: string) {
    if ((process.env.PAYMENT_MODE ?? 'simulate') !== 'simulate') return fail('PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình cổng thanh toán VNPay.', 501);
    const o = await this.ownedByCouple(userId, orderId);
    if (o.status !== 'Pending') return fail('ORDER_NOT_PAYABLE', 'Đơn không ở trạng thái chờ đặt cọc.', 409);

    const now = new Date();
    const transactionCode = String(randomInt(10_000_000, 99_999_999));
    const receiptCode = await this.nextCode('XNC', 'receipt');
    const deposit = Number(o.deposit_amount);
    const payment = await this.prisma.payments.upsert({
      where: { order_id: orderId },
      create: { order_id: orderId, status: 'Paid', transaction_code: transactionCode, paid_date: now },
      update: { status: 'Paid', transaction_code: transactionCode, paid_date: now },
    });
    await this.prisma.$transaction([
      this.prisma.orders.update({ where: { id: orderId }, data: { status: 'Deposited' } }),
      this.prisma.invoices.create({ data: { order_id: orderId, invoice_code: receiptCode, type: 'DepositReceipt' } }),
    ]);

    await onOrderDeposited(this.prisma, { id: o.id, wedding_id: o.wedding_id!, vendor_id: o.vendor_id!, event_date: o.event_date! });

    const conversationId = await this.conversationOf(o);
    if (conversationId) {
      await postMessage(this.prisma, {
        conversationId,
        senderId: null,
        type: 'DepositReceipt',
        orderId,
        isRead: true,
        content: `Giấy xác nhận cọc ${receiptCode}: đã nhận ${money(deposit)} cho đơn ${o.order_code}. Số còn lại thanh toán trực tiếp cho nhà cung cấp.`,
      });
    }
    await notify(this.prisma, {
      userId: o.vendor_profiles!.user_id!,
      type: 'OrderDeposited',
      title: 'Đơn đã được đặt cọc',
      content: `Đơn ${o.order_code} đã được đặt cọc ${money(deposit)}.`,
      referenceType: 'Order',
      referenceId: orderId,
    });
    return { paymentId: payment.id, paymentUrl: `/plan/deal/${orderId}?vnp_ResponseCode=00` };
  }

  // ================= Phía nhà cung cấp =================

  async listForVendor(userId: string, q: ListQuery) {
    const v = await this.vendorOf(userId);
    const rows = await this.prisma.orders.findMany({ where: { vendor_id: v.id }, include: ORDER_INCLUDE, orderBy: { order_code: 'desc' } });
    const convs = await this.prisma.conversations.findMany({ where: { vendor_id: userId } });
    const convByCouple = new Map(convs.map((c) => [c.couple_id, c.id]));

    let list = rows;
    if (q.conversationId) {
      const cp = convs.find((c) => c.id === q.conversationId)?.couple_id;
      list = list.filter((o) => o.weddings?.user_id === cp);
    }
    if (q.status) list = list.filter((o) => serviceStatusOf(o.status) === q.status);
    if (q.paymentStatus) list = list.filter((o) => paymentStatusOf(o.status) === q.paymentStatus);
    if (q.from) list = list.filter((o) => ymd(o.event_date) >= q.from!);
    if (q.to) list = list.filter((o) => ymd(o.event_date) <= q.to!);
    const term = q.q?.trim().toLowerCase();
    if (term) {
      const digits = term.replace(/\D/g, '');
      list = list.filter((o) => (o.order_code ?? '').toLowerCase().includes(term) || (o.customer_name ?? '').toLowerCase().includes(term) || (digits.length >= 3 && (o.customer_phone ?? '').replace(/\D/g, '').includes(digits)));
    }

    const page = Math.max(1, Math.trunc(Number(q.page)) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.trunc(Number(q.pageSize)) || 20));
    const slice = list.slice((page - 1) * pageSize, page * pageSize);
    const items = await Promise.all(
      slice.map(async (o) => toServiceOrder(o, convByCouple.get(o.weddings?.user_id ?? null) ?? '', o.status === 'Cancelled' ? await this.cancelReason(o.id) : null)),
    );
    return Paginated.of(items, list.length, { page, pageSize });
  }

  async countsForVendor(userId: string) {
    const v = await this.vendorOf(userId);
    const rows = await this.prisma.orders.findMany({ where: { vendor_id: v.id }, select: { status: true } });
    const counts: Record<string, number> = { DRAFT: 0, AWAITING_CONFIRMATION: 0, REVISION_REQUESTED: 0, CONFIRMED: 0, CANCELLED: 0 };
    for (const r of rows) counts[serviceStatusOf(r.status)]++;
    return counts;
  }

  async getForVendor(userId: string, id: string) {
    const { order } = await this.ownedByVendor(userId, id);
    return this.serviceOrderOf(order.id);
  }

  async create(userId: string, body: { conversationId?: string; content?: ContentBody; send?: boolean }) {
    const v = await this.vendorOf(userId);
    const conv = body.conversationId && UUID.test(body.conversationId) ? await this.prisma.conversations.findFirst({ where: { id: body.conversationId, vendor_id: userId } }) : null;
    if (!conv) return fail('CONVERSATION_NOT_FOUND', 'Không tìm thấy hội thoại.', 404);
    const wedding = conv.couple_id ? await this.prisma.weddings.findUnique({ where: { user_id: conv.couple_id } }) : null;
    if (!wedding) return fail('WEDDING_NOT_SET', 'Khách chưa thiết lập thông tin đám cưới nên chưa tạo được đơn.', 409);

    const p = this.parse(body.content ?? {}, !!body.send);
    const code = await this.nextCode('DH', 'order');
    const created = await this.prisma.$transaction(async (tx) => {
      const o = await tx.orders.create({ data: { ...this.orderData(p), vendor_id: v.id, wedding_id: wedding.id, order_code: code, status: 'Draft' } });
      if (p.lines.length) await tx.order_items.createMany({ data: this.itemRows(o.id, p) });
      return o;
    });
    if (body.send) await this.doSend(userId, created.id);
    return this.serviceOrderOf(created.id);
  }

  async saveDraft(userId: string, id: string, content: ContentBody) {
    const { order } = await this.ownedByVendor(userId, id);
    if (order.status !== 'Draft') return fail('ORDER_NOT_REVISABLE', 'Chỉ lưu nháp được đơn chưa gửi. Đơn đã gửi chỉ sửa và gửi lại.', 409);
    const p = this.parse(content ?? {}, false);
    await this.prisma.$transaction([
      this.prisma.orders.update({ where: { id }, data: this.orderData(p) }),
      this.prisma.order_items.deleteMany({ where: { order_id: id } }),
      this.prisma.order_items.createMany({ data: this.itemRows(id, p) }),
    ]);
    return this.serviceOrderOf(id);
  }

  async send(userId: string, id: string, body: { content?: ContentBody }) {
    const { order } = await this.ownedByVendor(userId, id);
    if (!['Draft', 'Pending', 'NeedRevision'].includes(order.status ?? '')) {
      return fail('ORDER_NOT_REVISABLE', order.status === 'Deposited' || order.status === 'Completed' ? 'Đơn đã đặt cọc, không sửa và gửi lại được.' : 'Đơn đã hủy hoặc hết hạn.', 409);
    }
    const p = this.parse(body.content ?? {}, true);

    if (order.status !== 'Draft') {
      const changes = contentChanges(contentOf(order), this.asContent(p));
      if (!changes.length) return fail('ORDER_NO_CHANGES', 'Chưa có thay đổi nào so với đơn đang gửi.', 400);
    }
    const before = contentOf(order);
    await this.prisma.$transaction([
      this.prisma.orders.update({ where: { id }, data: this.orderData(p) }),
      this.prisma.order_items.deleteMany({ where: { order_id: id } }),
      this.prisma.order_items.createMany({ data: this.itemRows(id, p) }),
    ]);
    await this.doSend(userId, id, order.status === 'Draft' ? null : contentChanges(before, this.asContent(p)));
    return this.serviceOrderOf(id);
  }

  /** Chuyển đơn sang Chờ đặt cọc, thêm tin vào hội thoại và báo cho khách. changes = null: gửi lần đầu. */
  private async doSend(userId: string, id: string, changes: string[] | null = null) {
    const o = await this.loadFull(id);
    const total = Number(o.total_amount);
    const deposit = Number(o.deposit_amount);
    const conversationId = await this.conversationOf(o);

    await this.prisma.$transaction([
      this.prisma.orders.update({ where: { id }, data: { status: 'Pending' } }),
      this.prisma.payments.upsert({ where: { order_id: id }, create: { order_id: id, status: 'Unpaid' }, update: {} }),
      ...(changes
        ? [this.prisma.order_revisions.updateMany({ where: { order_id: id, status: 'Requested' }, data: { status: 'Applied', new_total_amount: total, applied_date: new Date() } })]
        : []),
    ]);
    if (conversationId) {
      if (changes) {
        await postMessage(this.prisma, {
          conversationId,
          senderId: null,
          orderId: id,
          isRead: true,
          content: `Đã cập nhật và gửi lại đơn ${o.order_code}${changes.length ? `\n${changes.map((c) => `- ${c}`).join('\n')}` : ''}`,
        });
      }
      await postMessage(this.prisma, {
        conversationId,
        senderId: userId,
        type: 'Order',
        orderId: id,
        content: `Đơn dịch vụ ${o.order_code}: tổng ${money(total)}, đặt cọc ${Number(o.deposit_percent)}% = ${money(deposit)}. Hạn thanh toán cọc: ${o.deposit_due_date ? ymdVN(o.deposit_due_date) : ymd(o.event_date)}.`,
      });
    }
    await notify(this.prisma, {
      userId: o.weddings!.user_id!,
      type: 'OrderSent',
      title: changes ? 'Nhà cung cấp đã gửi lại đơn' : 'Nhà cung cấp đã gửi đơn dịch vụ',
      content: `Đơn ${o.order_code} đang chờ bạn đặt cọc ${money(deposit)}.`,
      referenceType: 'Order',
      referenceId: id,
    });
  }

  /** NCC xác nhận đã thu phần còn lại (ngoài hệ thống): đơn hoàn thành, lập hóa đơn và tính hoa hồng. */
  async recordPayment(userId: string, id: string, body: { installmentId?: string; amount?: number; paidAt?: string; method?: string }) {
    const { vendor, order } = await this.ownedByVendor(userId, id);
    if (order.status !== 'Deposited') {
      return fail('ORDER_NOT_PAYABLE', order.status === 'Completed' ? 'Đơn đã thu đủ.' : 'Chỉ ghi nhận thanh toán khi đơn đã được đặt cọc.', 409);
    }
    const total = Number(order.total_amount);
    const remaining = total - Number(order.deposit_amount);
    const errors: Record<string, string> = {};
    if (body.installmentId !== 'final') errors.installmentId = 'Đơn chỉ ghi nhận được đợt thanh toán phần còn lại (đợt cọc do hệ thống ghi nhận).';
    if (Number(body.amount) !== remaining) errors.amount = `Số tiền phải đúng phần còn lại: ${money(remaining)}.`;
    if (!['BANK_TRANSFER', 'CASH'].includes(String(body.method))) errors.method = 'Chọn chuyển khoản hoặc tiền mặt.';
    const paidAt = body.paidAt ? new Date(body.paidAt) : new Date();
    if (Number.isNaN(paidAt.getTime())) errors.paidAt = 'Thời điểm nhận tiền không hợp lệ.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Khoản thu chưa hợp lệ.', 400, errors);

    const category = await this.prisma.service_categories.findUniqueOrThrow({ where: { id: vendor.category_id! } });
    const rate = Number(category.commission_rate);
    const commission = Math.round((total * rate) / 100);
    // Kỳ tính hoa hồng là tháng hoàn thành. Bảng kê đã thanh toán thì đã khép lại: hoa hồng của đơn hoàn thành sau đó
    // được tính dồn sang bảng kê tháng sau (lặp tới kỳ chưa thanh toán). Hạn thanh toán là ngày 25 của tháng sau kỳ.
    // Tháng hoàn thành tính theo giờ Việt Nam (cùng cách hiển thị tháng ở bảng kê)
    let periodStart = new Date(`${ymdVN(paidAt).slice(0, 7)}-01T00:00:00Z`);
    for (;;) {
      const closed = await this.prisma.commission_statements.findUnique({ where: { vendor_id_period_month: { vendor_id: vendor.id, period_month: periodStart } }, select: { status: true } });
      if (closed?.status !== 'Paid') break;
      periodStart = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1));
    }
    const dueDate = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 25));
    const invoiceCode = await this.nextCode('HD', 'final');

    await this.prisma.$transaction(async (tx) => {
      await tx.orders.update({ where: { id }, data: { status: 'Completed', completed_date: paidAt } });
      await tx.invoices.create({ data: { order_id: id, invoice_code: invoiceCode, type: 'FinalInvoice' } });
      const st = await tx.commission_statements.upsert({
        where: { vendor_id_period_month: { vendor_id: vendor.id, period_month: periodStart } },
        create: { vendor_id: vendor.id, period_month: periodStart, due_date: dueDate, total_orders: 0, total_amount: 0, status: 'Unpaid' },
        update: {},
      });
      await tx.commissions.create({ data: { order_id: id, statement_id: st.id, order_amount: total, rate, amount: commission } });
      await tx.commission_statements.update({ where: { id: st.id }, data: { total_orders: { increment: 1 }, total_amount: { increment: commission } } });
    });

    const conversationId = await this.conversationOf(order);
    if (conversationId) {
      await postMessage(this.prisma, {
        conversationId,
        senderId: null,
        type: 'FinalInvoice',
        orderId: id,
        isRead: true,
        content: `Hóa đơn ${invoiceCode}: đã thu đủ đơn ${order.order_code}, tổng ${money(total)}. Đơn hoàn thành.`,
      });
    }
    await notify(this.prisma, {
      userId: order.weddings!.user_id!,
      type: 'OrderCompleted',
      title: 'Đơn dịch vụ đã hoàn thành',
      content: `Đơn ${order.order_code} đã được thanh toán đủ và hoàn thành.`,
      referenceType: 'Order',
      referenceId: id,
    });
    return this.serviceOrderOf(id);
  }

  async cancel(userId: string, id: string, reason: string) {
    const { order } = await this.ownedByVendor(userId, id);
    const text = (reason ?? '').trim();
    if (!text) return fail('VALIDATION_ERROR', 'Nhập lý do hủy đơn.', 400);
    if (!['Draft', 'Pending', 'NeedRevision'].includes(order.status ?? '')) {
      return fail('CONFLICT', order.status === 'Deposited' || order.status === 'Completed' ? 'Đơn đã nhận cọc, không thể hủy.' : 'Đơn đã hủy hoặc hết hạn.', 409);
    }
    await this.prisma.orders.update({ where: { id }, data: { status: 'Cancelled', cancelled_date: new Date() } });
    if (order.status !== 'Draft') {
      const conversationId = await this.conversationOf(order);
      if (conversationId) {
        await postMessage(this.prisma, { conversationId, senderId: null, orderId: id, isRead: true, content: `Đã hủy đơn ${order.order_code}. Lý do: ${text}` });
      }
      await notify(this.prisma, {
        userId: order.weddings!.user_id!,
        type: 'OrderCancelled',
        title: 'Đơn dịch vụ đã bị hủy',
        content: `Đơn ${order.order_code} đã bị nhà cung cấp hủy. Lý do: ${text}`,
        referenceType: 'Order',
        referenceId: id,
      });
    }
    return this.serviceOrderOf(id);
  }
}

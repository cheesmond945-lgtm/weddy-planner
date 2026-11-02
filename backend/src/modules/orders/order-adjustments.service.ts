import { Injectable, Logger } from '@nestjs/common';
import { buildPayInfo, extraDepositContent, vietqrConfig } from '../../integrations/vietqr/vietqr';
import { demoPaymentEnabled } from '../../integrations/vietqr/demo-mode';
import { SepayService } from '../../integrations/vietqr/sepay.service';
import { requireDbFeature } from '../../prisma/db-features';
import { PrismaService } from '../../prisma/prisma.service';
import { notify, postMessage } from '../chat/chat-messages';
import { quoteGuestChange, tableLineOf } from './order-adjustment-rules';
import { ymd, type OrderRow } from './order-mapping';
import { fail, money, todayVn } from './order-rules';
import { OrdersService } from './orders.service';

/** Yêu cầu đang chờ của một đơn */
const OPEN = ['AwaitingVendor', 'AwaitingDeposit'];

/**
 * Đổi số khách khi tiệc đã cọc và khách yêu cầu hủy đơn đã cọc (docs/api/orders.md). Phép tính ở order-adjustment-rules.ts.
 * - Đổi số khách: khách gửi → NCC xác nhận → (tăng giá trị) khách nộp cọc bổ sung 10% phần tăng → áp dụng vào đơn.
 *   Giảm khách: NCC xác nhận là áp dụng ngay, không hoàn cọc. Hoa hồng tính trên giá trị đơn cuối cùng (lúc hoàn thành).
 * - Yêu cầu hủy: khách gửi (biết là mất cọc) → NCC hủy đơn với lý do "Khách yêu cầu hủy" (OrdersService.cancel) hoặc từ chối.
 */
@Injectable()
export class OrderAdjustmentsService {
  private readonly logger = new Logger(OrderAdjustmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
    private readonly sepay: SepayService,
  ) {}

  /** Đơn tiệc đã cọc + dòng tiền bàn + sức chứa / số bàn tối thiểu của sảnh */
  private async venueContext(o: OrderRow) {
    if (o.status !== 'Deposited') return fail('ORDER_NOT_ADJUSTABLE', 'Chỉ đổi số khách được với đơn đã đặt cọc.', 409);
    const line = tableLineOf(o.order_items, o.package_id);
    if (!line) return fail('ORDER_NOT_TABLE_PRICED', 'Đơn này không tính theo bàn nên không đổi số khách được. Bạn dùng "Yêu cầu chỉnh sửa" nhé.', 409);
    const hall = o.package_id ? await this.prisma.service_packages.findUnique({ where: { id: o.package_id }, select: { capacity: true, min_tables: true } }) : null;
    const order = o as OrderRow & { guest_count?: number | null };
    return { line, hall, guestCount: order.guest_count ?? null };
  }

  private quoteOf(o: OrderRow, ctx: Awaited<ReturnType<OrderAdjustmentsService['venueContext']>>, newGuestCount: number) {
    return quoteGuestChange({
      orderTotal: Number(o.total_amount),
      deposit: Number(o.deposit_amount),
      table: { unitPrice: Number(ctx.line.unit_price), quantity: ctx.line.quantity ?? 1, amount: Number(ctx.line.amount) },
      minTables: ctx.hall?.min_tables ?? null,
      capacity: ctx.hall?.capacity ?? null,
      oldGuestCount: ctx.guestCount,
      newGuestCount,
      eventDate: ymd(o.event_date),
      today: todayVn(),
    });
  }

  private async message(o: OrderRow, content: string, to: 'COUPLE' | 'VENDOR', title: string) {
    const conversationId = await this.orders.conversationOf(o);
    if (conversationId) await postMessage(this.prisma, { conversationId, senderId: null, orderId: o.id, isRead: true, content });
    await notify(this.prisma, {
      userId: to === 'VENDOR' ? o.vendor_profiles!.user_id! : o.weddings!.user_id!,
      type: 'OrderAdjustment',
      title,
      content,
      referenceType: 'Order',
      referenceId: o.id,
    }).catch(() => undefined);
  }

  // ================= Đổi số khách: phía khách =================

  /** Xem trước: số bàn, giá trị đơn mới, cọc bổ sung (không ghi gì) */
  async quote(userId: string, orderId: string, guestCount: unknown) {
    requireDbFeature('orderAdjustments');
    const o = await this.orders.ownedByCouple(userId, orderId);
    const q = this.quoteOf(o, await this.venueContext(o), Number(guestCount));
    return q.ok ? q : fail(`GUEST_CHANGE_${q.code}`, q.message, q.code === 'INVALID' ? 400 : 409);
  }

  /** Gửi yêu cầu đổi số khách: { guestCount, note? } → chờ NCC xác nhận */
  async request(userId: string, orderId: string, body: { guestCount?: unknown; note?: unknown }) {
    requireDbFeature('orderAdjustments');
    const o = await this.orders.ownedByCouple(userId, orderId);
    const ctx = await this.venueContext(o);
    const newGuestCount = Number(body?.guestCount);
    const q = this.quoteOf(o, ctx, newGuestCount);
    if (!q.ok) return fail(`GUEST_CHANGE_${q.code}`, q.message, q.code === 'INVALID' ? 400 : 409);
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) || null : null;
    if (await this.prisma.order_adjustments.count({ where: { order_id: o.id, status: { in: OPEN } } })) {
      return fail('GUEST_CHANGE_PENDING', 'Đơn đã có một yêu cầu đổi số khách đang chờ xử lý.', 409);
    }
    await this.prisma.order_adjustments.create({
      data: {
        order_id: o.id,
        old_guest_count: ctx.guestCount,
        new_guest_count: newGuestCount,
        old_tables: q.oldTables,
        new_tables: q.chargedTables,
        unit_price: Number(ctx.line.unit_price),
        old_amount: q.oldAmount,
        new_amount: q.newAmount,
        extra_deposit: q.extraDeposit,
        note,
      },
    });
    const change = `${ctx.guestCount ? `${ctx.guestCount} → ` : ''}${newGuestCount} khách (${q.oldTables} → ${q.chargedTables} bàn), giá trị đơn ${money(q.oldAmount)} → ${money(q.newAmount)}`;
    await this.message(o, `Khách yêu cầu đổi số khách đơn ${o.order_code}: ${change}${q.extraDeposit ? `, cọc bổ sung ${money(q.extraDeposit)}` : ', không hoàn cọc'}${note ? ` · "${note}"` : ''}.`, 'VENDOR', 'Khách yêu cầu đổi số khách');
    return this.orders.dtoOf(o.id);
  }

  /** Mã QR nộp cọc bổ sung (yêu cầu đang AwaitingDeposit) */
  async payInfo(userId: string, orderId: string) {
    requireDbFeature('orderAdjustments');
    const cfg = vietqrConfig() ?? fail('PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình cổng thanh toán VietQR.', 501);
    const o = await this.orders.ownedByCouple(userId, orderId);
    const a = await this.awaitingDeposit(o.id);
    return { adjustmentId: a.id, demoMode: demoPaymentEnabled(), ...buildPayInfo(cfg, { amount: Number(a.extra_deposit), content: extraDepositContent(a.id) }) };
  }

  /** Hỏi SePay đã nhận cọc bổ sung chưa; có thì áp dụng vào đơn */
  async checkPay(userId: string, orderId: string) {
    requireDbFeature('orderAdjustments');
    if (!vietqrConfig()) return fail('PAYMENT_NOT_CONFIGURED', 'Chưa cấu hình cổng thanh toán VietQR.', 501);
    const o = await this.orders.ownedByCouple(userId, orderId);
    const a = await this.awaitingDeposit(o.id);
    const txn = await this.sepay.findPayment(extraDepositContent(a.id), Number(a.extra_deposit));
    if (!txn) return { status: 'PENDING' as const, message: 'Chưa nhận được tiền. Nếu bạn vừa chuyển khoản, vui lòng đợi ít giây.' };
    await this.apply(o, a.id, txn.id, txn.paidAt);
    return { status: 'PAID' as const, message: 'Đã nhận cọc bổ sung, đơn đã được cập nhật.' };
  }

  /** Chế độ thử (PAYMENT_DEMO_MODE=true): ghi nhận cọc bổ sung ngay */
  async demoPay(userId: string, orderId: string) {
    requireDbFeature('orderAdjustments');
    if (!demoPaymentEnabled()) return fail('NOT_FOUND', 'Không tìm thấy.', 404);
    const o = await this.orders.ownedByCouple(userId, orderId);
    const a = await this.awaitingDeposit(o.id);
    await this.apply(o, a.id, `DEMO-BS-${a.id.slice(0, 8)}`, new Date());
    return { status: 'PAID' as const, message: 'Đã nộp cọc bổ sung (chế độ thử), đơn đã được cập nhật.' };
  }

  private async awaitingDeposit(orderId: string) {
    const a = await this.prisma.order_adjustments.findFirst({ where: { order_id: orderId, status: 'AwaitingDeposit' } });
    return a ?? fail('ADJUSTMENT_NOT_FOUND', 'Đơn không có khoản cọc bổ sung đang chờ.', 409);
  }

  // ================= Đổi số khách: phía NCC =================

  /** NCC xác nhận: tăng giá trị thì chờ khách nộp cọc bổ sung; không tăng thì áp dụng ngay */
  async approve(userId: string, orderId: string) {
    requireDbFeature('orderAdjustments');
    const { order: o } = await this.orders.ownedByVendor(userId, orderId);
    if (o.status !== 'Deposited') return fail('ORDER_NOT_ADJUSTABLE', 'Đơn không còn ở trạng thái đã đặt cọc.', 409);
    const a = await this.prisma.order_adjustments.findFirst({ where: { order_id: o.id, status: 'AwaitingVendor' } });
    if (!a) return fail('ADJUSTMENT_NOT_FOUND', 'Đơn không có yêu cầu đổi số khách đang chờ xác nhận.', 409);
    // Giá trị đơn đã đổi từ lúc khách gửi (NCC sửa đơn): yêu cầu không còn đúng, khách gửi lại
    if (Number(a.old_amount) !== Number(o.total_amount)) {
      await this.prisma.order_adjustments.update({ where: { id: a.id }, data: { status: 'Rejected', decided_date: new Date() } });
      return fail('ADJUSTMENT_OUTDATED', 'Đơn đã thay đổi sau khi khách gửi yêu cầu. Yêu cầu đã được hủy, khách cần gửi lại.', 409);
    }
    if (Number(a.extra_deposit) > 0) {
      await this.prisma.order_adjustments.update({ where: { id: a.id }, data: { status: 'AwaitingDeposit', decided_date: new Date() } });
      await this.message(o, `NCC đã đồng ý đổi số khách đơn ${o.order_code} thành ${a.new_guest_count} khách. Bạn nộp cọc bổ sung ${money(Number(a.extra_deposit))} để áp dụng.`, 'COUPLE', 'Nộp cọc bổ sung để đổi số khách');
    } else {
      await this.apply(o, a.id, null, null);
    }
    return this.orders.dtoOf(o.id);
  }

  async reject(userId: string, orderId: string, body: { note?: unknown }) {
    requireDbFeature('orderAdjustments');
    const { order: o } = await this.orders.ownedByVendor(userId, orderId);
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) || null : null;
    const r = await this.prisma.order_adjustments.updateMany({ where: { order_id: o.id, status: { in: OPEN } }, data: { status: 'Rejected', decided_date: new Date() } });
    if (!r.count) return fail('ADJUSTMENT_NOT_FOUND', 'Đơn không có yêu cầu đổi số khách đang chờ.', 409);
    await this.message(o, `NCC không đồng ý đổi số khách đơn ${o.order_code}${note ? `: ${note}` : ''}. Đơn giữ nguyên.`, 'COUPLE', 'Yêu cầu đổi số khách không được chấp nhận');
    return this.orders.dtoOf(o.id);
  }

  /**
   * Áp dụng vào đơn (một lần): dòng tiền bàn = đơn giá lúc đặt × số bàn tính tiền mới; giá trị đơn, tiền cọc (+ cọc bổ sung), số khách;
   * ghi lịch sử chỉnh sửa (AfterDeposit, Quantity) và đổi số khách dự kiến của đám cưới.
   */
  private async apply(o: OrderRow, adjustmentId: string, transactionCode: string | null, paidAt: Date | null) {
    const done = await this.prisma.$transaction(async (tx) => {
      const a = await tx.order_adjustments.findUnique({ where: { id: adjustmentId } });
      if (!a || !OPEN.includes(a.status)) return null;
      const line = tableLineOf(o.order_items, o.package_id)!;
      const extra = Number(a.extra_deposit);
      const r = await tx.orders.updateMany({
        where: { id: o.id, status: 'Deposited', total_amount: a.old_amount },
        data: { total_amount: a.new_amount, deposit_amount: { increment: extra }, guest_count: a.new_guest_count },
      });
      if (!r.count) return 'CHANGED' as const;
      await tx.order_items.update({ where: { id: line.id }, data: { quantity: a.new_tables, amount: Number(a.unit_price) * a.new_tables } });
      await tx.order_adjustments.update({ where: { id: a.id }, data: { status: 'Applied', applied_date: new Date(), transaction_code: transactionCode, paid_date: paidAt } });
      await tx.order_revisions.create({
        data: {
          order_id: o.id,
          revision_type: 'AfterDeposit',
          request_note: `Đổi số khách ${a.old_guest_count ? `${a.old_guest_count} → ` : ''}${a.new_guest_count} khách (${a.old_tables} → ${a.new_tables} bàn)${extra ? `, cọc bổ sung ${money(extra)}` : ''}`,
          old_total_amount: a.old_amount,
          new_total_amount: a.new_amount,
          status: 'Applied',
          applied_date: new Date(),
          order_revision_changes: { create: [{ change_type: 'Quantity' }] },
        },
      });
      if (o.wedding_id) await tx.weddings.update({ where: { id: o.wedding_id }, data: { guest_count: a.new_guest_count, updated_date: new Date() } });
      return a;
    });
    if (done === 'CHANGED') {
      if (transactionCode) this.logger.warn(`Khách đã nộp cọc bổ sung (mã ${transactionCode}) cho đơn ${o.order_code} nhưng đơn đã thay đổi: cần xử lý thủ công.`);
      return fail('ADJUSTMENT_OUTDATED', 'Đơn đã thay đổi nên chưa áp dụng được. Vui lòng liên hệ Forever để được hỗ trợ.', 409);
    }
    if (!done) return;
    const extra = Number(done.extra_deposit);
    const text = `Đơn ${o.order_code} đã đổi thành ${done.new_guest_count} khách (${done.new_tables} bàn), giá trị mới ${money(Number(done.new_amount))}${extra ? `, đã nhận cọc bổ sung ${money(extra)}` : ', tiền cọc giữ nguyên (không hoàn)'}.`;
    await this.message(o, text, 'VENDOR', 'Đơn đã đổi số khách');
    if (!extra) await this.message(o, text, 'COUPLE', 'Đơn đã đổi số khách').catch(() => undefined);
  }

  // ================= Khách yêu cầu hủy đơn đã cọc =================

  /** Khách yêu cầu hủy (đơn Deposited, trước ngày thực hiện): cọc không hoàn; NCC xác nhận bằng "Hủy đơn" lý do khách yêu cầu */
  async requestCancel(userId: string, orderId: string, body: { note?: unknown }) {
    requireDbFeature('orderAdjustments');
    const o = await this.orders.ownedByCouple(userId, orderId);
    if (o.status !== 'Deposited' || todayVn() >= ymd(o.event_date)) return fail('ORDER_NOT_CANCELLABLE', 'Chỉ yêu cầu hủy được đơn đã đặt cọc và còn trước ngày thực hiện.', 409);
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) || null : null;
    const r = await this.prisma.orders.updateMany({ where: { id: o.id, status: 'Deposited', cancel_requested_date: null }, data: { cancel_requested_date: new Date(), cancel_request_note: note } });
    if (!r.count) return fail('CANCEL_ALREADY_REQUESTED', 'Bạn đã gửi yêu cầu hủy đơn này, đang chờ nhà cung cấp xác nhận.', 409);
    await this.message(o, `Khách yêu cầu hủy đơn ${o.order_code} (tiền cọc ${money(Number(o.deposit_amount))} không hoàn)${note ? ` · "${note}"` : ''}.`, 'VENDOR', 'Khách yêu cầu hủy đơn');
    return this.orders.dtoOf(o.id);
  }

  /** Khách rút yêu cầu hủy (NCC chưa xử lý) */
  async withdrawCancel(userId: string, orderId: string) {
    requireDbFeature('orderAdjustments');
    const o = await this.orders.ownedByCouple(userId, orderId);
    const r = await this.prisma.orders.updateMany({ where: { id: o.id, status: 'Deposited', cancel_requested_date: { not: null } }, data: { cancel_requested_date: null, cancel_request_note: null } });
    if (!r.count) return fail('CANCEL_REQUEST_NOT_FOUND', 'Đơn không có yêu cầu hủy đang chờ.', 409);
    await this.message(o, `Khách đã rút yêu cầu hủy đơn ${o.order_code}. Đơn giữ nguyên.`, 'VENDOR', 'Khách rút yêu cầu hủy đơn');
    return this.orders.dtoOf(o.id);
  }

  /** NCC từ chối yêu cầu hủy: đơn giữ nguyên Deposited */
  async rejectCancel(userId: string, orderId: string, body: { note?: unknown }) {
    requireDbFeature('orderAdjustments');
    const { order: o } = await this.orders.ownedByVendor(userId, orderId);
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 500) || null : null;
    const r = await this.prisma.orders.updateMany({ where: { id: o.id, status: 'Deposited', cancel_requested_date: { not: null } }, data: { cancel_requested_date: null, cancel_request_note: null } });
    if (!r.count) return fail('CANCEL_REQUEST_NOT_FOUND', 'Đơn không có yêu cầu hủy đang chờ.', 409);
    await this.message(o, `NCC không đồng ý hủy đơn ${o.order_code}${note ? `: ${note}` : ''}. Đơn giữ nguyên.`, 'COUPLE', 'Yêu cầu hủy đơn không được chấp nhận');
    return this.orders.dtoOf(o.id);
  }
}

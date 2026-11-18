import { Logger } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { dbFeatures } from '../../prisma/db-features';
import type { PrismaService } from '../../prisma/prisma.service';
import { notify, postMessage } from '../chat/chat-messages';
import { onOrderCancelled } from '../weddings/timeline-hooks';
import { ORDER_INCLUDE, type OrderRow } from './order-mapping';
import { CANCEL_LABEL, HOUR, money, todayVn, type CancelReason } from './order-rules';

const log = new Logger('OrderCancel');

/** Khách gửi yêu cầu hủy đơn đã cọc mà NCC chưa đồng ý sau từng này giờ thì hệ thống tự hủy (nhóm chốt 15/11/2026). */
export const CANCEL_REQUEST_AUTO_HOURS = 24;

/**
 * Hủy một đơn đã cọc (Deposited) và làm các việc kèm theo; dùng chung cho NCC hủy (POST …/cancel) và hệ thống tự hủy yêu cầu hủy quá hạn.
 * - CUSTOMER_REQUEST: chỉ khi khách còn yêu cầu hủy lúc ghi; khách mất cọc, NCC giữ cọc.
 * - VENDOR_UNABLE: NCC hoàn 100% cọc ngoài hệ thống.
 * Hoa hồng đã tính trên TIỀN CỌC từ lúc khách cọc (không phụ thuộc hủy hay hoàn thành), nên hủy không làm đổi hoa hồng.
 * Sau khi hủy: bỏ yêu cầu đổi số khách đang chờ, gỡ việc chi tiết trên timeline, gỡ NCC khỏi kế hoạch (nếu không còn đơn khác), tin hệ thống, thông báo.
 * Trả false nếu đơn không còn hủy được (đã đổi trạng thái, hoặc khách vừa rút yêu cầu hủy).
 */
export async function finishDepositedCancel(prisma: PrismaService, order: OrderRow, reason: CancelReason, opts: { note?: string | null; by: 'VENDOR' | 'SYSTEM' }): Promise<boolean> {
  const id = order.id;
  const byCustomer = reason === 'CUSTOMER_REQUEST';
  const cancelledAt = new Date();
  const cancelled = await prisma.$transaction(async (tx) => {
    const r = await tx.orders.updateMany({
      // Khách hủy: yêu cầu hủy phải còn (khách chưa rút) lúc ghi
      where: { id, status: 'Deposited', ...(byCustomer && { cancel_requested_date: { not: null } }) },
      // Hủy thì bỏ luôn yêu cầu hủy của khách (nếu có)
      data: { status: 'Cancelled', cancelled_date: cancelledAt, cancel_reason: reason, ...(dbFeatures.orderAdjustments && { cancel_requested_date: null, cancel_request_note: null }) },
    });
    if (!r.count) return false;
    // Hoa hồng đã tính lúc khách cọc, hủy không phát sinh thêm
    return true;
  });
  if (!cancelled) return false;

  // Yêu cầu đổi số khách đang chờ không còn ý nghĩa
  if (dbFeatures.orderAdjustments) {
    await prisma.order_adjustments.updateMany({ where: { order_id: id, status: 'AwaitingVendor' }, data: { status: 'Rejected', decided_date: new Date() } });
  }
  try {
    await onOrderCancelled(prisma, { id, wedding_id: order.wedding_id!, vendor_id: order.vendor_id! });
  } catch (e) {
    log.error(`Hook timeline (hủy đơn) của đơn ${order.order_code} lỗi sau khi đã ghi nhận: timeline cần sinh bù (npm run timelines:repair). ${(e as Error).message}`);
  }
  // Gỡ NCC khỏi kế hoạch (tab Dịch vụ khớp tab Ngân sách: hạng mục về chưa chọn); đơn hủy vẫn nằm trong lịch sử đơn của hạng mục.
  // NCC còn đơn khác đang hiệu lực trong đám cưới này thì giữ.
  const stillActive = await prisma.orders.count({
    where: { wedding_id: order.wedding_id!, vendor_id: order.vendor_id!, id: { not: id }, status: { in: ['Pending', 'NeedRevision', 'Deposited', 'Completed'] } },
  });
  if (!stillActive) await prisma.plan_vendors.deleteMany({ where: { wedding_id: order.wedding_id!, vendor_id: order.vendor_id! } });

  const label = CANCEL_LABEL[reason];
  const deposit = money(Number(order.deposit_amount ?? 0));
  // Lỗi do NCC: nhắc rõ khoản cọc NCC phải hoàn (chuyển trực tiếp, ngoài hệ thống)
  const refund = byCustomer ? '' : ` · NCC hoàn lại ${deposit} tiền cọc cho khách`;
  const note = opts.note?.trim() || null;
  const who = opts.by === 'SYSTEM' ? `Hệ thống đã hủy đơn ${order.order_code} theo yêu cầu của khách (nhà cung cấp chưa xác nhận sau ${CANCEL_REQUEST_AUTO_HOURS} giờ)` : `NCC đã hủy đơn ${order.order_code}`;
  const coupleId = order.weddings?.user_id ?? null;
  const vendorUserId = order.vendor_profiles?.user_id ?? null;
  const conv = coupleId && vendorUserId ? await prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: coupleId, vendor_id: vendorUserId } }, select: { id: true } }) : null;
  if (conv) await postMessage(prisma, { conversationId: conv.id, senderId: null, orderId: id, isRead: true, content: `${who} · Lý do: ${label}${refund}${note ? ` · ${note}` : ''}` });
  const rest = `Nhà cung cấp đã được gỡ khỏi kế hoạch, các việc chi tiết của dịch vụ ${order.vendor_profiles?.service_categories?.name ?? ''} đã được gỡ khỏi timeline.`;
  if (coupleId) {
    await notify(prisma, {
      userId: coupleId,
      type: 'OrderCancelled',
      title: 'Đơn dịch vụ đã bị hủy',
      content: opts.by === 'SYSTEM' ? `${who}. Tiền cọc ${deposit} không hoàn. ${rest}` : `Đơn ${order.order_code} đã bị nhà cung cấp hủy. Lý do: ${label}${refund}. ${rest}`,
      referenceType: 'Order',
      referenceId: id,
    }).catch(() => undefined);
  }
  if (opts.by === 'SYSTEM' && vendorUserId) {
    await notify(prisma, { userId: vendorUserId, type: 'OrderCancelled', title: 'Đơn đã hủy theo yêu cầu của khách', content: `${who}. Bạn giữ tiền cọc ${deposit}, hoa hồng tính trên tiền cọc.`, referenceType: 'Order', referenceId: id }).catch(() => undefined);
  }
  return true;
}

/**
 * Tự hủy (lý do "Khách yêu cầu hủy") các đơn đã cọc có yêu cầu hủy của khách mà NCC chưa đồng ý: quá CANCEL_REQUEST_AUTO_HOURS giờ
 * kể từ lúc gửi, hoặc đã tới ngày thực hiện (đơn không kẹt sang ngày dịch vụ diễn ra). Trả số đơn đã hủy. Chạy lặp an toàn (updateMany có điều kiện).
 */
export async function autoCancelRequested(prisma: PrismaService, scope: Prisma.ordersWhereInput = {}): Promise<number> {
  if (!dbFeatures.orderAdjustments) return 0;
  const due = new Date(Date.now() - CANCEL_REQUEST_AUTO_HOURS * HOUR);
  const eventDay = new Date(`${todayVn()}T00:00:00Z`);
  const rows = await prisma.orders.findMany({
    where: { status: 'Deposited', cancel_requested_date: { not: null }, OR: [{ cancel_requested_date: { lte: due } }, { event_date: { lte: eventDay } }], ...scope },
    include: ORDER_INCLUDE,
  });
  let n = 0;
  for (const o of rows) if (await finishDepositedCancel(prisma, o, 'CUSTOMER_REQUEST', { by: 'SYSTEM' })) n++;
  return n;
}

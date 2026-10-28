import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { notify, postMessage } from '../chat/chat-messages';
import { HOUR, addDaysYmd, endOfDayVn, todayVn, ymdOf } from './order-rules';

/*
 * Chuyển trạng thái đơn do thời gian hoặc do NCC (hết hạn cọc, hoàn thành). Mọi bước đều idempotent: chỉ xử lý dòng thật sự
 * đổi trạng thái (updateMany có điều kiện theo trạng thái cũ), nên chạy lặp hoặc chạy song song không gửi tin hay thông báo trùng.
 * docs/database.md mục 9.8, 9.12.
 */

const parties = { weddings: { select: { user_id: true } }, vendor_profiles: { select: { id: true, user_id: true, category_id: true, business_name: true } } } satisfies Prisma.ordersInclude;

async function conversationOf(prisma: PrismaService, coupleId: string, vendorUserId: string) {
  const c = await prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: coupleId, vendor_id: vendorUserId } }, select: { id: true } });
  return c?.id ?? null;
}

/** Đơn Pending quá hạn cọc thành Expired (NeedRevision không hết hạn vì đang chờ NCC). */
export async function expirePending(prisma: PrismaService, scope: Prisma.ordersWhereInput = {}) {
  const now = new Date();
  const rows = await prisma.orders.findMany({ where: { status: 'Pending', deposit_due_date: { lt: now }, ...scope }, include: parties });
  let n = 0;
  for (const o of rows) {
    const r = await prisma.orders.updateMany({ where: { id: o.id, status: 'Pending', deposit_due_date: { lt: now } }, data: { status: 'Expired' } });
    if (!r.count) continue;
    n++;
    const conversationId = await conversationOf(prisma, o.weddings!.user_id!, o.vendor_profiles!.user_id!);
    if (conversationId) await postMessage(prisma, { conversationId, senderId: null, orderId: o.id, isRead: true, content: `Đơn ${o.order_code} đã hết hạn đặt cọc.` });
    const base = { type: 'OrderExpired', title: 'Đơn dịch vụ đã hết hạn đặt cọc', content: `Đơn ${o.order_code} đã hết hạn đặt cọc.`, referenceType: 'Order', referenceId: o.id };
    await notify(prisma, { ...base, userId: o.weddings!.user_id! }).catch(() => undefined);
    await notify(prisma, { ...base, userId: o.vendor_profiles!.user_id! }).catch(() => undefined);
  }
  return n;
}

/**
 * Hoa hồng của một đơn hoàn thành vào bảng kê của THÁNG HOÀN THÀNH (giờ VN), hạn nộp ngày 25 tháng sau.
 * Bảng kê đã thanh toán thì đã khép lại: hoa hồng được tính dồn sang bảng kê tháng sau (lặp tới kỳ chưa thanh toán).
 */
async function addCommission(tx: Prisma.TransactionClient, o: { id: string; total_amount: Prisma.Decimal | null }, vendor: { id: string; category_id: string | null }, completedAt: Date) {
  const category = await tx.service_categories.findUniqueOrThrow({ where: { id: vendor.category_id! } });
  const rate = Number(category.commission_rate);
  const total = Number(o.total_amount);
  const commission = Math.round((total * rate) / 100);
  const vn = new Date(completedAt.getTime() + 7 * HOUR);
  let periodMonth = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), 1));
  for (;;) {
    const closed = await tx.commission_statements.findUnique({ where: { vendor_id_period_month: { vendor_id: vendor.id, period_month: periodMonth } }, select: { status: true } });
    if (closed?.status !== 'Paid') break;
    periodMonth = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth() + 1, 1));
  }
  const dueDate = new Date(Date.UTC(periodMonth.getUTCFullYear(), periodMonth.getUTCMonth() + 1, 25));
  const st = await tx.commission_statements.upsert({
    where: { vendor_id_period_month: { vendor_id: vendor.id, period_month: periodMonth } },
    create: { vendor_id: vendor.id, period_month: periodMonth, due_date: dueDate, total_orders: 0, total_amount: 0, status: 'Unpaid' },
    update: {},
  });
  await tx.commissions.create({ data: { order_id: o.id, statement_id: st.id, order_amount: total, rate, amount: commission } });
  await tx.commission_statements.update({ where: { id: st.id }, data: { total_orders: { increment: 1 }, total_amount: { increment: commission } } });
}

/**
 * Deposited -> Completed: ghi CompletedDate, tạo hoa hồng, thêm tin hệ thống và báo khách (và NCC nếu hệ thống tự hoàn thành).
 * Trả false nếu đơn không còn ở Deposited (đã có người xử lý trước).
 */
export async function completeOrder(prisma: PrismaService, orderId: string, completedAt: Date, by: 'VENDOR' | 'SYSTEM') {
  const o = await prisma.orders.findUnique({ where: { id: orderId }, include: parties });
  if (!o) return false;
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.orders.updateMany({ where: { id: orderId, status: 'Deposited' }, data: { status: 'Completed', completed_date: completedAt } });
    if (!r.count) return false;
    await addCommission(tx, o, o.vendor_profiles!, completedAt);
    return true;
  });
  if (!done) return false;

  const conversationId = await conversationOf(prisma, o.weddings!.user_id!, o.vendor_profiles!.user_id!);
  if (conversationId) await postMessage(prisma, { conversationId, senderId: null, orderId: o.id, isRead: true, content: `Đơn ${o.order_code} đã hoàn thành.` });
  const base = { type: 'OrderCompleted', title: 'Đơn dịch vụ đã hoàn thành', content: `Đơn ${o.order_code} đã hoàn thành.`, referenceType: 'Order', referenceId: o.id };
  await notify(prisma, { ...base, userId: o.weddings!.user_id! }).catch(() => undefined);
  if (by === 'SYSTEM') await notify(prisma, { ...base, content: `Đơn ${o.order_code} đã tự hoàn thành, hoa hồng của đơn đã được tính.`, userId: o.vendor_profiles!.user_id! }).catch(() => undefined);
  return true;
}

/** Đơn Deposited đã qua EventDate + 7 ngày tự hoàn thành; CompletedDate = cuối ngày đó (giờ VN) để hoa hồng vào đúng tháng. */
export async function autoComplete(prisma: PrismaService, scope: Prisma.ordersWhereInput = {}) {
  const cutoff = new Date(`${addDaysYmd(todayVn(), -7)}T00:00:00Z`);
  const rows = await prisma.orders.findMany({ where: { status: 'Deposited', event_date: { lt: cutoff }, ...scope }, select: { id: true, event_date: true } });
  let n = 0;
  for (const o of rows) {
    const completedAt = endOfDayVn(addDaysYmd(ymdOf(o.event_date!), 7));
    if (await completeOrder(prisma, o.id, completedAt, 'SYSTEM')) n++;
  }
  return n;
}

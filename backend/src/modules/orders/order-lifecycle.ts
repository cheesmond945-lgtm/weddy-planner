import type { Prisma } from '../../generated/prisma/client';
import type { PrismaService } from '../../prisma/prisma.service';
import { notify, postMessage } from '../chat/chat-messages';
import { publish } from '../realtime/realtime.bus';
import { applyRestReceived, closableDetailTasksWhere, type RestDb } from './rest-payment';
import { AUTO_COMPLETE_DAYS, HOUR, addDaysYmd, autoCompleteCutoff, completedChatText, endOfDayVn, money, todayVn, ymdOf } from './order-rules';

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

type RestNotice = { orderId: string; taskId?: string; orderCode: string | null; coupleUserId: string; vendorUserId: string; vendorName: string; amount: number };

/** Tin hệ thống vào khung chat của đơn (nếu cặp NCC - khách đã có hội thoại). Lỗi không làm hỏng việc đã ghi. */
async function postOrderNotice(prisma: PrismaService, o: RestNotice, content: string) {
  const conversationId = await conversationOf(prisma, o.coupleUserId, o.vendorUserId);
  if (conversationId) await postMessage(prisma, { conversationId, senderId: null, orderId: o.orderId, isRead: true, content });
}

/**
 * Báo khách NCC đã xác nhận nhận đủ tiền mặt phần còn lại (chuông + tin hệ thống trong chat) và làm các phiên đang mở tải lại.
 * Lỗi thông báo không làm hỏng việc đã ghi.
 */
export async function notifyRestReceived(prisma: PrismaService, o: RestNotice) {
  publish({ users: [o.coupleUserId, o.vendorUserId], event: 'task', data: { orderId: o.orderId, taskId: o.taskId } });
  await postOrderNotice(prisma, o, `${o.vendorName || 'Nhà cung cấp'} đã xác nhận nhận đủ ${money(o.amount)} (đợt 2) cho đơn ${o.orderCode ?? ''}. Đơn đã thanh toán đủ.`).catch(() => undefined);
  await notify(prisma, {
    userId: o.coupleUserId,
    type: 'RestPaymentReceived',
    title: 'Nhà cung cấp đã nhận đủ tiền',
    content: `${o.vendorName || 'Nhà cung cấp'} đã xác nhận nhận đủ ${money(o.amount)} cho đơn ${o.orderCode ?? ''}.`,
    referenceType: 'Order',
    referenceId: o.orderId,
  }).catch(() => undefined);
}

/** NCC bỏ ghi nhận tiền mặt đợt 2: tin hệ thống trong chat cho cả hai bên và làm các phiên đang mở tải lại. */
export async function notifyRestCleared(prisma: PrismaService, o: RestNotice) {
  publish({ users: [o.coupleUserId, o.vendorUserId], event: 'task', data: { orderId: o.orderId, taskId: o.taskId } });
  await postOrderNotice(prisma, o, `${o.vendorName || 'Nhà cung cấp'} đã bỏ ghi nhận khoản đã nhận ${money(o.amount)} (đợt 2) của đơn ${o.orderCode ?? ''}. Đợt 2 trở về trạng thái chưa nhận.`).catch(() => undefined);
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
export async function completeOrder(prisma: PrismaService, orderId: string, completedAt: Date, by: 'VENDOR' | 'SYSTEM', opts: { restReceived?: boolean } = {}) {
  const o = await prisma.orders.findUnique({ where: { id: orderId }, include: parties });
  if (!o) return false;
  let restRecorded = false;
  const done = await prisma.$transaction(async (tx) => {
    const r = await tx.orders.updateMany({ where: { id: orderId, status: 'Deposited' }, data: { status: 'Completed', completed_date: completedAt } });
    if (!r.count) return false;
    await addCommission(tx, o, o.vendor_profiles!, completedAt);
    // Dịch vụ đã xong: đóng mọi việc chi tiết chưa Done (Todo và Waiting) của đơn trên timeline khách (không để tồn đọng thành việc quá hạn)
    // KHÔNG đóng việc thanh toán phần còn lại (PAY:): đơn Completed mà chưa ghi nhận thì đợt 2 vẫn là "chưa nhận"
    await tx.timeline_tasks.updateMany({ where: closableDetailTasksWhere(orderId), data: { status: 'Done', completed_date: completedAt } });
    // NCC xác nhận đã nhận đủ tiền mặt lúc hoàn tất: ghi nhận cùng transaction
    if (opts.restReceived) {
      restRecorded = await applyRestReceived(
        tx as unknown as RestDb,
        { id: o.id, wedding_id: o.wedding_id, category_id: o.vendor_profiles?.category_id ?? null, event_date: o.event_date!, vendorName: o.vendor_profiles?.business_name ?? '' },
        completedAt,
      );
    }
    return true;
  });
  if (!done) return false;
  if (restRecorded) await notifyRestReceived(prisma, { orderId: o.id, orderCode: o.order_code, coupleUserId: o.weddings!.user_id!, vendorUserId: o.vendor_profiles!.user_id!, vendorName: o.vendor_profiles?.business_name ?? '', amount: Number(o.total_amount) - Number(o.deposit_amount) });

  const conversationId = await conversationOf(prisma, o.weddings!.user_id!, o.vendor_profiles!.user_id!);
  if (conversationId) await postMessage(prisma, { conversationId, senderId: null, orderId: o.id, isRead: true, content: completedChatText(o.order_code, by) });
  const base = { type: 'OrderCompleted', title: 'Đơn dịch vụ đã hoàn thành', content: `Đơn ${o.order_code} đã hoàn thành.`, referenceType: 'Order', referenceId: o.id };
  // Khách: MỘT thông báo duy nhất, vừa báo hoàn thành vừa mời nêu cảm nhận (bấm mở form đánh giá); không nhắc lại
  await notify(prisma, {
    ...base,
    type: 'ReviewInvite',
    content: `Đơn ${o.order_code} đã hoàn thành. Chia sẻ cảm nhận của bạn về ${o.vendor_profiles?.business_name ?? 'nhà cung cấp'} nhé!`,
    userId: o.weddings!.user_id!,
  }).catch(() => undefined);
  if (by === 'SYSTEM') await notify(prisma, { ...base, content: `Đơn ${o.order_code} đã tự hoàn thành, hoa hồng của đơn đã được tính.`, userId: o.vendor_profiles!.user_id! }).catch(() => undefined);
  return true;
}

/**
 * Đơn Deposited có EventDate < hôm nay − 7 (đã quá ngày thực hiện hơn 7 ngày) tự hoàn thành; CompletedDate = cuối ngày EventDate + 7 (giờ VN)
 * để hoa hồng vào đúng tháng. Không kiểm tra đã ghi nhận đợt 2 hay chưa.
 */
export async function autoComplete(prisma: PrismaService, scope: Prisma.ordersWhereInput = {}) {
  const cutoff = autoCompleteCutoff(todayVn());
  const rows = await prisma.orders.findMany({ where: { status: 'Deposited', event_date: { lt: cutoff }, ...scope }, select: { id: true, event_date: true } });
  let n = 0;
  for (const o of rows) {
    const completedAt = endOfDayVn(addDaysYmd(ymdOf(o.event_date!), AUTO_COMPLETE_DAYS));
    if (await completeOrder(prisma, o.id, completedAt, 'SYSTEM')) n++;
  }
  return n;
}

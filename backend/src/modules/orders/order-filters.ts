/*
 * Bộ lọc danh sách đơn của NCC và các số liệu thẻ thống kê (Quản lý đơn hàng). Điều kiện dựng thành đối tượng thuần để test được;
 * orders.service.ts đưa vào Prisma. Kiểu where khai báo tối thiểu, tương thích Prisma.ordersWhereInput.
 */
import { PAY_PREFIX } from '../weddings/timeline-rows.ts';

export const ORDER_STATUS_LIST = ['Draft', 'Pending', 'NeedRevision', 'Deposited', 'Completed', 'Expired', 'Cancelled'] as const;

/** ?status= nhận một hoặc nhiều trạng thái, ngăn bằng dấu phẩy ("Expired,Cancelled" cho tab Hết hạn / Hủy). */
export function parseStatusFilter(raw: string | undefined): { statuses: string[] } | { error: string } {
  const list = (raw ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const bad = list.find((s) => !(ORDER_STATUS_LIST as readonly string[]).includes(s));
  if (bad) return { error: `Chọn trong: ${ORDER_STATUS_LIST.join(', ')}.` };
  return { statuses: list };
}

/** "Cần bạn xử lý": đơn Chờ chỉnh sửa, hoặc đơn Đã cọc có yêu cầu chỉnh sửa của khách đang chờ NCC. */
export const needsActionWhere = () => ({
  OR: [{ status: 'NeedRevision' }, { status: 'Deposited', order_revisions: { some: { status: 'Requested' } } }],
});

/**
 * "Chưa nhận tiền mặt": đơn Đã cọc hoặc Hoàn thành mà việc thanh toán đợt 2 (PAY:) chưa Done (đơn cũ chưa có việc PAY cũng tính là chưa nhận,
 * khớp restPaymentOf).
 */
export const restPendingWhere = () => ({
  status: { in: ['Deposited', 'Completed'] },
  NOT: { timeline_tasks: { some: { task_code: { startsWith: PAY_PREFIX }, status: 'Done' } } },
});

/** Số ngày của thẻ "Sắp thực hiện". */
export const UPCOMING_DAYS = 30;

/** Ngày "YYYY-MM-DD" -> mốc 00:00 UTC (cột event_date là Date). */
const day = (s: string) => new Date(`${s}T00:00:00Z`);

/**
 * Điều kiện đếm của 4 thẻ. `today` và `in30` là "YYYY-MM-DD" giờ VN, `soon` là thời điểm hết hạn cọc coi là sắp hết (hiện tại + DEPOSIT_SOON_HOURS).
 * - pending: Chờ cọc; expiringSoon: trong đó hạn cọc trước `soon`.
 * - upcoming: Đã cọc, ngày thực hiện từ hôm nay tới hôm nay + 30 ngày.
 * - dueToComplete: Đã cọc, ngày thực hiện đã qua (NCC được bấm Hoàn tất); dueRestPending: trong đó chưa nhận tiền mặt.
 */
export function tileWheres(o: { today: string; in30: string; soon: Date }) {
  return {
    pending: { status: 'Pending' },
    expiringSoon: { status: 'Pending', deposit_due_date: { lte: o.soon } },
    needsAction: needsActionWhere(),
    upcoming: { status: 'Deposited', event_date: { gte: day(o.today), lte: day(o.in30) } },
    dueToComplete: { status: 'Deposited', event_date: { lt: day(o.today) } },
    dueRestPending: { AND: [{ status: 'Deposited', event_date: { lt: day(o.today) } }, restPendingWhere()] },
  };
}

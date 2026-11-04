import { addDaysYmd, now as clockNow, todayVN } from '@/lib/clock'
import type { Order } from '@/types/vendorOrder'
import { eventPassed, openRevision } from './calc'

/*
 * Hàm thuần dùng chung cho dòng đơn và trang Tổng quan. 4 thẻ đầu trang Quản lý đơn hàng không tính ở đây nữa:
 * backend tính trên toàn bộ đơn (GET /vendors/me/orders/counts → tiles).
 */

const HOUR = 3_600_000

/** Còn bao nhiêu mili giây tới hạn cọc (đơn Pending); null nếu không có hạn. */
export const msToDeadline = (o: Pick<Order, 'status' | 'depositDueDate'>, at = clockNow()) => (o.status === 'Pending' && o.depositDueDate ? new Date(o.depositDueDate).getTime() - at.getTime() : null)

/** "còn 2 giờ", "còn 35 phút", "đã quá hạn". */
export function countdownText(ms: number) {
  if (ms <= 0) return 'đã quá hạn'
  const hours = Math.floor(ms / HOUR)
  if (hours >= 24) return `còn ${Math.floor(hours / 24)} ngày ${hours % 24} giờ`
  return hours > 0 ? `còn ${hours} giờ` : `còn ${Math.max(1, Math.floor(ms / 60_000))} phút`
}

/** Gấp: còn dưới 6 giờ là hết hạn cọc. */
export const URGENT_HOURS = 6

/** Đơn cần chú ý (vạch màu bên trái dòng): chờ chỉnh sửa, chờ hoàn thành, sắp hết hạn cọc. */
export function attentionOf(o: Order): 'warn' | 'danger' | null {
  if (o.status === 'NeedRevision') return 'warn'
  if (o.status === 'Deposited' && (eventPassed(o) || openRevision(o))) return 'warn'
  const ms = msToDeadline(o)
  if (ms !== null && ms < URGENT_HOURS * HOUR) return 'danger'
  return null
}

/** "Sắp thực hiện": đơn đã cọc có ngày sự kiện trong [hôm nay, hôm nay + 30 ngày]. Dùng chung cho Tổng quan và trang Đơn hàng. */
export const UPCOMING_DAYS = 30
export const isUpcoming = (o: Pick<Order, 'status' | 'eventDate'>, today = todayVN()) => o.status === 'Deposited' && o.eventDate >= today && o.eventDate <= addDaysYmd(today, UPCOMING_DAYS)

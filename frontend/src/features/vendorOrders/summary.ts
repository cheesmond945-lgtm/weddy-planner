import { addDaysYmd, now as clockNow, todayVN } from '@/lib/clock'
import type { Order } from '@/types/vendorOrder'
import { eventPassed, openRevision } from './calc'

/*
 * Số liệu tổng hợp từ danh sách đơn (4 thẻ đầu trang Quản lý đơn hàng, trang Tổng quan). Hàm thuần.
 * FE tính từ danh sách đơn (tối đa 100 đơn mỗi trang theo README); cần chính xác với NCC nhiều đơn thì backend thêm endpoint tổng hợp.
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

/** Ngày cuối của tháng chứa `ymd` ("2026-10-26" -> "2026-10-31"). */
const endOfMonth = (ymd: string) => {
  const [y, m] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10)
}

export function orderTiles(orders: Order[]) {
  const today = todayVN()
  const month = today.slice(0, 7)
  const in30 = addDaysYmd(today, UPCOMING_DAYS)
  const pending = orders.filter((o) => o.status === 'Pending')
  const deposited = orders.filter((o) => o.status === 'Deposited')
  const upcoming = orders.filter((o) => isUpcoming(o, today))
  const toComplete = deposited.filter((o) => eventPassed(o))
  // "Đặt cọc trong tháng": đơn có ngày cọc (Payments.PaidDate, giờ VN) trong tháng này, mọi trạng thái (gồm đã hoàn thành)
  const depositedThisMonth = orders.filter((o) => o.payment?.status === 'Paid' && o.payment.paidDate && todayVN(new Date(o.payment.paidDate)).slice(0, 7) === month)
  return {
    pending: pending.length,
    /** Chờ cọc mà sắp hết hạn trong 24 giờ */
    expiringSoon: pending.filter((o) => {
      const ms = msToDeadline(o)
      return ms !== null && ms <= 24 * HOUR
    }).length,
    upcoming: upcoming.length,
    upcomingValue: upcoming.reduce((s, o) => s + o.totalAmount, 0),
    toComplete: toComplete.length,
    depositedThisMonth: depositedThisMonth.length,
    depositedThisMonthValue: depositedThisMonth.reduce((s, o) => s + o.totalAmount, 0),
    /** Bộ lọc tương ứng của từng thẻ */
    filters: {
      pending: { status: 'Pending' as const, from: undefined, to: undefined, depositFrom: undefined, depositTo: undefined },
      upcoming: { status: 'Deposited' as const, from: today, to: in30, depositFrom: undefined, depositTo: undefined },
      toComplete: { status: 'Deposited' as const, from: undefined, to: addDaysYmd(today, -1), depositFrom: undefined, depositTo: undefined },
      deposited: { status: undefined, from: undefined, to: undefined, depositFrom: `${month}-01`, depositTo: endOfMonth(today) },
    },
  }
}

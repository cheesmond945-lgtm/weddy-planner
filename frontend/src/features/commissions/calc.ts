import { todayVN } from '@/lib/clock'
import { formatDate } from '@/lib/date'
import type { CommissionStatement } from '@/types/commission'
import type { StatementState } from './constants'

/** "2026-09" -> "09/2026" */
export const formatPeriod = (periodMonth: string) => {
  const [y, m] = periodMonth.split('-')
  return `${m}/${y}`
}

/** Kỳ của tháng hiện tại (giờ Việt Nam), "YYYY-MM". */
export const currentPeriod = (today = todayVN()) => today.slice(0, 7)

/** Số ngày từ hôm nay tới hạn nộp (âm: đã quá). */
export const daysToDue = (s: Pick<CommissionStatement, 'dueDate'>, today = todayVN()) => Math.round((Date.parse(s.dueDate) - Date.parse(today)) / 86_400_000)

/** Đang tạm tính (tháng hiện tại), Chưa nộp, Quá hạn (Unpaid và đã qua hạn), Đã nộp. */
export function stateOf(s: CommissionStatement, today = todayVN()): StatementState {
  if (s.status === 'Paid') return 'paid'
  if (s.periodMonth >= currentPeriod(today)) return 'provisional'
  return today > s.dueDate ? 'overdue' : 'unpaid'
}

/** Nộp được khi kỳ đã kết thúc và chưa nộp (kỳ đang tạm tính chưa cho nộp). */
export const canPay = (s: CommissionStatement, today = todayVN()) => {
  const st = stateOf(s, today)
  return (st === 'unpaid' || st === 'overdue') && s.totalAmount > 0
}

/** "còn 5 ngày", "hạn hôm nay" hoặc "quá hạn 3 ngày". */
export function dueRelative(s: CommissionStatement, today = todayVN()) {
  const days = daysToDue(s, today)
  if (days < 0) return `quá hạn ${-days} ngày`
  return days === 0 ? 'hạn hôm nay' : `còn ${days} ngày`
}

/** "hạn 25/11 · còn 5 ngày" hoặc "quá hạn 3 ngày". */
export function dueHint(s: CommissionStatement, today = todayVN()) {
  return daysToDue(s, today) < 0 ? dueRelative(s, today) : `hạn ${formatDate(s.dueDate).slice(0, 5)} · ${dueRelative(s, today)}`
}

/** Bảng kê của tháng hiện tại; chưa có đơn hoàn thành nào thì dựng dòng 0 đồng để trang vẫn có kỳ "Đang tạm tính". */
export function withCurrentPeriod(statements: CommissionStatement[], today = todayVN()): CommissionStatement[] {
  const period = currentPeriod(today)
  if (statements.some((s) => s.periodMonth === period)) return statements
  const [y, m] = period.split('-').map(Number)
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  const due = `${next.y}-${String(next.m).padStart(2, '0')}-25`
  return [{ id: `tam-${period}`, periodMonth: period, totalOrders: 0, totalAmount: 0, dueDate: due, status: 'Unpaid', paidDate: null, transactionCode: null, createdDate: `${period}-01T00:00:00.000Z` }, ...statements]
}

/** Số liệu bốn thẻ đầu trang. */
export function commissionTiles(statements: CommissionStatement[], today = todayVN()) {
  const current = statements.find((s) => s.periodMonth === currentPeriod(today))
  const due = statements.filter((s) => s.status === 'Unpaid' && s.periodMonth < currentPeriod(today) && s.totalAmount > 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const year = today.slice(0, 4)
  const paid = statements.filter((s) => s.status === 'Paid' && s.paidDate && todayVN(new Date(s.paidDate)).startsWith(year))
  return {
    current,
    due,
    dueAmount: due.reduce((sum, s) => sum + s.totalAmount, 0),
    /** Hạn gần nhất trong các kỳ chưa nộp */
    nextDue: due[0],
    overdue: due.some((s) => stateOf(s, today) === 'overdue'),
    paidThisYear: paid.reduce((sum, s) => sum + s.totalAmount, 0),
    paidCount: paid.length,
  }
}

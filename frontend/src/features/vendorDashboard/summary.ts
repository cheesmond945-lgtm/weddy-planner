import { periodOfInstant } from '@/features/commissions/calc'
import { formatPeriod, remainingOf } from '@/features/commissions/constants'
import { currentContent, currentVersion } from '@/features/serviceOrders/calc'
import { adjustmentStateOf } from '@/features/serviceOrders/constants'
import { formatDate } from '@/lib/date'
import { paths } from '@/routes/paths'
import type { CommissionStatementSummary } from '@/types/commission'
import type { ServiceOrder } from '@/types/serviceOrder'
import type { VendorConversation } from '@/types/vendorChat'
import type { VendorPackage } from '@/types/vendorPackage'

/*
 * Tổng hợp số liệu trang Tổng quan NCC từ dữ liệu các trang khác đã có (đơn, hội thoại, gói, bảng kê hoa hồng).
 * Hàm thuần, không gọi API. Số liệu dùng cùng nguồn với trang tương ứng nên khớp nhau.
 */

const VN_OFFSET = 7 * 3600_000
/** Hôm nay "YYYY-MM-DD" theo giờ Việt Nam */
export const todayVN = (now: Date) => new Date(now.getTime() + VN_OFFSET).toISOString().slice(0, 10)

const sent = (orders: ServiceOrder[]) => orders.filter((o) => o.versions.length && o.status !== 'CANCELLED')

/** Số liệu đơn và tiền (bốn thẻ đầu trang, phần đơn). */
export function orderStats(orders: ServiceOrder[], now: Date) {
  const list = sent(orders)
  const today = todayVN(now)
  const month = periodOfInstant(now.toISOString())
  const awaiting = list.filter((o) => o.status === 'AWAITING_CONFIRMATION').length
  const revision = list.filter((o) => o.status === 'REVISION_REQUESTED').length
  const awaitingDeposit = list.filter((o) => o.paymentStatus === 'AWAITING_DEPOSIT').length
  // Đã xác nhận mà chưa tới ngày sự kiện: vẫn đang thực hiện
  const upcomingConfirmed = list.filter((o) => o.status === 'CONFIRMED' && (currentContent(o)?.eventDate ?? '') >= today).length
  const payments = list.flatMap((o) => o.payments)
  const confirmed = list.filter((o) => o.status === 'CONFIRMED')
  return {
    inProgress: awaiting + revision + upcomingConfirmed,
    awaiting,
    revision,
    awaitingDeposit,
    /** Đã thu thực tế trong tháng hiện tại (giờ VN), cả VietQR lẫn NCC ghi nhận */
    collectedThisMonth: payments.filter((p) => periodOfInstant(p.paidAt) === month).reduce((s, p) => s + p.amount, 0),
    /** Đã thu thực tế mọi thời điểm (thẻ "Đã thu thực tế" của prototype) */
    collectedTotal: payments.reduce((s, p) => s + p.amount, 0),
    /** Còn phải thu trên các đơn đã xác nhận (như cột "Còn phải thu" ở chi tiết đơn) */
    receivable: confirmed.reduce((s, o) => s + Math.max(0, o.totalAmount - o.paidAmount), 0),
    receivableOrders: confirmed.filter((o) => o.totalAmount > o.paidAmount).length,
  }
}

export interface TodoItem {
  key: string
  count: number
  label: string
  /** Dòng phụ (mã đơn, hạn…) */
  hint?: string
  href: string
  /** Gấp: quá hạn, khách đang chờ */
  urgent?: boolean
}

const one = <T,>(list: T[]) => (list.length === 1 ? list[0] : null)
const ordersHref = (q: string) => `${paths.vendor.orders}?${q}`
const chatHref = (conversationId?: string) => (conversationId ? `${paths.vendor.chat}?c=${encodeURIComponent(conversationId)}` : paths.vendor.chat)
const orderHref = (o: ServiceOrder, action?: 'adjust') => ordersHref(`order=${encodeURIComponent(o.id)}${action ? `&do=${action}` : ''}`)
const codes = (list: ServiceOrder[]) => list.slice(0, 3).map((o) => o.code).join(', ') + (list.length > 3 ? '…' : '')

interface TodoInput {
  orders: ServiceOrder[]
  conversations: VendorConversation[]
  packages: VendorPackage[]
  statements: CommissionStatementSummary[]
  now: Date
}

/** Việc cần làm, mục nào cũng dẫn tới đúng chỗ xử lý (một việc thì mở thẳng, nhiều việc thì mở danh sách đã lọc). */
export function todoItems({ orders, conversations, packages, statements, now }: TodoInput): TodoItem[] {
  const today = todayVN(now)
  const items: TodoItem[] = []
  const list = sent(orders)

  // Sửa đơn làm ở khung chat (form gửi lại phiên bản mới)
  const revision = list.filter((o) => o.status === 'REVISION_REQUESTED')
  if (revision.length) {
    const o = one(revision)
    items.push({
      key: 'revision',
      count: revision.length,
      label: 'đơn khách yêu cầu chỉnh sửa',
      hint: codes(revision),
      href: o ? chatHref(o.conversationId) : ordersHref('status=REVISION_REQUESTED'),
      urgent: true,
    })
  }

  // Yêu cầu điều chỉnh / sửa phương án: làm ở Quản lý đơn hàng
  const adjust = list.filter((o) => {
    const st = o.status === 'CONFIRMED' ? adjustmentStateOf(o) : null
    return st?.kind === 'REQUESTED' || st?.kind === 'REVISION_REQUESTED'
  })
  if (adjust.length) {
    const o = one(adjust)
    items.push({
      key: 'adjust',
      count: adjust.length,
      label: 'yêu cầu điều chỉnh / sửa phương án',
      hint: codes(adjust),
      href: o ? orderHref(o, 'adjust') : ordersHref('status=CONFIRMED'),
      urgent: true,
    })
  }

  const deposit = list.filter((o) => o.paymentStatus === 'AWAITING_DEPOSIT')
  if (deposit.length) {
    const o = one(deposit)
    items.push({ key: 'deposit', count: deposit.length, label: 'đơn chờ thanh toán cọc', hint: codes(deposit), href: o ? orderHref(o) : ordersHref('payment=AWAITING_DEPOSIT') })
  }

  const drafts = orders.filter((o) => o.draft && o.status !== 'CANCELLED')
  if (drafts.length) {
    const o = one(drafts)
    items.push({ key: 'drafts', count: drafts.length, label: 'bản nháp đơn chưa gửi', hint: codes(drafts), href: o ? chatHref(o.conversationId) : paths.vendor.chat })
  }

  const unread = conversations.filter((c) => c.unreadCount > 0)
  if (unread.length) {
    const c = one(unread)
    items.push({
      key: 'unread',
      count: unread.length,
      label: 'hội thoại chưa đọc',
      hint: `${unread.reduce((s, x) => s + x.unreadCount, 0)} tin mới`,
      href: chatHref(c?.id),
    })
  }

  const pending = packages.filter((p) => p.status === 'PENDING')
  if (pending.length) {
    items.push({ key: 'packages', count: pending.length, label: 'gói dịch vụ đang chờ duyệt', hint: pending.slice(0, 2).map((p) => p.name).join(', '), href: `${paths.vendor.catalog}?status=PENDING` })
  }

  // Hoa hồng của kỳ đã chốt còn phải trả (chưa có minh chứng chờ xác nhận), hạn gần nhất trước
  const dues = statements.filter((s) => s.status !== 'OPEN' && remainingOf(s) > 0 && s.pendingAmount === 0).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  for (const s of dues) {
    const days = Math.round((Date.parse(s.dueDate) - Date.parse(today)) / 86_400_000)
    items.push({
      key: `commission-${s.id}`,
      count: 1,
      label: `hoa hồng kỳ ${formatPeriod(s.period)} cần thanh toán`,
      hint: s.isOverdue ? `Quá hạn từ ${formatDate(s.dueDate)}` : `Hạn ${formatDate(s.dueDate)}${days <= 7 ? ` · còn ${days} ngày` : ''}`,
      href: `${paths.vendor.commissions}?ky=${s.id}`,
      urgent: s.isOverdue || days <= 7,
    })
  }
  return items
}

/** Đơn đã xác nhận sắp diễn ra (ngày sự kiện từ hôm nay), gần nhất trước. */
export function upcomingOrders(orders: ServiceOrder[], now: Date, limit = 5) {
  const today = todayVN(now)
  return sent(orders)
    .filter((o) => o.status === 'CONFIRMED' && (currentContent(o)?.eventDate ?? '') >= today)
    .sort((a, b) => currentContent(a)!.eventDate.localeCompare(currentContent(b)!.eventDate))
    .slice(0, limit)
    .map((o) => ({ order: o, daysLeft: Math.round((Date.parse(currentContent(o)!.eventDate) - Date.parse(today)) / 86_400_000) }))
}

/** Đơn gửi gần đây (theo lần gửi phiên bản mới nhất), như prototype. */
export function recentOrders(orders: ServiceOrder[], limit = 6) {
  return sent(orders)
    .sort((a, b) => (currentVersion(b)?.sentAt ?? '').localeCompare(currentVersion(a)?.sentAt ?? ''))
    .slice(0, limit)
}

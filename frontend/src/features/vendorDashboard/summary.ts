import { formatPeriod, remainingOf } from '@/features/commissions/constants'
import { eventPassed } from '@/features/vendorOrders/calc'
import { isUpcoming, msToDeadline, URGENT_HOURS } from '@/features/vendorOrders/summary'
import { addDaysYmd, todayVN } from '@/lib/clock'
import { formatDate } from '@/lib/date'
import { paths } from '@/routes/paths'
import type { CommissionStatementSummary } from '@/types/commission'
import type { VendorConversation } from '@/types/vendorConversation'
import type { Order } from '@/types/vendorOrder'
import type { VendorPackage } from '@/types/vendorPackage'

/*
 * Tổng hợp số liệu trang Tổng quan NCC từ dữ liệu các trang khác đã có (đơn, hội thoại, gói, bảng kê hoa hồng).
 * Hàm thuần, không gọi API. Số liệu dùng cùng nguồn với trang tương ứng nên khớp nhau.
 */

const HOUR = 3_600_000

/** Số liệu đơn (ba thẻ đầu trang). */
export function orderStats(orders: Order[]) {
  const today = todayVN()
  const pending = orders.filter((o) => o.status === 'Pending')
  const revision = orders.filter((o) => o.status === 'NeedRevision')
  const deposited = orders.filter((o) => o.status === 'Deposited')
  // Cùng định nghĩa với thẻ ở trang Đơn hàng: đã cọc, ngày thực hiện trong 30 ngày tới
  const upcoming = deposited.filter((o) => isUpcoming(o, today))
  return {
    inProgress: pending.length + revision.length + deposited.length,
    pending: pending.length,
    revision: revision.length,
    deposited: deposited.length,
    /** Đã cọc, ngày thực hiện trong 30 ngày tới */
    upcoming: upcoming.length,
    upcomingValue: upcoming.reduce((s, o) => s + o.totalAmount, 0),
    /** Đã cọc và đã qua ngày thực hiện: chờ NCC đánh dấu hoàn thành */
    toComplete: deposited.filter((o) => eventPassed(o)).length,
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
const orderHref = (o: Order) => ordersHref(`order=${encodeURIComponent(o.id)}`)
const chatHref = (conversationId?: string) => (conversationId ? `${paths.vendor.chat}?c=${encodeURIComponent(conversationId)}` : paths.vendor.chat)
const codes = (list: Order[]) => list.slice(0, 3).map((o) => o.orderCode).join(', ') + (list.length > 3 ? '…' : '')

interface TodoInput {
  orders: Order[]
  conversations: VendorConversation[]
  packages: VendorPackage[]
  statements: CommissionStatementSummary[]
}

/** Việc cần làm, mục nào cũng dẫn tới đúng chỗ xử lý (một việc thì mở thẳng, nhiều việc thì mở danh sách đã lọc). */
export function todoItems({ orders, conversations, packages, statements }: TodoInput): TodoItem[] {
  const today = todayVN()
  const items: TodoItem[] = []

  // Khách yêu cầu chỉnh sửa (trước cọc): sửa và gửi lại
  const revision = orders.filter((o) => o.status === 'NeedRevision')
  if (revision.length) {
    const o = one(revision)
    items.push({ key: 'revision', count: revision.length, label: 'đơn khách yêu cầu chỉnh sửa', hint: codes(revision), href: o ? chatHref(o.conversationId) : ordersHref('status=NeedRevision'), urgent: true })
  }

  // Đơn đã qua ngày thực hiện: đánh dấu hoàn thành (hệ thống tự hoàn thành sau 7 ngày)
  const toComplete = orders.filter((o) => o.status === 'Deposited' && eventPassed(o))
  if (toComplete.length) {
    const o = one(toComplete)
    items.push({ key: 'complete', count: toComplete.length, label: 'đơn cần đánh dấu hoàn thành', hint: codes(toComplete), href: o ? orderHref(o) : ordersHref(`status=Deposited&to=${addDaysYmd(today, -1)}`) })
  }

  // Đơn chờ khách cọc; gấp khi còn dưới 6 giờ
  const pending = orders.filter((o) => o.status === 'Pending')
  if (pending.length) {
    const o = one(pending)
    const urgent = pending.some((x) => (msToDeadline(x) ?? Infinity) < URGENT_HOURS * HOUR)
    items.push({ key: 'pending', count: pending.length, label: 'đơn chờ khách đặt cọc', hint: codes(pending), href: o ? orderHref(o) : ordersHref('status=Pending'), urgent })
  }

  const drafts = orders.filter((o) => o.status === 'Draft')
  if (drafts.length) {
    const o = one(drafts)
    items.push({ key: 'drafts', count: drafts.length, label: 'bản nháp đơn chưa gửi', hint: codes(drafts), href: o ? chatHref(o.conversationId) : paths.vendor.chat })
  }

  const unread = conversations.filter((c) => c.unreadCount > 0)
  if (unread.length) {
    const c = one(unread)
    items.push({ key: 'unread', count: unread.length, label: 'hội thoại chưa đọc', hint: `${unread.reduce((s, x) => s + x.unreadCount, 0)} tin mới`, href: chatHref(c?.id) })
  }

  const waiting = packages.filter((p) => p.status === 'PENDING')
  if (waiting.length) {
    items.push({ key: 'packages', count: waiting.length, label: 'gói dịch vụ đang chờ duyệt', hint: waiting.slice(0, 2).map((p) => p.name).join(', '), href: `${paths.vendor.catalog}?status=PENDING` })
  }

  // Hoa hồng của kỳ đã chốt còn phải trả, hạn gần nhất trước
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

/** Đơn đã cọc sắp diễn ra (ngày thực hiện từ hôm nay), gần nhất trước. */
export function upcomingOrders(orders: Order[], limit = 5) {
  const today = todayVN()
  return orders
    .filter((o) => isUpcoming(o, today))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .slice(0, limit)
    .map((o) => ({ order: o, daysLeft: Math.round((Date.parse(o.eventDate) - Date.parse(today)) / 86_400_000) }))
}

/** Đơn gửi gần đây (theo ngày tạo, bỏ bản nháp). */
export function recentOrders(orders: Order[], limit = 6) {
  return orders
    .filter((o) => o.status !== 'Draft')
    .sort((a, b) => b.createdDate.localeCompare(a.createdDate))
    .slice(0, limit)
}

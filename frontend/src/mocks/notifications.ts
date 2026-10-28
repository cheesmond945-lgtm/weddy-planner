import type { AppNotification } from '@/types/notification'
import { mockVendorOrders } from './vendorOrders'

/*
 * Thông báo giả của NCC: dựng lại mỗi lần đọc từ hội thoại và đơn của dữ liệu giả (mocks/vendorOrders.ts), nên "Giả lập khách"
 * nhắn tin hoặc đặt cọc sẽ sinh thông báo mới. Chỉ phần đã đọc được lưu (localStorage).
 */
const KEY = 'weddy.mock.notifications.read'

function readSet(userId: string): Set<string> {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string[]>
    return new Set(all[userId] ?? [])
  } catch {
    return new Set()
  }
}

function saveSet(userId: string, ids: Set<string>) {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Record<string, string[]>
    all[userId] = [...ids]
    localStorage.setItem(KEY, JSON.stringify(all))
  } catch {
    // bỏ qua
  }
}

const ORDER_EVENTS: Record<string, { type: string; title: string; text: (code: string) => string } | undefined> = {
  Deposited: { type: 'OrderDeposited', title: 'Đơn đã được đặt cọc', text: (c) => `Đơn ${c} đã được đặt cọc.` },
  NeedRevision: { type: 'OrderRevisionRequested', title: 'Khách yêu cầu chỉnh sửa đơn', text: (c) => `Khách yêu cầu chỉnh sửa đơn ${c}.` },
  Expired: { type: 'OrderExpired', title: 'Đơn dịch vụ đã hết hạn đặt cọc', text: (c) => `Đơn ${c} đã hết hạn đặt cọc.` },
  Completed: { type: 'OrderCompleted', title: 'Đơn dịch vụ đã hoàn thành', text: (c) => `Đơn ${c} đã hoàn thành.` },
  Cancelled: { type: 'OrderCancelled', title: 'Đơn dịch vụ đã bị hủy', text: (c) => `Đơn ${c} đã bị hủy.` },
}

function build(userId: string): AppNotification[] {
  const read = readSet(userId)
  const out: AppNotification[] = []
  for (const c of mockVendorOrders.listConversations(userId)) {
    const at = c.lastMessage?.sentDate ?? new Date().toISOString()
    if (c.lastMessage?.sender === 'COUPLE') {
      const id = `msg-${c.id}-${at}`
      out.push({ id, type: 'NewMessage', title: `Tin nhắn mới từ ${c.customer.name}`, content: c.lastMessage.content, referenceType: 'Conversation', referenceId: c.id, isRead: read.has(id) || c.unreadCount === 0, readDate: null, createdDate: at })
    }
    const o = c.latestOrder
    const ev = o && ORDER_EVENTS[o.status]
    if (o && ev) {
      const id = `ord-${o.id}-${o.status}`
      out.push({ id, type: ev.type, title: ev.title, content: ev.text(o.orderCode), referenceType: 'Order', referenceId: o.id, isRead: read.has(id), readDate: null, createdDate: at })
    }
  }
  return out.sort((a, b) => b.createdDate.localeCompare(a.createdDate))
}

export const mockNotifications = {
  list: (userId: string, limit: number) => build(userId).slice(0, limit),
  unreadCount: (userId: string) => build(userId).filter((n) => !n.isRead).length,
  markRead(userId: string, id: string) {
    const s = readSet(userId)
    s.add(id)
    saveSet(userId, s)
    return null
  },
  markAllRead(userId: string) {
    const s = readSet(userId)
    const list = build(userId).filter((n) => !n.isRead)
    list.forEach((n) => s.add(n.id))
    saveSet(userId, s)
    return { updated: list.length }
  },
}

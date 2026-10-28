import { orderPageHref } from '@/features/vendorOrders/calc'
import { paths } from '@/routes/paths'
import type { AppNotification } from '@/types/notification'

const orderCode = (n: AppNotification) => /\bDH\d{6,}\b/.exec(`${n.content} ${n.title}`)?.[0]

/** Nội dung hiển thị của một thông báo phía NCC: dòng chính, dòng phụ (nếu có). */
export function describeVendorNotification(n: AppNotification): { text: string; detail?: string } {
  const code = orderCode(n)
  switch (n.type) {
    case 'NewMessage': {
      const name = n.title.replace(/^Tin nhắn mới từ\s*/, '').trim() || 'Khách hàng'
      return { text: `${name} nhắn tin: ${n.content}` }
    }
    case 'OrderDeposited':
      return { text: code ? `Khách đã thanh toán cọc đơn ${code}` : n.content }
    case 'OrderRevisionRequested': {
      // Nội dung gốc: Khách yêu cầu chỉnh sửa đơn DH…: Đổi số lượng · lời nhắn
      const detail = n.content.replace(/^[^:]*:\s*/, '')
      return { text: code ? `Khách yêu cầu chỉnh sửa đơn ${code}` : n.title, detail: detail && detail !== n.content ? detail : undefined }
    }
    case 'OrderExpired':
      return { text: code ? `Đơn ${code} đã hết hạn đặt cọc` : n.content }
    case 'OrderCompleted':
      return { text: code ? `Đơn ${code} đã hoàn thành` : n.content }
    default:
      return { text: n.title, detail: n.content }
  }
}

/** Nơi mở khi bấm thông báo phía NCC: hội thoại hoặc đơn; không biết thì null. */
export function vendorNotificationHref(n: AppNotification): string | null {
  if (!n.referenceId) return null
  if (n.referenceType === 'Conversation') return `${paths.vendor.chat}?c=${encodeURIComponent(n.referenceId)}`
  if (n.referenceType === 'Order') return orderPageHref(n.referenceId)
  return null
}

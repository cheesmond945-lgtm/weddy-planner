import type { BadgeTone } from '@/components/Badge'
import { cn } from '@/lib/utils'
import type { VendorConversation } from '@/types/vendorChat'

/** Chữ viết tắt của cặp đôi: "Hồng Nhung & Tuấn Kiệt" -> "HN" (như prototype NCC). */
export function PersonAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <span aria-hidden className={cn('grid size-[46px] flex-none place-items-center rounded-full border border-line-strong bg-accent-soft text-[13px] font-semibold text-gold-ink', className)}>
      {initials}
    </span>
  )
}

/**
 * Nhãn ngắn trạng thái đơn mới nhất của hội thoại (pill cạnh tên khách):
 * Chờ khách xác nhận, Cần sửa, Chờ cọc, Đã cọc, Đã hủy; chưa có đơn đã gửi mà có bản nháp thì "Bản nháp".
 */
export function conversationBadge(c: Pick<VendorConversation, 'latestOrder' | 'hasDraftOrder'>): { label: string; tone: BadgeTone } | null {
  const o = c.latestOrder
  if (!o) return c.hasDraftOrder ? { label: 'Bản nháp', tone: 'neutral' } : null
  switch (o.status) {
    case 'AWAITING_CONFIRMATION':
      return { label: 'Chờ khách xác nhận', tone: 'wait' }
    case 'REVISION_REQUESTED':
      return { label: 'Cần sửa', tone: 'warn' }
    case 'CANCELLED':
      return { label: 'Đã hủy', tone: 'warn' }
    case 'CONFIRMED':
      if (o.paymentStatus === 'OVERPAID') return { label: 'Thu thừa', tone: 'warn' }
      return o.paymentStatus === 'UNPAID' || o.paymentStatus === 'AWAITING_DEPOSIT' ? { label: 'Chờ cọc', tone: 'wait' } : { label: 'Đã cọc', tone: 'done' }
    default:
      return c.hasDraftOrder ? { label: 'Bản nháp', tone: 'neutral' } : null
  }
}

/** Dòng tóm tắt tin cuối trong danh sách hội thoại (như prototype NCC). */
export function lastMessagePreview(m: VendorConversation['lastMessage']) {
  if (!m) return ''
  const mine = m.sender === 'VENDOR' ? 'Bạn: ' : ''
  const code = m.orderCode ?? ''
  switch (m.type) {
    case 'ORDER':
      return `${mine}Đơn dịch vụ ${code} · v${m.orderVersion}`
    case 'ORDER_RESENT':
      return `Đã gửi lại ${code} · v${m.orderVersion}`
    case 'ORDER_REVISION_REQUESTED':
      return `Yêu cầu chỉnh sửa ${code}`
    case 'ORDER_CONFIRMED':
      return `Khách xác nhận ${code}`
    case 'PAYMENT_RECORDED':
      return m.text
    case 'ADJUSTMENT_PROPOSED':
      return `Phương án điều chỉnh ${code}`
    case 'ADJUSTMENT_REQUESTED':
      return `Khách yêu cầu điều chỉnh ${code}`
    case 'ADJUSTMENT_REVISION_REQUESTED':
      return `Khách yêu cầu sửa phương án ${code}`
    case 'ADJUSTMENT_ACCEPTED':
      return `Khách đồng ý điều chỉnh ${code}`
    case 'ORDER_CANCELLED':
      return `Đã hủy đơn ${code}`
    default:
      return `${mine}${m.text}`
  }
}

import type { BadgeTone } from '@/components/Badge'
import { cn } from '@/lib/utils'
import type { VendorConversation } from '@/types/vendorConversation'

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
 * Chờ cọc, Cần sửa, Đã cọc, Hoàn thành, Hết hạn, Đã hủy; chưa gửi đơn nào mà có nháp thì "Bản nháp".
 */
export function conversationBadge(c: Pick<VendorConversation, 'latestOrder' | 'hasDraftOrder'>): { label: string; tone: BadgeTone } | null {
  const o = c.latestOrder
  if (!o) return c.hasDraftOrder ? { label: 'Bản nháp', tone: 'neutral' } : null
  switch (o.status) {
    case 'Pending':
      return { label: 'Chờ cọc', tone: 'wait' }
    case 'NeedRevision':
      return { label: 'Cần sửa', tone: 'warn' }
    case 'Deposited':
      return { label: 'Đã cọc', tone: 'done' }
    case 'Completed':
      return { label: 'Hoàn thành', tone: 'info' }
    case 'Expired':
      return { label: 'Hết hạn', tone: 'neutral' }
    case 'Cancelled':
      return { label: 'Đã hủy', tone: 'warn' }
    default:
      return c.hasDraftOrder ? { label: 'Bản nháp', tone: 'neutral' } : null
  }
}

/** Dòng tóm tắt tin cuối trong danh sách hội thoại. */
export function lastMessagePreview(m: VendorConversation['lastMessage']) {
  if (!m) return ''
  const mine = m.sender === 'VENDOR' ? 'Bạn: ' : ''
  switch (m.type) {
    case 'Order':
      return `${mine}Đơn dịch vụ ${m.orderCode ?? ''}`
    case 'DepositReceipt':
    case 'FinalInvoice':
      return m.content
    default:
      return `${mine}${m.content}`
  }
}

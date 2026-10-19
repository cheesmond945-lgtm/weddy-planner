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
    <span aria-hidden className={cn('grid size-10 flex-none place-items-center rounded-full border border-line-strong bg-surface-2 text-[12.5px] font-semibold text-gold-ink', className)}>
      {initials}
    </span>
  )
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
    default:
      return `${mine}${m.text}`
  }
}

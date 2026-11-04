import type { Order } from '@/types/order'
import { useOrder } from '../hooks'
import { CoupleOrderCard } from './CoupleOrderCard'

interface OrderCardProps {
  orderId: string
  categorySlug: string
  /** Thẻ mới nhất của đơn: gửi lại thì các thẻ cũ thu gọn thành một dòng */
  isLatest: boolean
  onRevise: (order: Order) => void
  /** Nhắn tin cho NCC (đưa con trỏ về ô nhập tin) */
  onMessageVendor: () => void
}

/** Thẻ đơn dịch vụ NCC gửi trong khung chat (docs/THE_DON_PHIA_KHACH.md mục 1, 2): tải đơn, rồi vẽ bằng thẻ đơn dùng chung. */
export function OrderCard({ orderId, categorySlug, isLatest, onRevise, onMessageVendor }: OrderCardProps) {
  const { data: o } = useOrder(orderId, { poll: isLatest })

  if (!o) return <div className="h-[230px] w-[min(360px,100%)] animate-pulse self-start rounded-[22px] bg-muted" />
  if (o.status === 'Draft') return null
  if (!isLatest) {
    return <p className="self-center rounded-pill bg-bg px-3.5 py-1.5 text-center text-[12.5px] text-muted-foreground">Đơn {o.orderCode} đã được cập nhật, xem bản mới nhất bên dưới</p>
  }
  return <CoupleOrderCard order={o} variant="chat" categorySlug={categorySlug} onRevise={onRevise} onMessageVendor={onMessageVendor} />
}

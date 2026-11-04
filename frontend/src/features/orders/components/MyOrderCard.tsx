import type { Order } from '@/types/order'
import { CoupleOrderCard } from './CoupleOrderCard'

/** Một đơn trên trang Kế hoạch của tôi (dưới hạng mục của đơn): cùng thẻ đơn với khung chat, kèm nút mở cuộc trò chuyện với NCC. */
export function MyOrderCard({ order, onRevise }: { order: Order; onRevise: (o: Order) => void }) {
  return <CoupleOrderCard order={order} variant="plan" onRevise={onRevise} />
}

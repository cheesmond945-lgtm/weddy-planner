import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import type { Order } from '@/types/order'
import { MyOrderCard } from './MyOrderCard'

const closed = (o: Order) => o.status === 'Expired' || o.status === 'Cancelled'

/**
 * Đơn của một hạng mục trên trang Kế hoạch của tôi (mới nhất trước). Đơn hết hạn / đã hủy thu gọn sau nút "Xem …"
 * để hạng mục không dài khi NCC đã tạo lại đơn nhiều lần.
 */
export function CategoryOrders({ orders, onRevise }: { orders: Order[]; onRevise: (o: Order) => void }) {
  const [showClosed, setShowClosed] = useState(false)
  if (!orders.length) return null
  const open = orders.filter((o) => !closed(o))
  const old = orders.filter(closed)
  const shown = showClosed ? orders : open

  return (
    <div className="mt-3">
      <h3 className="mb-2 font-sans text-[13px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">Đơn hàng ({orders.length})</h3>
      {shown.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3.5 max-sm:grid-cols-1">
          {shown.map((o) => (
            <MyOrderCard key={o.id} order={o} onRevise={onRevise} />
          ))}
        </div>
      )}
      {old.length > 0 && (
        <button
          type="button"
          aria-expanded={showClosed}
          onClick={() => setShowClosed((s) => !s)}
          className="mt-2 inline-flex items-center gap-1 text-[13px] text-muted-foreground hover:text-ink"
        >
          <ChevronDown className={cn('size-4 transition-transform', showClosed && 'rotate-180')} />
          {showClosed ? 'Ẩn đơn hết hạn, đã hủy' : `Xem ${old.length} đơn hết hạn, đã hủy`}
        </button>
      )}
    </div>
  )
}

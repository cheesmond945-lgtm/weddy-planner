import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/Badge'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { depositDeadline } from '@/features/vendorOrders/calc'
import { ORDER_STATUS } from '@/features/vendorOrders/constants'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order } from '@/types/order'
import { MyOrderCard } from './MyOrderCard'

const closed = (o: Order) => o.status === 'Expired' || o.status === 'Cancelled'

/**
 * Đơn của một hạng mục trên trang Kế hoạch của tôi (mới nhất trước): mỗi đơn một dòng gọn (mã đơn, trạng thái, tổng tiền,
 * hạn cọc nếu đang chờ cọc), bấm "Xem chi tiết đơn hàng" mở popup có thẻ đơn đầy đủ (thanh toán cọc, yêu cầu chỉnh sửa, hóa đơn,
 * nhắn NCC). Đơn hết hạn / đã hủy thu gọn sau nút "Xem …" để hạng mục không dài khi NCC đã tạo lại đơn nhiều lần.
 */
export function CategoryOrders({ orders, onRevise }: { orders: Order[]; onRevise: (o: Order) => void }) {
  const [showClosed, setShowClosed] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  if (!orders.length) return null
  const open = orders.filter((o) => !closed(o))
  const old = orders.filter(closed)
  const shown = showClosed ? orders : open
  // Lấy theo id để popup luôn là dữ liệu mới nhất sau khi thanh toán / chỉnh sửa
  const opened = orders.find((o) => o.id === openId) ?? null

  return (
    <div className="mt-3">
      <h3 className="mb-2 font-sans text-[13px] font-semibold tracking-[0.04em] text-muted-foreground uppercase">Đơn hàng ({orders.length})</h3>
      {shown.length > 0 && (
        <ul className="flex flex-col gap-2">
          {shown.map((o) => (
            <li key={o.id}>
              <OrderRow order={o} onOpen={() => setOpenId(o.id)} />
            </li>
          ))}
        </ul>
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
      {/* Popup chi tiết: thẻ đơn đầy đủ; nút đóng của khung nằm trong góc thẻ */}
      <Dialog open={!!opened} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-[480px] border-0 bg-transparent p-0 [&>button:last-child]:top-4 [&>button:last-child]:right-4">
          <DialogTitle className="sr-only">Chi tiết đơn hàng</DialogTitle>
          <DialogDescription className="sr-only">Thông tin, thanh toán và thao tác của đơn dịch vụ</DialogDescription>
          {opened && <MyOrderCard order={opened} onRevise={(x) => (setOpenId(null), onRevise(x))} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}

/** Một dòng đơn: mã đơn, trạng thái, tổng tiền; đang chờ cọc thì kèm hạn cọc (để không bị bỏ sót khi chi tiết nằm trong popup) */
function OrderRow({ order: o, onOpen }: { order: Order; onOpen: () => void }) {
  const status = ORDER_STATUS[o.status]
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface px-4 py-3 text-left text-sm transition-colors hover:border-primary"
    >
      <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="font-semibold">Đơn {o.orderCode}</span>
      <Badge tone={status.tone}>{status.label}</Badge>
      {/* Ghi rõ "Tổng" để không nhầm với tiền cọc (con số đứng ngay sau nhãn "Đã đặt cọc"); đã cọc thì ghi thêm số đã cọc */}
      <span className="text-muted-foreground">
        Tổng <b className="font-medium text-ink tabular-nums">{formatMoney(o.totalAmount)}</b>
      </span>
      {(o.status === 'Deposited' || o.status === 'Completed') && o.depositAmount > 0 && (
        <span className="text-muted-foreground">
          · đã cọc <b className="font-medium text-ink tabular-nums">{formatMoney(o.depositAmount)}</b>
        </span>
      )}
      {o.status === 'Pending' && o.depositDueDate && <span className="text-[13px] text-warn">{depositDeadline(o.depositDueDate)}</span>}
      <span className="ml-auto inline-flex items-center gap-0.5 text-[13px] font-medium text-gold-700 group-hover:underline">
        Xem chi tiết đơn hàng
        <ChevronRight className="size-4" aria-hidden />
      </span>
    </button>
  )
}

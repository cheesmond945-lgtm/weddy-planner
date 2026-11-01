import { ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { assignHues, hueOf, shortCouple } from '@/features/calendar/orderColors'
import { daysBetween, formatDate, parseDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Order, OrderProgress } from '@/types/vendorOrder'
import { ORDER_STATUS } from '../constants'
import { OrderProgressPanel } from './OrderProgressPanel'

/** Đơn đang theo dõi trên lịch: chờ cọc, chờ chỉnh sửa, đã cọc. */
export const ACTIVE_STATUSES: readonly Order['status'][] = ['Pending', 'NeedRevision', 'Deposited']

/** Màu của đơn (hue) từ danh sách đơn: đơn đang theo dõi không trùng màu, đơn cũ giữ màu khi có đơn mới. */
export const useHues = (orders: readonly Order[]) => {
  const map = useMemo(() => assignHues(orders.map((o) => ({ id: o.id, orderCode: o.orderCode, active: ACTIVE_STATUSES.includes(o.status) }))), [orders])
  return useMemo(() => (id: string) => hueOf(map, id), [map])
}

/** "còn 12 ngày" / "hôm nay" / "đã qua 3 ngày" của ngày thực hiện. */
function countdown(eventDate: string) {
  const d = daysBetween(today(), parseDate(eventDate))
  if (d === 0) return 'hôm nay'
  return d > 0 ? `còn ${d} ngày` : `đã qua ${-d} ngày`
}

function OrderCardRow({ order, progress, hue }: { order: Order; progress?: OrderProgress; hue: number }) {
  const [open, setOpen] = useState(false)
  const status = ORDER_STATUS[order.status]
  const active = order.status === 'Deposited'
  const pct = progress && progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  const late = progress?.overdueVendor ?? 0
  const soon = progress?.dueSoonVendor ?? 0
  return (
    <li className={cn('overflow-hidden rounded-xl border bg-surface shadow-card', late > 0 ? 'border-warn/60' : 'border-line')} style={{ boxShadow: `inset 4px 0 0 hsl(${hue} 60% 48%)` }}>
      <div className="px-4 py-3 pl-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]">{shortCouple(order.customerName)}</p>
            <p className="text-[12.5px] text-muted-foreground [overflow-wrap:anywhere]">
              {order.customerName} · {order.orderCode}
            </p>
          </div>
          <span className="flex flex-wrap items-center gap-1.5">
            <Badge tone={status.tone}>{status.label}</Badge>
            {late > 0 && <Badge tone="warn">Trễ tiến độ · {late}</Badge>}
            {soon > 0 && <Badge tone="wait">Sắp đến hạn · {soon}</Badge>}
          </span>
        </div>

        <p className="mt-2 text-[13px] text-muted-foreground">
          Thực hiện <b className="font-semibold text-ink">{formatDate(order.eventDate)}</b> · {countdown(order.eventDate)}
        </p>

        {active && progress ? (
          <>
            <div className="mt-2.5 flex items-center gap-2.5">
              <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Tiến độ đơn ${order.orderCode}`} className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-sage transition-[width]" style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[12.5px] font-semibold text-muted-foreground tabular-nums">
                {progress.done}/{progress.total} việc
              </span>
            </div>
            <p className="mt-2 text-[13px]">
              {progress.next ? (
                <>
                  <span className="text-muted-foreground">Tiếp theo:</span> <span className="font-medium">{progress.next.title}</span> <span className={cn('text-muted-foreground', progress.next.due < toISODate(today()) && 'font-semibold text-warn')}>(hạn {formatDate(progress.next.due)})</span>
                </>
              ) : progress.open > 0 ? (
                <span className="text-muted-foreground">Đang chờ khách thực hiện {progress.open} việc.</span>
              ) : (
                <span className="text-sage">Đã xong mọi việc.</span>
              )}
            </p>
          </>
        ) : (
          <p className="mt-2 text-[13px] text-muted-foreground">{order.status === 'Pending' ? 'Chờ khách thanh toán cọc.' : order.status === 'NeedRevision' ? 'Chờ bạn cập nhật đơn theo yêu cầu của khách.' : ''}</p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {active && progress && progress.total > 0 && (
            <Button variant="outline" size="sm" className="border-line-strong" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
              {open ? 'Thu gọn việc' : `Xem ${progress.open} việc chưa xong`}
              <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="border-line-strong">
            <Link to={`${paths.vendor.orders}?order=${order.id}`}>Xem đơn</Link>
          </Button>
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-surface-2/50 px-4 py-3 pl-5">
          <OrderProgressPanel orderId={order.id} />
        </div>
      )}
    </li>
  )
}

/**
 * Chế độ "Theo đơn" của Lịch làm việc: mỗi đơn đang theo dõi một thẻ có màu riêng, tiến độ, việc trễ, việc tiếp theo và ngày thực hiện
 * còn bao lâu. Đơn có việc của NCC bị trễ lên trước, rồi theo ngày thực hiện gần nhất. Mở rộng để tick việc.
 */
export function OrderBoard({ orders, progress, hueFor }: { orders: readonly Order[]; progress: Record<string, OrderProgress> | undefined; hueFor: (id: string) => number }) {
  const rows = orders
    .filter((o) => ACTIVE_STATUSES.includes(o.status))
    .sort((a, b) => (progress?.[b.id]?.overdueVendor ?? 0) - (progress?.[a.id]?.overdueVendor ?? 0) || a.eventDate.localeCompare(b.eventDate))
  if (!rows.length) return <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-muted-foreground">Chưa có đơn nào đang theo dõi.</p>
  return (
    <ul className="grid gap-3.5 lg:grid-cols-2">
      {rows.map((o) => (
        <OrderCardRow key={o.id} order={o} progress={progress?.[o.id]} hue={hueFor(o.id)} />
      ))}
    </ul>
  )
}

import { CalendarDays, MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { orderPageHref } from '@/features/vendorOrders/calc'
import { OrderStatusBadge } from '@/features/vendorOrders/components/OrderBadges'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Order } from '@/types/vendorOrder'
import type { upcomingOrders } from '../summary'

function Block({ title, link, children }: { title: string; link?: ReactNode; children: ReactNode }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-portal">
      <div className="flex items-center justify-between gap-3 px-5 py-[18px]">
        <h2 className="font-sans text-[15px] font-semibold tracking-normal">{title}</h2>
        {link}
      </div>
      {children}
    </section>
  )
}

const seeAll = (
  <Link to={paths.vendor.orders} className="text-[13px] font-medium whitespace-nowrap text-gold-ink hover:underline">
    Xem tất cả →
  </Link>
)
const th = 'border-y border-line bg-surface-2 px-3 py-[11px] text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-5 last:pr-5'
const td = 'border-b border-line px-3 py-3.5 align-middle text-[13.5px] first:pl-5 last:pr-5'

/** Đơn gửi gần đây (bảng trong prototype NCC); bấm dòng mở chi tiết đơn ở Quản lý đơn hàng. */
export function RecentOrders({ orders }: { orders: Order[] }) {
  const navigate = useNavigate()
  return (
    <Block title="Đơn gửi gần đây" link={orders.length > 0 && seeAll}>
      {orders.length ? (
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Mã đơn</th>
                <th className={th}>Khách</th>
                <th className={th}>Ngày thực hiện</th>
                <th className={cn(th, 'text-right')}>Tổng</th>
                <th className={th}>Trạng thái đơn</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} onClick={() => navigate(orderPageHref(o.id))} className="cursor-pointer transition-colors last:[&>td]:border-b-0 hover:bg-surface-2">
                  <td className={cn(td, 'font-semibold whitespace-nowrap tabular-nums')}>
                    <Link to={orderPageHref(o.id)} onClick={(e) => e.stopPropagation()} className="hover:text-gold-ink">
                      {o.orderCode}
                    </Link>
                  </td>
                  <td className={cn(td, 'min-w-[140px] font-medium')}>{o.customerName}</td>
                  <td className={cn(td, 'whitespace-nowrap')}>{formatDate(o.eventDate)}</td>
                  <td className={cn(td, 'text-right font-semibold whitespace-nowrap tabular-nums')}>{formatMoney(o.totalAmount)}</td>
                  <td className={td}>
                    <OrderStatusBadge status={o.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          className="border-0"
          title="Chưa có đơn đã gửi"
          description="Tạo đơn ngay trong cuộc trò chuyện với khách."
          action={
            <Link to={paths.vendor.chat} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-gold-ink hover:underline">
              <MessageSquare className="size-4" />
              Mở Tin nhắn
            </Link>
          }
        />
      )}
    </Block>
  )
}

/** Đơn đã cọc sắp diễn ra theo ngày thực hiện gần nhất. */
export function UpcomingOrders({ items }: { items: ReturnType<typeof upcomingOrders> }) {
  return (
    <Block title="Đơn sắp diễn ra">
      {items.length ? (
        <ul className="border-t border-line">
          {items.map(({ order: o, daysLeft }) => (
            <li key={o.id} className="border-b border-line last:border-b-0">
              <Link to={orderPageHref(o.id)} className="flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-surface-2">
                <span className={cn('grid w-14 flex-none justify-items-center rounded-sm py-1.5 leading-tight', daysLeft <= 7 ? 'bg-warn-soft text-warn' : 'bg-gold-soft text-gold-ink')}>
                  <b className="text-lg tabular-nums">{o.eventDate.slice(8, 10)}</b>
                  <span className="text-[11px]">Th{Number(o.eventDate.slice(5, 7))}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium">
                    {o.orderCode} · {o.customerName}
                  </span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {daysLeft === 0 ? 'Hôm nay' : `Còn ${daysLeft} ngày`} · đã cọc {formatMoney(o.depositAmount)}, còn lại {formatMoney(o.totalAmount - o.depositAmount)} thu trực tiếp
                  </span>
                </span>
                <OrderStatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 border-t border-line px-5 py-5 text-[13.5px] text-muted-foreground">
          <CalendarDays className="size-4" />
          Chưa có đơn đã cọc sắp diễn ra.
        </p>
      )}
    </Block>
  )
}

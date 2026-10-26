import { CalendarCheck, CheckCheck, Clock, Wallet } from 'lucide-react'
import { StatCard } from '@/features/commissions/components/StatCard'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderListQuery } from '@/types/vendorOrder'
import type { orderTiles } from '../summary'

type Tiles = ReturnType<typeof orderTiles>
type Patch = Partial<Pick<OrderListQuery, 'status' | 'from' | 'to'>>

interface OrderTilesProps {
  tiles: Tiles
  query: OrderListQuery
  onFilter: (patch: Patch) => void
}

const same = (q: OrderListQuery, f: Patch) => q.status === f.status && (q.from ?? undefined) === f.from && (q.to ?? undefined) === f.to

/**
 * Bốn thẻ số liệu đầu trang Quản lý đơn hàng; bấm thẻ thì lọc danh sách tương ứng, bấm lần nữa để bỏ lọc.
 */
export function OrderTiles({ tiles: t, query, onFilter }: OrderTilesProps) {
  const items = [
    {
      key: 'pending',
      filter: t.filters.pending,
      card: (
        <StatCard icon={Clock} label="Đơn đang chờ cọc" value={t.pending} tone={t.expiringSoon ? 'text-warn' : ''} foot={t.expiringSoon ? `${t.expiringSoon} đơn sắp hết hạn trong 24 giờ` : 'Chưa có đơn sắp hết hạn'} />
      ),
    },
    {
      key: 'upcoming',
      filter: t.filters.upcoming,
      card: <StatCard icon={CalendarCheck} label="Đã cọc, sắp thực hiện" value={t.upcoming} foot={t.upcoming ? `Trong 30 ngày tới · ${formatMoney(t.upcomingValue)}` : 'Không có đơn trong 30 ngày tới'} />,
    },
    {
      key: 'toComplete',
      filter: t.filters.toComplete,
      card: (
        <StatCard
          icon={CheckCheck}
          label="Cần đánh dấu hoàn thành"
          value={t.toComplete}
          tone={t.toComplete ? 'text-gold-ink' : ''}
          foot={t.toComplete ? 'Đã qua ngày thực hiện, chưa hoàn thành' : 'Không có đơn chờ hoàn thành'}
        />
      ),
    },
    {
      key: 'deposited',
      filter: t.filters.deposited,
      card: <StatCard icon={Wallet} label="Giá trị đơn đã cọc trong tháng" value={formatMoney(t.depositedThisMonthValue)} tone="text-sage" foot={`${t.depositedThisMonth} đơn khách đặt cọc trong tháng này`} />,
    },
  ]
  return (
    <div className="mb-[22px] grid grid-cols-4 gap-4 max-[1199px]:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-2.5">
      {items.map(({ key, filter, card }) => {
        const on = same(query, filter)
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => onFilter(on ? { status: undefined, from: undefined, to: undefined } : filter)}
            className={cn('block h-full min-w-0 rounded-md text-left transition-shadow hover:shadow-portal-lift focus-visible:outline-2 focus-visible:outline-gold/60 [&>div]:h-full', on && 'ring-2 ring-gold/55')}
          >
            {card}
          </button>
        )
      })}
    </div>
  )
}

import { CalendarCheck, CheckCheck, Clock, MessageSquareWarning } from 'lucide-react'
import { StatCard } from '@/features/commissions/components/StatCard'
import { addDaysYmd, todayVN } from '@/lib/clock'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderListQuery, OrderTilesData } from '@/types/vendorOrder'
import { UPCOMING_DAYS } from '../summary'

type Patch = Pick<OrderListQuery, 'status' | 'from' | 'to' | 'needsAction' | 'restPending'>

interface OrderTilesProps {
  /** Số liệu do backend tính trên toàn bộ đơn của NCC; chưa tải xong thì hiện khung chờ */
  tiles: OrderTilesData | undefined
  query: OrderListQuery
  onFilter: (patch: Partial<Patch>) => void
}

const CLEAR: Patch = { status: undefined, from: undefined, to: undefined, needsAction: undefined, restPending: undefined }
const same = (q: OrderListQuery, f: Patch) =>
  q.status === f.status && (q.from ?? undefined) === f.from && (q.to ?? undefined) === f.to && !!q.needsAction === !!f.needsAction && !!q.restPending === !!f.restPending

/**
 * Bốn thẻ số liệu đầu trang Quản lý đơn hàng; bấm thẻ thì lọc danh sách tương ứng, bấm lần nữa để bỏ lọc.
 * Mọi con số tính ở backend (GET /vendors/me/orders/counts) nên đúng với cả NCC có hơn 100 đơn.
 */
export function OrderTiles({ tiles: t, query, onFilter }: OrderTilesProps) {
  if (!t) return <div aria-busy="true" aria-label="Đang tải số liệu" className="mb-[22px] h-[112px] animate-pulse rounded-md bg-muted" />
  const today = todayVN()
  const items: { key: string; filter: Patch; card: React.ReactNode }[] = [
    {
      key: 'pending',
      filter: { ...CLEAR, status: 'Pending' },
      card: <StatCard icon={Clock} label="Chờ khách đặt cọc" value={t.pending} tone={t.expiringSoon ? 'text-warn' : ''} foot={t.expiringSoon ? `${t.expiringSoon} đơn hết hạn trong 24 giờ` : 'Chưa có đơn sắp hết hạn'} />,
    },
    {
      key: 'needsAction',
      filter: { ...CLEAR, needsAction: true },
      card: <StatCard icon={MessageSquareWarning} label="Cần bạn xử lý" value={t.needsAction} tone={t.needsAction ? 'text-warn' : ''} foot={t.needsAction ? 'Khách đang chờ bạn chỉnh sửa đơn' : 'Không có yêu cầu chỉnh sửa nào'} />,
    },
    {
      key: 'upcoming',
      filter: { ...CLEAR, status: 'Deposited', from: today, to: addDaysYmd(today, UPCOMING_DAYS) },
      card: <StatCard icon={CalendarCheck} label="Sắp thực hiện" value={t.upcoming} foot={t.upcoming ? `Trong ${UPCOMING_DAYS} ngày tới · ${formatMoney(t.upcomingValue)}` : `Không có đơn trong ${UPCOMING_DAYS} ngày tới`} />,
    },
    {
      key: 'dueToComplete',
      filter: { ...CLEAR, status: 'Deposited', to: addDaysYmd(today, -1) },
      card: (
        <StatCard
          icon={CheckCheck}
          label="Đến hạn hoàn tất"
          value={t.dueToComplete}
          tone={t.dueToComplete ? 'text-gold-ink' : ''}
          foot={t.dueToComplete ? `Đã qua ngày thực hiện${t.dueRestPending ? ` · ${t.dueRestPending} đơn chưa nhận tiền mặt` : ''}` : 'Không có đơn chờ hoàn tất'}
        />
      ),
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
            onClick={() => onFilter(on ? CLEAR : filter)}
            className={cn('block h-full min-w-0 rounded-md text-left transition-shadow hover:shadow-portal-lift focus-visible:outline-2 focus-visible:outline-gold/60 [&>div]:h-full', on && 'ring-2 ring-gold/55')}
          >
            {card}
          </button>
        )
      })}
    </div>
  )
}

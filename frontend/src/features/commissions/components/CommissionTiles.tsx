import { BadgeCheck, CalendarClock, CheckCheck, Hourglass } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { dueHint, formatPeriod, type commissionTiles } from '../calc'
import { StatCard } from './StatCard'

/** Bốn thẻ số liệu đầu trang Tài chính & đối soát. */
export function CommissionTiles({ tiles: t }: { tiles: ReturnType<typeof commissionTiles> }) {
  const c = t.current
  return (
    <div className="mb-[22px] grid grid-cols-4 gap-4 max-[1199px]:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-2.5">
      <StatCard
        icon={Hourglass}
        label="Kỳ hiện tại đang tạm tính"
        value={formatMoney(c?.totalAmount ?? 0)}
        foot={c ? `Tháng ${formatPeriod(c.periodMonth)} · ${c.totalOrders} đơn hoàn tất` : 'Chưa có đơn hoàn tất'}
      />
      <StatCard
        icon={CalendarClock}
        label="Cần nộp"
        value={formatMoney(t.dueAmount)}
        tone={t.overdue ? 'text-warn' : t.dueAmount ? 'text-gold-ink' : 'text-sage'}
        foot={t.nextDue ? `${t.due.length > 1 ? `${t.due.length} kỳ · ` : ''}${dueHint(t.nextDue)}` : 'Không có khoản cần nộp'}
      />
      <StatCard icon={BadgeCheck} label="Đã nộp năm nay" value={formatMoney(t.paidThisYear)} tone="text-sage" foot={t.paidCount ? `${t.paidCount} kỳ đã nộp` : 'Chưa nộp kỳ nào trong năm'} />
      <StatCard
        icon={CheckCheck}
        label="Đơn hoàn tất tháng này"
        value={c?.totalOrders ?? 0}
        foot={c?.totalOrders ? 'Hoa hồng cộng dồn vào kỳ hiện tại' : 'Hoàn tất đơn để phát sinh hoa hồng'}
      />
    </div>
  )
}

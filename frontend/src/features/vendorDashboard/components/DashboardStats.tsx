import { CalendarCheck, CheckCheck, ClipboardList, Percent } from 'lucide-react'
import { StatCard } from '@/features/commissions/components/StatCard'
import { formatPeriod } from '@/features/commissions/calc'
import { formatMoney } from '@/lib/format'
import type { CommissionStatement } from '@/types/commission'
import type { orderStats } from '../summary'

interface DashboardStatsProps {
  stats: ReturnType<typeof orderStats>
  /** Kỳ hiện tại (OPEN) của bảng kê, cùng số với trang Tài chính & đối soát */
  currentCommission: CommissionStatement | undefined
}

/** Bốn thẻ số liệu đầu trang (kpi-grid trong prototype NCC). */
export function DashboardStats({ stats: s, currentCommission: c }: DashboardStatsProps) {
  return (
    <div className="mb-[26px] grid grid-cols-4 gap-4 max-[1100px]:grid-cols-2 max-sm:grid-cols-1 max-sm:gap-2.5">
      <StatCard
        icon={ClipboardList}
        label="Đơn đang xử lý"
        value={s.inProgress}
        tone={s.revision ? 'text-warn' : ''}
        foot={`${s.pending} chờ cọc · ${s.revision} cần sửa · ${s.deposited} đã cọc`}
      />
      <StatCard
        icon={CalendarCheck}
        label="Đã cọc, sắp thực hiện"
        value={s.upcoming}
        tone="text-sage"
        foot={s.upcoming ? `Tổng giá trị ${formatMoney(s.upcomingValue)}` : 'Chưa có đơn sắp thực hiện'}
      />
      <StatCard
        icon={CheckCheck}
        label="Cần đánh dấu hoàn thành"
        value={s.toComplete}
        tone={s.toComplete ? 'text-gold-ink' : ''}
        foot={s.toComplete ? 'Đã qua ngày thực hiện, chưa hoàn thành' : 'Không có đơn chờ hoàn thành'}
      />
      <StatCard
        icon={Percent}
        label="Hoa hồng kỳ hiện tại"
        value={formatMoney(c?.totalAmount ?? 0)}
        foot={c ? `Tạm tính kỳ ${formatPeriod(c.periodMonth)} · ${c.totalOrders} đơn hoàn thành` : 'Chưa có bảng kê'}
      />
    </div>
  )
}

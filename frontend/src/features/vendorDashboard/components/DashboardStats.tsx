import { ClipboardList, Percent, Receipt, Wallet } from 'lucide-react'
import { StatCard } from '@/features/commissions/components/StatCard'
import { formatPeriod } from '@/features/commissions/constants'
import { formatMoney } from '@/lib/format'
import type { CommissionStatementSummary } from '@/types/commission'
import type { orderStats } from '../summary'

interface DashboardStatsProps {
  stats: ReturnType<typeof orderStats>
  /** Kỳ hiện tại (OPEN) của bảng kê, cùng số với trang Tài chính & đối soát */
  currentCommission: CommissionStatementSummary | undefined
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
        foot={`${s.awaiting} chờ khách xác nhận · ${s.revision} cần sửa · ${s.awaitingDeposit} chờ cọc`}
      />
      <StatCard icon={Wallet} label="Đã thu thực tế trong tháng" value={formatMoney(s.collectedThisMonth)} tone="text-sage" foot={`Tổng đã thu: ${formatMoney(s.collectedTotal)}`} />
      <StatCard
        icon={Receipt}
        label="Còn phải thu"
        value={formatMoney(s.receivable)}
        tone={s.receivable ? 'text-gold-ink' : ''}
        foot={s.receivableOrders ? `trên ${s.receivableOrders} đơn đã xác nhận` : 'không còn khoản phải thu'}
      />
      <StatCard
        icon={Percent}
        label="Hoa hồng kỳ hiện tại"
        value={formatMoney(c?.commissionAmount ?? 0)}
        foot={c ? `Tạm tính kỳ ${formatPeriod(c.period)} · ${c.orderCount} đơn hoàn thành` : 'Chưa có bảng kê'}
      />
    </div>
  )
}

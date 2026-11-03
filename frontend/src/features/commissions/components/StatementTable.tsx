import { StatusBadge } from '@/features/vendorOrders/components/OrderBadges'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionStatementSummary } from '@/types/commission'
import { COMMISSION_STATUS, formatPeriod } from '../constants'

const th = 'border-y border-line bg-surface-2 px-3 py-[11px] text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-5 last:pr-5'
const td = 'border-b border-line px-3 py-[14px] align-middle text-[13.5px] first:pl-5 last:pr-5'
const num = 'text-right whitespace-nowrap tabular-nums'

/** Lịch sử đối soát theo kỳ; bấm một dòng để xem kỳ đó ở phía trên. */
export function StatementTable({ statements, selectedId, onSelect }: { statements: CommissionStatementSummary[]; selectedId: string; onSelect: (id: string) => void }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Kỳ</th>
            <th className={th}>Đơn hoàn thành</th>
            <th className={cn(th, 'text-right')}>Doanh thu</th>
            <th className={cn(th, 'text-right')}>Hoa hồng</th>
            <th className={th}>Hạn thanh toán</th>
            <th className={th}>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => {
            const active = s.id === selectedId
            return (
              <tr
                key={s.id}
                onClick={() => onSelect(s.id)}
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(s.id))}
                aria-current={active ? 'true' : undefined}
                className={cn('cursor-pointer transition-colors last:[&>td]:border-b-0 hover:bg-surface-2', active && 'bg-gold-soft/50 hover:bg-gold-soft/70')}
              >
                <td className={cn(td, 'whitespace-nowrap', active && 'shadow-[inset_3px_0_0_var(--gold)]')}>
                  <span className="font-semibold tabular-nums">{formatPeriod(s.period)}</span>
                  <span className="block text-[12px] text-muted-foreground tabular-nums">{s.code}</span>
                </td>
                <td className={cn(td, 'whitespace-nowrap')}>{s.orderCount} đơn</td>
                <td className={cn(td, num)}>{formatMoney(s.baseAmount)}</td>
                <td className={cn(td, num, 'font-semibold')}>{formatMoney(s.commissionAmount)}</td>
                <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{formatDate(s.dueDate)}</td>
                <td className={td}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge tone={COMMISSION_STATUS[s.status].tone}>{COMMISSION_STATUS[s.status].label}</StatusBadge>
                    {s.isOverdue && <StatusBadge tone="warn">Quá hạn</StatusBadge>}
                    {s.lateDays && <StatusBadge tone="warn">Trả trễ {s.lateDays} ngày</StatusBadge>}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

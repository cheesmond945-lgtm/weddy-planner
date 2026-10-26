import { StatusBadge } from '@/features/vendorOrders/components/OrderBadges'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionStatementSummary } from '@/types/commission'
import { COMMISSION_STATUS, formatPeriod, remainingOf } from '../constants'

const th = 'border-y border-line bg-surface-2 px-3 py-[11px] text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-5 last:pr-5'
const td = 'border-b border-line px-3 py-[14px] align-middle text-[13.5px] first:pl-5 last:pr-5'
const num = 'text-right whitespace-nowrap tabular-nums'

/** Danh sách đối soát theo kỳ (data-table trong prototype NCC). */
export function StatementTable({ statements, onOpen }: { statements: CommissionStatementSummary[]; onOpen: (id: string) => void }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={th}>Mã</th>
            <th className={th}>Kỳ</th>
            <th className={th}>Đơn hoàn thành</th>
            <th className={cn(th, 'text-right')}>Đã thu (căn cứ)</th>
            <th className={cn(th, 'text-right')}>Hoa hồng</th>
            <th className={cn(th, 'text-right')}>Đã xác nhận</th>
            <th className={cn(th, 'text-right')}>Còn trả</th>
            <th className={th}>Trạng thái</th>
            <th className={th}>
              <span className="sr-only">Thao tác</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {statements.map((s) => (
            <tr key={s.id} className="transition-colors last:[&>td]:border-b-0 hover:bg-surface-2">
              <td className={cn(td, 'font-semibold whitespace-nowrap tabular-nums')}>{s.code}</td>
              <td className={cn(td, 'whitespace-nowrap')}>{formatPeriod(s.period)}</td>
              <td className={cn(td, 'whitespace-nowrap')}>
                {s.orderCount} đơn
                {s.supplementCount > 0 && <span className="block text-[12.5px] text-muted-foreground">+ {s.supplementCount} khoản bổ sung</span>}
              </td>
              <td className={cn(td, num)}>{formatMoney(s.baseAmount)}</td>
              <td className={cn(td, num)}>{formatMoney(s.commissionAmount)}</td>
              <td className={cn(td, num)}>{formatMoney(s.paidAmount)}</td>
              <td className={cn(td, num, 'font-semibold')}>{formatMoney(remainingOf(s))}</td>
              <td className={td}>
                <span className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge tone={COMMISSION_STATUS[s.status].tone}>{COMMISSION_STATUS[s.status].label}</StatusBadge>
                  {s.isOverdue && <StatusBadge tone="warn">Quá hạn</StatusBadge>}
                </span>
              </td>
              <td className={cn(td, 'text-right')}>
                <button type="button" onClick={() => onOpen(s.id)} className="text-[13px] font-medium whitespace-nowrap text-gold-ink hover:underline">
                  Xem chi tiết
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

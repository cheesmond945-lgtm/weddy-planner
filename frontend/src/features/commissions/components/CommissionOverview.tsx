import { Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionStatementSummary } from '@/types/commission'
import { formatPeriod, remainingOf } from '../constants'
import { StatCard } from './StatCard'

/** Chọn kỳ (tháng) xem số liệu, như ô chọn "Tháng 09/2026" của prototype. */
export function PeriodSelect({ statements, value, onChange }: { statements: CommissionStatementSummary[]; value: string; onChange: (id: string) => void }) {
  return (
    <select
      aria-label="Kỳ đối soát"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 min-w-[170px] rounded-sm border border-line-strong bg-surface px-3 text-[13.5px] focus:border-gold focus:outline-none"
    >
      {statements.map((s) => (
        <option key={s.id} value={s.id}>
          Tháng {formatPeriod(s.period)}
          {s.status === 'OPEN' ? ' (tạm tính)' : ''}
        </option>
      ))}
    </select>
  )
}

/** Ba thẻ số liệu của kỳ đang chọn và ghi chú hạn thanh toán (kpi-grid three, finance-note trong prototype NCC). */
export function CommissionOverview({ statement: s }: { statement: CommissionStatementSummary }) {
  const rest = remainingOf(s)
  const cards = [
    { label: s.status === 'OPEN' ? 'Hoa hồng tạm tính của kỳ' : 'Tổng hoa hồng của kỳ', value: s.commissionAmount, tone: '' },
    { label: 'Đã xác nhận thanh toán', value: s.paidAmount, tone: 'text-sage' },
    { label: 'Còn phải thanh toán', value: rest, tone: rest ? 'text-gold-ink' : 'text-sage' },
  ]
  return (
    <>
      <div className="mb-[18px] grid grid-cols-3 gap-4 max-sm:grid-cols-1 max-sm:gap-2.5">
        {cards.map((c) => (
          <StatCard
            key={c.label}
            label={c.label}
            value={formatMoney(c.value)}
            tone={c.tone}
            foot={
              <>
                Kỳ {formatPeriod(s.period)}
                {c.label === 'Còn phải thanh toán' && s.pendingAmount > 0 && ' · có minh chứng chờ xác nhận'}
              </>
            }
          />
        ))}
      </div>
      {s.status === 'OPEN' ? (
        <Note>
          Kỳ {formatPeriod(s.period)} đang tạm tính, số liệu thay đổi khi có đơn hoàn thành hoặc khoản thu mới. Chốt kỳ ngày <strong>{formatDate(s.closingDate)}</strong>, hạn
          thanh toán <strong>{formatDate(s.dueDate)}</strong>.
        </Note>
      ) : (
        rest > 0 && (
          <Note warn={s.isOverdue}>
            Kỳ {formatPeriod(s.period)} còn <strong>{formatMoney(rest)}</strong> chưa được xác nhận thanh toán. Hạn thanh toán: <strong>{formatDate(s.dueDate)}</strong>
            {s.isOverdue ? ', đã quá hạn.' : '.'}
          </Note>
        )
      )}
    </>
  )
}

function Note({ warn, children }: { warn?: boolean; children: ReactNode }) {
  return (
    <div className={cn('mb-[18px] flex items-start gap-2.5 rounded-[9px] px-3.5 py-3 text-[13.5px]', warn ? 'bg-warn-soft text-warn' : 'bg-gold-soft text-gold-ink')}>
      <Info className="mt-0.5 size-4 flex-none" />
      <span>{children}</span>
    </div>
  )
}

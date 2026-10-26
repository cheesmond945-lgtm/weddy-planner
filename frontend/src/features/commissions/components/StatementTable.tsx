import { ChevronRight, Eye, Wallet } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Button } from '@/components/ui/button'
import { formatDayTime } from '@/features/vendorOrders/calc'
import { StatusBadge } from '@/features/vendorOrders/components/OrderBadges'
import { RowMenu } from '@/features/vendorPackages/components/RowMenu'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionStatement } from '@/types/commission'
import { canPay, dueRelative, formatPeriod, stateOf } from '../calc'
import { STATEMENT_STATE } from '../constants'

/*
 * Bảng các kỳ: cùng nguyên tắc với bảng Quản lý đơn hàng. Từ 1100px là bảng không cuộn ngang; dưới 1100px là danh sách thẻ.
 */
const th = 'border-y border-line bg-surface-2 px-2.5 py-3 text-left align-bottom text-[11px] leading-tight font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-4 last:pr-4'
const td = 'border-b border-line px-2.5 py-3.5 align-middle text-[13px] leading-snug first:pl-4 last:pr-4'

/** Vạch màu bên trái dòng: quá hạn (đỏ), chưa nộp và nộp được (vàng). */
const ACCENT = { warn: 'shadow-[inset_3px_0_var(--gold)]', danger: 'shadow-[inset_3px_0_var(--warn)]' }
const accentOf = (s: CommissionStatement) => {
  const st = stateOf(s)
  return st === 'overdue' ? ACCENT.danger : st === 'unpaid' ? ACCENT.warn : undefined
}

/** Chặn bấm nút (hoặc phím) lan lên dòng: bấm dòng mở chi tiết, nút bên trong có việc riêng. */
const stop = { onClick: (e: MouseEvent) => e.stopPropagation(), onKeyDown: (e: KeyboardEvent) => e.stopPropagation() }

function StateBadge({ s }: { s: CommissionStatement }) {
  const { label, tone } = STATEMENT_STATE[stateOf(s)]
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}

function Due({ s }: { s: CommissionStatement }) {
  const st = stateOf(s)
  return (
    <>
      <span className="block whitespace-nowrap tabular-nums">{formatDate(s.dueDate)}</span>
      {(st === 'unpaid' || st === 'overdue') && <span className={cn('block text-[12px] whitespace-nowrap', st === 'overdue' ? 'font-medium text-warn' : 'text-muted-foreground')}>{dueRelative(s)}</span>}
    </>
  )
}

function PaidInfo({ s }: { s: CommissionStatement }) {
  if (s.status !== 'Paid' || !s.paidDate) return <span className="text-muted-foreground">—</span>
  return (
    <>
      <span className="block whitespace-nowrap tabular-nums">{formatDayTime(s.paidDate).slice(6)}</span>
      {s.transactionCode && <span className="block text-[12px] whitespace-nowrap text-muted-foreground">{s.transactionCode}</span>}
    </>
  )
}

/** Nút chính "Nộp tiền" (chỉ khi nộp được, nền vàng, cùng cỡ) và menu "…" ở mọi dòng. */
function RowActions({ s, busy, onOpen, onPay, chevron }: { s: CommissionStatement; busy: boolean; onOpen: (id: string) => void; onPay: (s: CommissionStatement) => void; chevron?: boolean }) {
  return (
    <div className="flex items-center justify-end gap-1" {...stop}>
      <span className="flex h-8 w-[92px] flex-none justify-end">
        {canPay(s) && (
          <Button size="sm" className="h-8 w-full px-1 text-[12px]" disabled={busy} onClick={() => onPay(s)}>
            <Wallet className="size-3.5" />
            Nộp tiền
          </Button>
        )}
      </span>
      <RowMenu label={`Tháng ${formatPeriod(s.periodMonth)}`} items={[{ label: 'Xem chi tiết', icon: Eye, onClick: () => onOpen(s.id) }]} />
      {chevron && <ChevronRight aria-hidden className="size-4 flex-none text-muted-foreground/50 max-[1279px]:hidden" />}
    </div>
  )
}

interface StatementTableProps {
  statements: CommissionStatement[]
  busy: boolean
  onOpen: (id: string) => void
  onPay: (s: CommissionStatement) => void
}

export function StatementTable({ statements, busy, onOpen, onPay }: StatementTableProps) {
  return (
    <>
      <div className="max-[1099px]:hidden">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-[15%]" />
            <col className="w-[9%]" />
            <col className="w-[14%]" />
            <col className="w-[13%]" />
            <col className="w-[14%]" />
            <col className="w-[18%]" />
            <col className="w-[148px] min-[1280px]:w-[172px]" />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>Kỳ</th>
              <th className={cn(th, 'text-right')}>Số đơn</th>
              <th className={cn(th, 'text-right')}>Tổng hoa hồng</th>
              <th className={th}>Hạn nộp</th>
              <th className={th}>Trạng thái</th>
              <th className={th}>Đã nộp</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {statements.map((s) => (
              <tr key={s.id} tabIndex={0} onClick={() => onOpen(s.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(s.id)} className="cursor-pointer transition-colors outline-none last:[&>td]:border-b-0 hover:bg-bg focus-visible:bg-bg">
                <td className={cn(td, 'font-semibold whitespace-nowrap', accentOf(s))}>Tháng {formatPeriod(s.periodMonth)}</td>
                <td className={cn(td, 'text-right tabular-nums')}>{s.totalOrders}</td>
                <td className={cn(td, 'text-right font-semibold whitespace-nowrap tabular-nums')}>{formatMoney(s.totalAmount)}</td>
                <td className={td}>
                  <Due s={s} />
                </td>
                <td className={td}>
                  <StateBadge s={s} />
                </td>
                <td className={td}>
                  <PaidInfo s={s} />
                </td>
                <td className={td}>
                  <RowActions s={s} busy={busy} onOpen={onOpen} onPay={onPay} chevron />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dưới 1100px: thẻ rút gọn */}
      <ul className="grid gap-3 p-3.5 min-[1100px]:hidden">
        {statements.map((s) => (
          <li key={s.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(s.id)}
              onKeyDown={(e) => e.key === 'Enter' && onOpen(s.id)}
              className={cn('cursor-pointer rounded-[18px] border border-line bg-surface p-4 shadow-bubble', accentOf(s))}
            >
              <div className="flex items-start justify-between gap-2">
                <b className="font-semibold">Tháng {formatPeriod(s.periodMonth)}</b>
                <StateBadge s={s} />
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <span className="min-w-0 text-[13px]">
                  <b className="text-[17px] font-semibold tabular-nums">{formatMoney(s.totalAmount)}</b>
                  <span className="block text-muted-foreground">{s.totalOrders} đơn hoàn tất</span>
                  <span className="mt-1.5 block text-muted-foreground">
                    Hạn nộp <Due s={s} />
                  </span>
                  {s.status === 'Paid' && (
                    <span className="mt-1.5 block text-muted-foreground">
                      Đã nộp <PaidInfo s={s} />
                    </span>
                  )}
                </span>
                <RowActions s={s} busy={busy} onOpen={onOpen} onPay={onPay} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

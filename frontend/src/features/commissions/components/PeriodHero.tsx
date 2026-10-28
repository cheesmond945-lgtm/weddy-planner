import { useState } from 'react'
import { CalendarClock, CircleCheck, CreditCard, LoaderCircle, ShieldCheck } from 'lucide-react'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionStatement, CommissionStatementSummary } from '@/types/commission'
import { formatPeriod } from '../constants'
import type { PayInfo } from '@/types/payment'
import { usePayCommission } from '../hooks'
import { PayCommissionDialog } from './PayCommissionDialog'

const dayNo = (ymd: string) => Math.floor(new Date(`${ymd}T00:00:00Z`).getTime() / 86_400_000)
const todayVN = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
/** Ngày đầu tháng sau kỳ (thanh toán được từ ngày này) */
const payableFrom = (closingDate: string) => new Date(dayNo(closingDate) * 86_400_000 + 86_400_000).toISOString().slice(0, 10)

/**
 * Khối nổi bật của kỳ đang xem: hoa hồng cần thanh toán, số đơn / doanh thu / tỷ lệ, hạn thanh toán,
 * nút thanh toán VietQR.
 */
export function PeriodHero({ summary, detail }: { summary: CommissionStatementSummary; detail?: CommissionStatement }) {
  const pay = usePayCommission()
  const [qr, setQr] = useState<PayInfo | null>(null)
  const s = summary
  const open = s.status === 'OPEN'
  const paid = s.status === 'PAID'
  const payable = s.status === 'UNPAID' && s.commissionAmount > 0
  const rates = [...new Set((detail?.lines ?? []).map((l) => l.rate))]
  const left = dayNo(s.dueDate) - dayNo(todayVN())
  const receipt = detail?.payments[0]

  const stats = [
    { label: 'Đơn hoàn thành', value: `${s.orderCount} đơn` },
    { label: 'Doanh thu tính hoa hồng', value: formatMoney(s.baseAmount) },
    { label: 'Tỷ lệ hoa hồng', value: rates.length ? rates.map((r) => `${r}%`).join(' · ') : '—' },
  ]

  return (
    <section aria-label={`Kỳ đối soát ${formatPeriod(s.period)}`} className="relative mb-5 overflow-hidden rounded-md border border-line bg-surface shadow-portal">
      {/* Viền vàng mảnh mép trên */}
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px] bg-(image:--gold-grad)" />

      <div className="grid gap-6 p-7 max-sm:p-5 min-[960px]:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)] min-[960px]:gap-8">
        <div className="min-w-0">
          <p className="text-[13.5px] text-muted-foreground">
            {open ? 'Hoa hồng tạm tính' : paid ? 'Hoa hồng đã thanh toán' : 'Hoa hồng cần thanh toán'} kỳ <span className="font-semibold text-ink tabular-nums">{formatPeriod(s.period)}</span>
          </p>
          <p className={cn('mt-1.5 text-[40px] leading-tight font-semibold tracking-tight tabular-nums max-sm:text-[32px]', paid ? 'text-sage' : 'text-gold-ink')}>
            {formatMoney(s.commissionAmount)}
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-md border border-line bg-line max-sm:grid-cols-1">
            {stats.map((x) => (
              <div key={x.label} className="min-w-0 bg-surface-2 px-4 py-3">
                <dt className="text-[11.5px] text-muted-foreground">{x.label}</dt>
                <dd className="mt-0.5 truncate text-[15px] font-semibold text-ink tabular-nums">{x.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Khung hành động: hạn và nút thanh toán */}
        <div
          className={cn(
            'flex min-w-0 flex-col justify-between gap-4 rounded-md border p-5',
            paid ? 'border-sage/25 bg-sage-soft' : s.isOverdue ? 'border-warn/25 bg-warn-soft' : 'border-gold/25 bg-gold-soft',
          )}
        >
          {paid ? (
            <div className="grid gap-2">
              <span className="grid size-11 place-items-center rounded-full bg-surface text-sage">
                <CircleCheck className="size-6" />
              </span>
              <p className="text-[15px] font-semibold text-ink">Đã thanh toán kỳ này</p>
              <p className="text-[13px] text-muted-foreground">
                {receipt ? <>Ngày {formatDate(receipt.submittedAt.slice(0, 10))}</> : 'WebPlan đã nhận hoa hồng.'}
                {receipt?.note && <span className="block">{receipt.note}</span>}
                {s.lateDays && <span className="block text-warn">Trả trễ {s.lateDays} ngày so với hạn.</span>}
              </p>
            </div>
          ) : (
            <div className="grid gap-1.5">
              <p className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
                <CalendarClock className={cn('size-4', s.isOverdue ? 'text-warn' : 'text-gold-ink')} />
                Hạn thanh toán
              </p>
              <p className="text-[22px] font-semibold text-ink tabular-nums">{formatDate(s.dueDate)}</p>
              <p className={cn('text-[13px]', s.isOverdue ? 'font-medium text-warn' : 'text-muted-foreground')}>
                {open
                  ? `Kỳ chốt ngày ${formatDate(s.closingDate)}, thanh toán được từ ${formatDate(payableFrom(s.closingDate))}.`
                  : s.commissionAmount === 0
                    ? 'Kỳ này không phát sinh hoa hồng.'
                    : left > 0
                      ? `Còn ${left} ngày để thanh toán.`
                      : left === 0
                        ? 'Hôm nay là hạn cuối.'
                        : `Đã quá hạn ${-left} ngày. Vui lòng thanh toán ngay.`}
              </p>
            </div>
          )}

          {/* Kỳ chưa chốt hoặc không có hoa hồng: nút mờ, không bấm được (dòng trên đã ghi ngày thanh toán được) */}
          {!paid && (
            <div className="grid gap-2.5">
              <button
                type="button"
                disabled={!payable || pay.isPending}
                onClick={() => pay.mutate(s.id, { onSuccess: setQr })}
                className={cn(
                  'inline-flex h-12 w-full items-center justify-center gap-2 rounded-pill bg-(image:--gold-grad) px-6 text-[14.5px] font-semibold text-gold-on transition-[filter,transform,opacity] duration-200',
                  payable ? 'shadow-[0_10px_24px_-12px_rgba(169,130,58,0.6)] hover:brightness-105 active:scale-[0.99]' : 'cursor-not-allowed opacity-45',
                )}
              >
                {pay.isPending ? <LoaderCircle className="size-[18px] animate-spin" /> : <CreditCard className="size-[18px]" />}
                Thanh toán {formatMoney(s.commissionAmount)}
              </button>
              <p className="flex items-center justify-center gap-1.5 text-[11.5px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-gold-ink" />
                Thanh toán bằng chuyển khoản VietQR, tự động xác nhận
              </p>
            </div>
          )}
        </div>
      </div>
      <PayCommissionDialog statementId={s.id} info={qr} onClose={() => setQr(null)} />
    </section>
  )
}

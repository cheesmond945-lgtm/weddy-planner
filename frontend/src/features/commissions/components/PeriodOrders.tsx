import { ClipboardCheck } from 'lucide-react'
import { Link } from 'react-router'
import { formatDay } from '@/features/serviceOrders/calc'
import { orderPageHref } from '@/features/serviceOrders/components/OrderCard'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionStatement, CommissionStatementSummary } from '@/types/commission'
import { formatPeriod } from '../constants'

const th = 'border-b border-line bg-surface-2 px-3 py-[11px] text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase first:pl-5 last:pr-5'
const td = 'border-b border-line px-3 py-[14px] align-middle text-[13.5px] first:pl-5 last:pr-5'
const num = 'text-right whitespace-nowrap tabular-nums'

/** Các đơn hoàn thành được tính hoa hồng trong kỳ đang xem, kèm dòng tổng. */
export function PeriodOrders({ summary, detail, loading }: { summary: CommissionStatementSummary; detail?: CommissionStatement; loading: boolean }) {
  const lines = detail?.lines ?? []
  return (
    <section className="mb-5 min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-portal">
      <header className="flex flex-wrap items-end justify-between gap-2 px-5 pt-[18px] pb-4">
        <div>
          <h2 className="font-sans text-[15px] font-semibold tracking-normal">Đơn hoàn thành trong kỳ {formatPeriod(summary.period)}</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">Đơn khách đã thanh toán đủ (cọc và phần còn lại) và được đánh dấu hoàn thành.</p>
        </div>
        {lines.length > 0 && <span className="rounded-pill bg-gold-soft px-3 py-1 text-[12px] font-medium text-gold-ink">{lines.length} đơn</span>}
      </header>

      {loading ? (
        <div aria-busy="true" aria-label="Đang tải đơn của kỳ" className="mx-5 mb-5 h-40 animate-pulse rounded-md bg-muted" />
      ) : !lines.length ? (
        <div className="grid place-items-center gap-2 border-t border-line px-5 py-12 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-gold-soft text-gold-ink">
            <ClipboardCheck className="size-6" />
          </span>
          <p className="text-[14px] font-medium">Chưa có đơn hoàn thành trong kỳ</p>
          <p className="max-w-[420px] text-[13px] text-muted-foreground">
            Đơn được tính hoa hồng khi bạn xác nhận đã thu đủ ở Quản lý đơn hàng. Quên xác nhận thì hệ thống tự hoàn thành 7 ngày sau ngày cưới.
          </p>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Đơn hàng</th>
                <th className={th}>Ngày cưới</th>
                <th className={th}>Hoàn thành</th>
                <th className={cn(th, 'text-right')}>Doanh thu</th>
                <th className={cn(th, 'text-right')}>Tỷ lệ</th>
                <th className={cn(th, 'text-right')}>Hoa hồng</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="transition-colors hover:bg-surface-2">
                  <td className={td}>
                    <Link to={orderPageHref({ id: l.orderId })} className="font-semibold text-gold-ink tabular-nums hover:underline">
                      {l.orderCode}
                    </Link>
                    <span className="block text-[12.5px] text-muted-foreground">{l.customerName}</span>
                  </td>
                  <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{formatDay(l.eventDate)}</td>
                  <td className={cn(td, 'whitespace-nowrap tabular-nums')}>
                    {formatDay(l.completedDate)}
                    {/* Hoàn thành ở kỳ đã thanh toán thì được tính dồn sang kỳ này */}
                    {l.originPeriod && <span className="mt-1 block w-fit rounded-pill bg-info-soft px-2 text-[11px] text-info">Dồn từ kỳ {formatPeriod(l.originPeriod)}</span>}
                  </td>
                  <td className={cn(td, num)}>{formatMoney(l.baseAmount)}</td>
                  <td className={cn(td, num, 'text-muted-foreground')}>{l.rate}%</td>
                  <td className={cn(td, num, 'font-semibold')}>{formatMoney(l.commissionAmount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gold-soft/60">
                <td colSpan={3} className="px-3 py-3.5 pl-5 text-[13px] font-semibold">
                  Tổng cộng
                </td>
                <td className="px-3 py-3.5 text-right text-[13.5px] font-semibold whitespace-nowrap tabular-nums">{formatMoney(summary.baseAmount)}</td>
                <td />
                <td className="px-3 py-3.5 pr-5 text-right text-[15px] font-semibold whitespace-nowrap text-gold-ink tabular-nums">{formatMoney(summary.commissionAmount)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}

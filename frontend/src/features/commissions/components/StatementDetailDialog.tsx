import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { formatDay, formatDayTime } from '@/features/vendorOrders/calc'
import { InvoiceDialog } from '@/features/vendorOrders/components/InvoiceDialog'
import { StatusBadge } from '@/features/vendorOrders/components/OrderBadges'
import { OrderDetailDialog } from '@/features/vendorOrders/components/OrderDetailDialog'
import { PanelDialog } from '@/features/vendorOrders/components/PanelDialog'
import { useOrder } from '@/features/vendorOrders/hooks'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionStatement } from '@/types/commission'
import type { InvoiceType, Order } from '@/types/vendorOrder'
import { canPay, dueHint, formatPeriod, stateOf } from '../calc'
import { STATEMENT_STATE } from '../constants'
import { useCommissionLines } from '../hooks'

const Item = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">{label}</dt>
    <dd className="m-0 mt-px text-[13.5px] [overflow-wrap:anywhere]">{children}</dd>
  </div>
)

interface StatementDetailDialogProps {
  statement: CommissionStatement
  onClose: () => void
  onPay: (s: CommissionStatement) => void
}

/**
 * Chi tiết một kỳ: tổng quan (số đơn, tổng, hạn, trạng thái, mã giao dịch nếu đã nộp) và hoa hồng từng đơn.
 * Bấm mã đơn mở màn Xem chi tiết đơn (cùng màn ở Quản lý đơn hàng và Tin nhắn).
 */
export function StatementDetailDialog({ statement: s, onClose, onPay }: StatementDetailDialogProps) {
  const state = stateOf(s)
  const lines = useCommissionLines(s.id, s.totalOrders > 0)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<{ order: Order; type: InvoiceType } | null>(null)
  const order = useOrder(orderId).data
  const th = 'border-y border-line bg-surface-2 px-3 py-2.5 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
  const td = 'px-3 py-2.5 align-top text-[13.5px]'
  const { label, tone } = STATEMENT_STATE[state]

  return (
    <>
      <PanelDialog
        open
        size="lg"
        onRequestClose={onClose}
        title={`Bảng kê hoa hồng tháng ${formatPeriod(s.periodMonth)}`}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone}>{label}</StatusBadge>
            <span>Tạo {formatDayTime(s.createdDate)}</span>
          </span>
        }
        footer={
          <>
            <p className={cn('mr-auto text-[13px]', state === 'overdue' ? 'text-warn' : 'text-muted-foreground')}>
              {state === 'provisional'
                ? 'Kỳ đang tạm tính, số liệu thay đổi khi có đơn hoàn tất. Nộp được sau khi hết tháng.'
                : state === 'paid'
                  ? `Đã nộp ngày ${s.paidDate ? formatDay(s.paidDate) : ''}.`
                  : `Nộp một lần cho cả bảng kê qua VNPay · ${dueHint(s)}`}
            </p>
            <Button variant="outline" className="border-line-strong" onClick={onClose}>
              Đóng
            </Button>
            {canPay(s) && <Button onClick={() => onPay(s)}>Nộp tiền</Button>}
          </>
        }
      >
        <section className="mb-[18px] border-b border-line pb-[18px]">
          <h4 className="mb-3 font-sans text-[15px] font-semibold tracking-normal">Tổng quan kỳ</h4>
          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 max-sm:grid-cols-1">
            <Item label="Số đơn hoàn tất">{s.totalOrders}</Item>
            <Item label="Tổng hoa hồng">
              <b className="text-[15px] font-bold text-gold-ink tabular-nums">{formatMoney(s.totalAmount)}</b>
            </Item>
            <Item label="Hạn nộp">{formatDate(s.dueDate)}</Item>
            <Item label="Trạng thái">{label}</Item>
            {s.status === 'Paid' && s.paidDate && <Item label="Ngày nộp">{formatDayTime(s.paidDate)}</Item>}
            {s.transactionCode && <Item label="Mã giao dịch">{s.transactionCode}</Item>}
          </dl>
        </section>

        <section>
          <h4 className="mb-3 font-sans text-[15px] font-semibold tracking-normal">Hoa hồng từng đơn</h4>
          {s.totalOrders === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">Chưa có đơn nào hoàn tất trong kỳ này. Khi bạn bấm Hoàn tất một đơn, hoa hồng của đơn được cộng vào kỳ.</p>
          ) : lines.isPending ? (
            <div aria-busy="true" className="h-24 animate-pulse rounded-md bg-muted" />
          ) : lines.isError ? (
            <p className="text-[13.5px] text-warn">{lines.error.message}</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full min-w-[640px] border-collapse">
                <thead>
                  <tr>
                    <th className={th}>Mã đơn</th>
                    <th className={th}>Khách</th>
                    <th className={th}>Ngày hoàn tất</th>
                    <th className={cn(th, 'text-right')}>Giá trị đơn</th>
                    <th className={cn(th, 'text-right')}>Tỷ lệ</th>
                    <th className={cn(th, 'text-right')}>Hoa hồng</th>
                  </tr>
                </thead>
                <tbody className="[&_tr+tr]:border-t [&_tr+tr]:border-line">
                  {lines.data.map((l) => (
                    <tr key={l.id}>
                      <td className={td}>
                        <button type="button" onClick={() => setOrderId(l.orderId)} className="font-semibold whitespace-nowrap text-gold-ink hover:underline">
                          {l.orderCode}
                        </button>
                      </td>
                      <td className={td}>{l.customerName}</td>
                      <td className={cn(td, 'whitespace-nowrap')}>{formatDay(l.completedDate)}</td>
                      <td className={cn(td, 'text-right whitespace-nowrap tabular-nums')}>{formatMoney(l.orderAmount)}</td>
                      <td className={cn(td, 'text-right tabular-nums')}>{l.rate}%</td>
                      <td className={cn(td, 'text-right font-semibold whitespace-nowrap tabular-nums')}>{formatMoney(l.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-2">
                    <td colSpan={5} className={cn(td, 'text-right font-medium')}>
                      Tổng hoa hồng kỳ
                    </td>
                    <td className={cn(td, 'text-right text-[15px] font-bold whitespace-nowrap text-gold-ink tabular-nums')}>{formatMoney(s.totalAmount)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </PanelDialog>

      {order && (
        <OrderDetailDialog
          order={order}
          onClose={() => setOrderId(null)}
          // Đơn đã hoàn tất không còn thao tác mở form; chỉ còn xem hóa đơn
          onOpenForm={() => setOrderId(null)}
          onViewInvoice={(o, type) => setInvoice({ order: o, type })}
        />
      )}
      {invoice && <InvoiceDialog order={invoice.order} type={invoice.type} onClose={() => setInvoice(null)} />}
    </>
  )
}

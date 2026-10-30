import type { ReactNode } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { InvoiceType, Order, OrderRevision } from '@/types/vendorOrder'
import { CANCEL_REASON } from '../constants'
import { changesLabel, depositDeadline, formatDay, formatDayTime, orderHint } from '../calc'
import { OrderActions } from './OrderActions'
import { OrderStatusBadge } from './OrderBadges'
import { OrderProgressPanel } from './OrderProgressPanel'
import type { OrderFormMode } from './OrderFormDialog'
import { PanelDialog } from './PanelDialog'
import { PaymentScheduleTable } from './PaymentScheduleTable'

const INVOICE_LABEL: Record<InvoiceType, string> = { DepositReceipt: 'Giấy xác nhận cọc', FinalInvoice: 'Hóa đơn cuối' }

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-[18px] border-b border-line pb-[18px] last:mb-0 last:border-b-0 last:pb-1">
      <h4 className="mb-3 font-sans text-[15px] font-semibold tracking-normal">{title}</h4>
      {children}
    </section>
  )
}

const Item = ({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) => (
  <div className={cn('min-w-0', full && 'col-span-full')}>
    <dt className="text-[11px] tracking-[0.05em] text-muted-foreground uppercase">{label}</dt>
    <dd className="m-0 mt-px text-[13.5px] [overflow-wrap:anywhere]">{children}</dd>
  </div>
)

const REVISION_TYPE = { BeforeDeposit: 'Trước khi cọc', AfterDeposit: 'Sau khi cọc' }

const REVISION_STATUS = {
  Requested: { label: 'Đang chờ NCC sửa', tone: 'warn' },
  Applied: { label: 'Đã áp dụng', tone: 'done' },
  Rejected: { label: 'NCC đã từ chối', tone: 'neutral' },
} as const

function RevisionRow({ r }: { r: OrderRevision }) {
  const requested = r.status === 'Requested'
  // Yêu cầu của khách sau cọc (đang chờ hoặc bị từ chối): ghi chú là của khách, không phải "nội dung thay đổi" của NCC
  const customerAfterDeposit = r.revisionType === 'AfterDeposit' && r.status !== 'Applied'
  const status = REVISION_STATUS[r.status] ?? REVISION_STATUS.Applied
  return (
    <li className={cn('rounded-md border border-line px-3.5 py-3 text-[13.5px]', requested && 'border-l-[3px] border-l-warn')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          {formatDayTime(r.createdDate)} · {REVISION_TYPE[r.revisionType]}
        </span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {r.changes.length > 0 && <p className="mt-1.5 font-medium">{changesLabel(r)}</p>}
      <p className="mt-1 text-muted-foreground">
        {customerAfterDeposit
          ? `Khách yêu cầu: ${r.requestNote ?? ''}`
          : r.revisionType === 'AfterDeposit'
          ? r.requestNote
            ? `Nội dung thay đổi: ${r.requestNote}`
            : 'NCC chỉnh sửa đơn.'
          : r.requestNote
            ? r.requestNote
            : r.changes.length
              ? ''
              : 'NCC tự sửa đơn (không có yêu cầu của khách).'}
      </p>
      <p className="mt-1.5 tabular-nums">
        Tổng {formatMoney(r.oldTotalAmount)} → {r.newTotalAmount === null ? <span className="text-muted-foreground">chưa áp dụng</span> : <b className="font-semibold">{formatMoney(r.newTotalAmount)}</b>}
        {r.appliedDate && <span className="ml-2 text-[12.5px] text-muted-foreground">Áp dụng {formatDayTime(r.appliedDate)}</span>}
      </p>
    </li>
  )
}

interface OrderDetailDialogProps {
  order: Order
  onClose: () => void
  /** Mở form: màn chi tiết tự đóng trước (chỉ phía NCC) */
  onOpenForm?: (mode: OrderFormMode) => void
  onViewInvoice: (order: Order, type: InvoiceType) => void
  /** Phía khách chỉ xem: không có dòng gợi ý và nút thao tác của NCC */
  viewer?: 'vendor' | 'couple'
}

/**
 * Màn "Xem chi tiết" đơn (docs/api/THE_DON_HANG.md mục 2): thông tin, bảng hạng mục đầy đủ, lịch thanh toán 2 đợt,
 * lịch sử chỉnh sửa (OrderRevisions), chứng từ (Invoices). Khách và NCC thấy cùng nội dung.
 */
export function OrderDetailDialog({ order: o, onClose, onOpenForm, onViewInvoice, viewer = 'vendor' }: OrderDetailDialogProps) {
  const hint = orderHint(o)
  const vendorView = viewer === 'vendor'
  const th = 'border-y border-line bg-surface-2 px-3 py-2.5 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
  const td = 'px-3 py-2.5 align-top text-[13.5px]'
  return (
    <PanelDialog
      open
      size="lg"
      onRequestClose={onClose}
      title={`Đơn dịch vụ ${o.orderCode}`}
      subtitle={
        <span className="inline-flex flex-wrap items-center gap-2">
          <OrderStatusBadge status={o.status} />
          <span>Tạo {formatDayTime(o.createdDate)}</span>
        </span>
      }
      footer={
        <>
          {vendorView && (
            <div className="mr-auto min-w-0 flex-1 max-sm:basis-full">
              <p className={cn('text-[13px]', hint.tone === 'warn' ? 'text-warn' : hint.tone === 'ok' ? 'text-sage' : 'text-muted-foreground')}>{hint.text}</p>
              <OrderActions
                order={o}
                onOpenForm={(mode) => {
                  onClose()
                  onOpenForm?.(mode)
                }}
                onViewInvoice={onViewInvoice}
              />
            </div>
          )}
          <Button variant="outline" className="border-line-strong" onClick={onClose}>
            Đóng
          </Button>
        </>
      }
    >
      <Section title="Thông tin đơn">
        <dl className="grid grid-cols-3 gap-x-4 gap-y-3 max-sm:grid-cols-1">
          <Item label="Khách hàng">{o.customerName}</Item>
          <Item label="Số điện thoại">{o.customerPhone || '—'}</Item>
          <Item label="Ngày thực hiện">{formatDate(o.eventDate)}</Item>
          {o.status === 'Pending' && o.depositDueDate && <Item label="Hạn đặt cọc">{depositDeadline(o.depositDueDate).replace('Hạn cọc: ', '')}</Item>}
          {o.completedDate && <Item label="Ngày hoàn thành">{formatDay(o.completedDate)}</Item>}
          {o.cancelledDate && <Item label="Ngày hủy">{formatDay(o.cancelledDate)}</Item>}
          {o.cancelReason && (
            <Item label="Lý do hủy">{CANCEL_REASON[o.cancelReason].label}</Item>
          )}
          <Item label="Ghi chú gửi khách" full>
            {o.note ?? <span className="text-muted-foreground">Không có</span>}
          </Item>
        </dl>
      </Section>

      {vendorView && (o.status === 'Deposited' || o.status === 'Completed') && (
        <Section title="Tiến độ đơn">
          <OrderProgressPanel orderId={o.id} readOnly={o.status !== 'Deposited'} />
        </Section>
      )}

      <Section title="Hạng mục báo giá">
        <div className="overflow-x-auto rounded-md border border-line">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                <th className={cn(th, 'w-12 text-center')}>STT</th>
                <th className={th}>Hạng mục</th>
                <th className={th}>Đơn vị tính</th>
                <th className={cn(th, 'text-right')}>Số lượng</th>
                <th className={cn(th, 'text-right')}>Đơn giá</th>
                <th className={cn(th, 'text-right')}>Thành tiền</th>
              </tr>
            </thead>
            <tbody className="[&_tr+tr]:border-t [&_tr+tr]:border-line">
              {o.items.map((i, k) => (
                <tr key={i.id}>
                  <td className={cn(td, 'text-center text-muted-foreground tabular-nums')}>{k + 1}</td>
                  <td className={cn(td, 'font-medium')}>{i.itemName}</td>
                  <td className={td}>{i.unit}</td>
                  <td className={cn(td, 'text-right tabular-nums')}>{i.quantity}</td>
                  <td className={cn(td, 'text-right whitespace-nowrap tabular-nums')}>{formatMoney(i.unitPrice)}</td>
                  <td className={cn(td, 'text-right font-semibold whitespace-nowrap tabular-nums')}>{formatMoney(i.amount)}</td>
                </tr>
              ))}
              <tr className="bg-surface-2">
                <td colSpan={5} className={cn(td, 'text-right font-medium')}>
                  Tổng giá trị đơn
                </td>
                <td className={cn(td, 'text-right text-[15px] font-bold whitespace-nowrap text-gold-ink tabular-nums')}>{formatMoney(o.totalAmount)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Lịch thanh toán">
        <PaymentScheduleTable order={o} />
      </Section>

      <Section title="Lịch sử chỉnh sửa">
        {o.revisions.length ? (
          <ul className="grid gap-2.5">
            {o.revisions.map((r) => (
              <RevisionRow key={r.id} r={r} />
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted-foreground">Chưa có chỉnh sửa nào.</p>
        )}
      </Section>

      <Section title="Chứng từ">
        {o.invoices.length ? (
          <ul className="grid gap-2">
            {o.invoices.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line px-3.5 py-2.5 text-[13.5px]">
                <span>
                  <b className="font-semibold">{INVOICE_LABEL[inv.type]}</b> {inv.invoiceCode} <span className="text-muted-foreground">· {formatDay(inv.createdDate)}</span>
                </span>
                <Button size="sm" variant="outline" className="border-line-strong" onClick={() => onViewInvoice(o, inv.type)}>
                  Xem
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted-foreground">
            {vendorView ? 'Chưa có chứng từ. Giấy xác nhận cọc tự có khi khách cọc thành công; hóa đơn cuối do bạn xuất khi khách yêu cầu.' : 'Chưa có chứng từ. Giấy xác nhận cọc có sau khi bạn thanh toán cọc; hóa đơn cuối do nhà cung cấp xuất.'}
          </p>
        )}
      </Section>
    </PanelDialog>
  )
}

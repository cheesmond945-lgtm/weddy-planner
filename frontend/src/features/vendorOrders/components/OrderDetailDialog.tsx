import { ArrowLeft, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { InvoiceType, Order, OrderRevision } from '@/types/vendorOrder'
import { CANCEL_REASON } from '../constants'
import { changesLabel, formatDay, formatDayTime, orderHint } from '../calc'
import { OrderActions } from './OrderActions'
import { OrderStatusBadge, PaidInFullBadge } from './OrderBadges'
import type { OrderFormMode } from './OrderFormDialog'
import { InvoiceContent, invoiceHeading } from './InvoiceDialog'
import { PanelDialog } from './PanelDialog'
import { PaymentScheduleTable } from './PaymentScheduleTable'

const INVOICE_LABEL: Record<InvoiceType, string> = { DepositReceipt: 'Giấy xác nhận cọc', FinalInvoice: 'Hóa đơn cuối' }

/** Một mục của chi tiết đơn. `collapsible`: tiêu đề là nút có mũi tên ⌄/⌃ để thu gọn hoặc mở nội dung (mặc định thu gọn trừ khi `defaultOpen`). */
function Section({
  title,
  children,
  collapsible,
  defaultOpen = false,
  sectionRef,
}: {
  title: ReactNode
  children: ReactNode
  collapsible?: boolean
  defaultOpen?: boolean
  sectionRef?: React.Ref<HTMLElement>
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()
  const shown = !collapsible || open
  return (
    <section ref={sectionRef} className="mb-[18px] border-b border-line pb-[18px] last:mb-0 last:border-b-0 last:pb-1">
      {collapsible ? (
        <h4 className={cn('font-sans text-[15px] font-semibold tracking-normal', shown && 'mb-3')}>
          <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-3 text-left hover:text-primary">
            <span>{title}</span>
            {/* Mũi tên xuống: mở ra xem; mở rồi thì xoay lên để thu gọn (ít bị hiểu nhầm là "thêm" như dấu +) */}
            <span className="grid size-6 shrink-0 place-items-center rounded-full border border-line text-muted-foreground" aria-hidden>
              <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
            </span>
          </button>
        </h4>
      ) : (
        <h4 className="mb-3 font-sans text-[15px] font-semibold tracking-normal">{title}</h4>
      )}
      <div id={id} hidden={!shown}>
        {children}
      </div>
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
              : 'NCC tự chỉnh sửa đơn (không có yêu cầu của khách).'}
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
  /** Không còn dùng: chứng từ mở ngay trong popup chi tiết (giữ để nơi gọi cũ không phải sửa) */
  onViewInvoice?: (order: Order, type: InvoiceType) => void
  /** Phía khách chỉ xem: không có dòng gợi ý và nút thao tác của NCC */
  viewer?: 'vendor' | 'couple'
}

/**
 * Nội dung chi tiết đơn (docs/api/THE_DON_HANG.md mục 2): thông tin, bảng hạng mục đầy đủ, lịch thanh toán 2 đợt, lịch sử chỉnh sửa, chứng từ.
 * Dùng chung cho hộp thoại (OrderDetailDialog) và trang chi tiết đơn của NCC.
 */
export function OrderDetailSections({
  order: o,
  vendorView,
  onViewInvoice,
  invoicesRef,
}: {
  order: Order
  vendorView: boolean
  onViewInvoice: (order: Order, type: InvoiceType) => void
  /** Gắn vào mục Chứng từ để quay lại đúng chỗ sau khi xem chứng từ */
  invoicesRef?: React.Ref<HTMLElement>
}) {
  const th = 'border-y border-line bg-surface-2 px-3 py-2.5 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
  const td = 'px-3 py-2.5 align-top text-[13.5px]'
  return (
    <>
      <Section title="Thông tin đơn">
        {/* Các ô chia đều trên một hàng (4 ô với đơn có sảnh), hẹp thì tự xuống hàng */}
        <dl className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-4 gap-y-3">
          {/* Cả hai phía đều thấy tên và số điện thoại ghi trên đơn (NCC có thể sửa, kể cả sau cọc) */}
          <Item label="Khách hàng">{o.customerName}</Item>
          <Item label="Số điện thoại">{o.customerPhone || '—'}</Item>
          <Item label="Ngày thực hiện">{formatDate(o.eventDate)}</Item>
          {o.package && <Item label="Sảnh">{o.package.name}</Item>}
          {o.completedDate && <Item label="Ngày hoàn thành">{formatDay(o.completedDate)}</Item>}
          {o.cancelledDate && <Item label="Ngày hủy">{formatDay(o.cancelledDate)}</Item>}
          {o.cancelReason && (
            <Item label="Lý do hủy">{CANCEL_REASON[o.cancelReason].label}</Item>
          )}
          {/* Chỉ hiện khi có ghi chú (ghi chú thường dài nên chiếm cả hàng) */}
          {o.note?.trim() && (
            <Item label={vendorView ? 'Ghi chú gửi khách' : 'Ghi chú của nhà cung cấp'} full>
              {o.note}
            </Item>
          )}
        </dl>
      </Section>

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
                  <td className={cn(td, 'font-medium')}>
                    {i.itemName}
                    {i.packageName && <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Gói: {i.packageName}</span>}
                  </td>
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

      <Section
        collapsible
        title={
          <>
            Lịch sử chỉnh sửa{o.revisions.length > 0 && <span className="ml-1.5 font-normal text-muted-foreground">({o.revisions.length})</span>}
          </>
        }
      >
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

      <Section title="Chứng từ" sectionRef={invoicesRef}>
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
    </>
  )
}

/**
 * Màn "Xem chi tiết" đơn (docs/api/THE_DON_HANG.md mục 2): thông tin, bảng hạng mục đầy đủ, lịch thanh toán 2 đợt,
 * lịch sử chỉnh sửa (OrderRevisions), chứng từ (Invoices). Khách và NCC thấy cùng nội dung.
 */
export function OrderDetailDialog({ order: o, onClose, onOpenForm, viewer = 'vendor' }: OrderDetailDialogProps) {
  const hint = orderHint(o)
  const vendorView = viewer === 'vendor'
  // Xem chứng từ ngay trong popup này (không mở popup thứ hai chồng lên), có nút Quay lại về chi tiết đơn
  const [viewing, setViewing] = useState<InvoiceType | null>(null)
  const invoicesRef = useRef<HTMLElement>(null)
  const back = useRef(false)
  const view = (_: Order, type: InvoiceType) => setViewing(type)
  useEffect(() => {
    // Quay lại: cuộn tới mục Chứng từ (chỗ vừa bấm Xem)
    if (viewing === null && back.current) {
      back.current = false
      invoicesRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [viewing])
  const goBack = () => {
    back.current = true
    setViewing(null)
  }
  const heading = viewing ? invoiceHeading(o, viewing) : null
  return (
    <PanelDialog
      open
      size="lg"
      onRequestClose={onClose}
      title={heading ? heading.title : `Đơn dịch vụ ${o.orderCode}`}
      subtitle={
        heading ? (
          heading.subtitle
        ) : (
          <span className="inline-flex flex-wrap items-center gap-2">
            <OrderStatusBadge status={o.status} />
            <PaidInFullBadge order={o} />
            <span>Tạo {formatDayTime(o.createdDate)}</span>
          </span>
        )
      }
      footer={
        viewing ? (
          <>
            <Button variant="outline" className="mr-auto border-line-strong" onClick={goBack}>
              <ArrowLeft />
              Quay lại
            </Button>
            <Button variant="outline" className="border-line-strong" onClick={onClose}>
              Đóng
            </Button>
          </>
        ) : (
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
                  onViewInvoice={view}
                />
              </div>
            )}
            <Button variant="outline" className="border-line-strong" onClick={onClose}>
              Đóng
            </Button>
          </>
        )
      }
    >
      {viewing && (
        <>
          <button type="button" onClick={goBack} className="mb-4 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-gold-ink hover:underline">
            <ArrowLeft className="size-4" />
            Quay lại chi tiết đơn
          </button>
          <InvoiceContent order={o} type={viewing} vendorName={vendorView ? undefined : o.vendorName} />
        </>
      )}
      {/* Giữ chi tiết đơn (ẩn) khi xem chứng từ để quay lại không phải dựng lại */}
      <div hidden={!!viewing}>
        <OrderDetailSections order={o} vendorView={vendorView} onViewInvoice={view} invoicesRef={invoicesRef} />
      </div>
    </PanelDialog>
  )
}

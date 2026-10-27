import { MessageSquareWarning } from 'lucide-react'
import type { ReactNode } from 'react'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { useNow } from '@/lib/clock'
import { cn } from '@/lib/utils'
import type { InvoiceType, Order } from '@/types/vendorOrder'
import { changesLabel, depositDeadline, formatStamp, openRevision, orderHint } from '../calc'
import { OrderActions } from './OrderActions'
import { OrderStatusBadge } from './OrderBadges'
import type { OrderFormMode } from './OrderFormDialog'

interface OrderCardProps {
  order: Order
  /** Đơn vừa gửi: làm nổi thẻ */
  highlight?: boolean
  onOpenForm: (mode: OrderFormMode) => void
  onView: (order: Order) => void
  onViewInvoice: (order: Order, type: InvoiceType) => void
}

const row = (label: string, value: ReactNode) => (
  <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-[13px]">
    <span className="whitespace-nowrap text-muted-foreground">{label}</span>
    <b className="text-right font-semibold">{value}</b>
  </div>
)

const HINT_TONE = {
  info: 'text-muted-foreground',
  ok: 'text-sage',
  warn: 'text-warn',
}

/**
 * Thẻ đơn dịch vụ trong chat (docs/api/THE_DON_HANG.md mục 2 đến 4), cùng bố cục thẻ đơn phía khách:
 * khách và NCC thấy cùng nội dung, chỉ khác dòng gợi ý và nút. Đọc dữ liệu trực tiếp từ đơn (không phải bản chụp).
 */
export function OrderCard({ order: o, highlight, onOpenForm, onView, onViewInvoice }: OrderCardProps) {
  // Đếm ngược hạn cọc tự chạy (dựng lại mỗi 30 giây, và khi tua đồng hồ giả lập)
  useNow()
  const hint = orderHint(o)
  // Khách yêu cầu chỉnh sửa (chỉ trước cọc): hộp cam, đơn đang NeedRevision
  const request = o.status === 'NeedRevision' ? openRevision(o) : undefined
  // Vừa cập nhật: Chờ cọc thì lần cập nhật trước cọc, Đã đặt cọc thì lần chỉnh sửa sau cọc; ghi tổng cũ, mới và nội dung thay đổi
  const last = o.revisions[0]
  const updated = last?.status === 'Applied' && ((o.status === 'Pending' && last.revisionType === 'BeforeDeposit') || (o.status === 'Deposited' && last.revisionType === 'AfterDeposit')) ? last : undefined
  const shown = o.items.slice(0, 2)

  return (
    <div
      data-order={o.id}
      className={cn(
        'w-[min(380px,100%)] self-end rounded-[22px] rounded-br-[5px] border border-line bg-surface px-5 py-[18px] text-left shadow-bubble transition-shadow',
        highlight && 'border-gold ring-4 ring-gold/25',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-2.5 gap-y-1.5 font-semibold">
        <span>Đơn dịch vụ {o.orderCode}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <OrderStatusBadge status={o.status} />
        </span>
      </div>
      <p className="mt-0.5 mb-1.5 text-[12.5px] text-muted-foreground">{o.customerName}</p>

      {shown.map((i) => (
        <div key={i.id} className="border-b border-dashed border-line py-1.5 text-[13px]">
          <div className="flex justify-between gap-3">
            <b className="min-w-0 font-semibold [overflow-wrap:anywhere]">{i.itemName}</b>
            <b className="font-semibold whitespace-nowrap">{formatMoney(i.amount)}</b>
          </div>
          <span className="text-muted-foreground">
            {i.quantity} {i.unit} × {formatMoney(i.unitPrice)}
          </span>
        </div>
      ))}
      {o.items.length > shown.length && <p className="border-b border-dashed border-line py-1.5 text-[12.5px] text-muted-foreground">và {o.items.length - shown.length} hạng mục khác</p>}

      {row('Ngày thực hiện', formatDate(o.eventDate))}
      {row('Tổng giá trị', formatMoney(o.totalAmount))}
      {updated && updated.newTotalAmount !== null && (
        <p className="border-b border-dashed border-line py-1.5 text-[12px] text-muted-foreground tabular-nums">
          Đã cập nhật: tổng {formatMoney(updated.oldTotalAmount)} → {formatMoney(updated.newTotalAmount)}
        </p>
      )}
      {updated?.revisionType === 'AfterDeposit' && updated.requestNote && (
        <p className="border-b border-dashed border-line py-1.5 text-[12.5px] whitespace-pre-wrap">
          <span className="text-muted-foreground">Nội dung thay đổi: </span>
          {updated.requestNote}
        </p>
      )}
      {row(`Đặt cọc (${o.depositPercent}%)`, <span className="text-primary">{formatMoney(o.depositAmount)}</span>)}
      {row('Còn lại', formatMoney(o.totalAmount - o.depositAmount))}
      {o.status === 'Pending' && o.depositDueDate && row('Hạn đặt cọc', <span className="text-gold-ink">{depositDeadline(o.depositDueDate).replace('Hạn cọc: ', '')}</span>)}

      {o.payment?.status === 'Paid' && o.payment.paidDate && (
        <div className="mt-2.5 text-[13px] font-semibold text-sage">
          Đã thanh toán cọc {formatMoney(o.depositAmount)} · {formatStamp(o.payment.paidDate)}
        </div>
      )}
      {o.note && <p className="mt-2.5 text-[13px] whitespace-pre-wrap">Ghi chú của bạn: {o.note}</p>}

      {request ? (
        <div className="mt-2.5 rounded-md border border-warn/40 bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-ink">
          <MessageSquareWarning className="mr-1.5 -mt-0.5 inline size-4 text-warn" aria-hidden />
          <b className="font-semibold text-warn">Khách yêu cầu:</b> {[changesLabel(request), request.requestNote ? `"${request.requestNote}"` : ''].filter(Boolean).join(' · ')}
        </div>
      ) : o.status === 'Pending' ? null : (
        // Chờ cọc: hạn đã có ở dòng "Hạn đặt cọc" phía trên, không nhắc lại bằng ô gợi ý
        <p className={cn('mt-2.5 rounded-sm px-2.5 py-2 text-[13px]', HINT_TONE[hint.tone], hint.tone === 'warn' && 'bg-warn-soft', hint.tone === 'ok' && 'bg-sage-soft', hint.tone === 'info' && 'bg-bg')}>
          {hint.text}
        </p>
      )}

      <OrderActions order={o} onOpenForm={onOpenForm} onView={onView} onViewInvoice={onViewInvoice} />
    </div>
  )
}

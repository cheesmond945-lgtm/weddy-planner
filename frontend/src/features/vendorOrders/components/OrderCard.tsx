import type { ReactNode } from 'react'
import { Badge } from '@/components/Badge'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { InvoiceType, Order } from '@/types/vendorOrder'
import { depositDeadline, formatStamp, openRevision, orderHint } from '../calc'
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
  const hint = orderHint(o)
  const afterDepositRequest = o.status === 'Deposited' && !!openRevision(o)
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
          {afterDepositRequest && <Badge tone="warn">Khách yêu cầu chỉnh sửa</Badge>}
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
      {row(
        `Đặt cọc (${o.depositPercent}%)`,
        <>
          <span className="text-primary">{formatMoney(o.depositAmount)}</span> <span className="font-normal text-muted-foreground">qua VNPay</span>
        </>,
      )}
      {row(
        'Còn lại',
        <>
          {formatMoney(o.totalAmount - o.depositAmount)}{' '}
          <span className="font-normal text-muted-foreground">(tiền mặt, thanh toán trực tiếp cho NCC)</span>
        </>,
      )}
      {o.status === 'Pending' && o.depositDueDate && row('Hạn đặt cọc', <span className="text-gold-ink">{depositDeadline(o.depositDueDate).replace('Hạn cọc: ', '')}</span>)}

      {o.payment?.status === 'Paid' && o.payment.paidDate && (
        <div className="mt-2.5 text-[13px] font-semibold text-sage">
          Đã thanh toán cọc {formatMoney(o.depositAmount)} · {formatStamp(o.payment.paidDate)}
        </div>
      )}
      {o.note && <p className="mt-2.5 text-[13px] whitespace-pre-wrap">Ghi chú của bạn: {o.note}</p>}

      <p className={cn('mt-2.5 rounded-sm px-2.5 py-2 text-[13px]', HINT_TONE[hint.tone], hint.tone === 'warn' && 'bg-warn-soft', hint.tone === 'ok' && 'bg-sage-soft', hint.tone === 'info' && 'bg-bg')}>
        {hint.text}
      </p>

      <OrderActions order={o} onOpenForm={onOpenForm} onView={onView} onViewInvoice={onViewInvoice} />
    </div>
  )
}

import type { ReactNode } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { canRequestRevision, depositDeadline, formatDayTime } from '@/features/vendorOrders/calc'
import { ORDER_STATUS } from '@/features/vendorOrders/constants'
import { InvoiceDialog } from '@/features/vendorOrders/components/InvoiceDialog'
import { OrderDetailDialog } from '@/features/vendorOrders/components/OrderDetailDialog'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { InvoiceType, Order } from '@/types/order'
import { hintOf, hintTone } from '../hint'
import { useOrder } from '../hooks'
import { EventDateNote } from './EventDateNote'

interface OrderCardProps {
  orderId: string
  categorySlug: string
  /** Thẻ mới nhất của đơn: gửi lại thì các thẻ cũ thu gọn thành một dòng */
  isLatest: boolean
  onRevise: (order: Order) => void
  /** Nhắn tin cho NCC (đưa con trỏ về ô nhập tin) */
  onMessageVendor: () => void
}

const HOUR = 3_600_000

/** Thẻ đơn dịch vụ NCC gửi trong khung chat, nội dung giống phía NCC (docs/THE_DON_PHIA_KHACH.md mục 1, 2). */
export function OrderCard({ orderId, categorySlug, isLatest, onRevise, onMessageVendor }: OrderCardProps) {
  const { data: o } = useOrder(orderId, { poll: isLatest })
  const navigate = useNavigate()
  const [detail, setDetail] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceType | null>(null)

  if (!o) return <div className="h-[230px] w-[min(360px,100%)] animate-pulse self-start rounded-[22px] bg-muted" />
  if (o.status === 'Draft') return null
  if (!isLatest) {
    return <p className="self-center rounded-pill bg-bg px-3.5 py-1.5 text-center text-[12.5px] text-muted-foreground">Đơn {o.orderCode} đã được cập nhật, xem bản mới nhất bên dưới</p>
  }

  const status = ORDER_STATUS[o.status]
  const row = (label: string, value: ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-[13px]">
      <span className="whitespace-nowrap text-muted-foreground">{label}</span>
      <b className="text-right font-semibold">{value}</b>
    </div>
  )

  const shown = o.items.slice(0, 2)
  const more = o.items.length - shown.length
  const dueMs = o.depositDueDate ? new Date(o.depositDueDate).getTime() - Date.now() : null
  const overdue = o.status === 'Pending' && dueMs !== null && dueMs <= 0
  const urgent = o.status === 'Pending' && dueMs !== null && dueMs < 6 * HOUR
  const paidDate = o.payment?.status === 'Paid' ? o.payment.paidDate : null
  const last = o.revisions[0]
  const updated = last && last.status === 'Applied' && last.newTotalAmount !== null && last.newTotalAmount !== last.oldTotalAmount ? last : null
  const hint = hintOf(o)
  const finalInvoice = o.invoices.some((i) => i.type === 'FinalInvoice')

  return (
    <div data-order={o.id} className="w-[min(360px,100%)] self-start rounded-[22px] rounded-bl-[4px] border border-line bg-surface px-5 py-[18px] shadow-bubble">
      <div className="flex items-center justify-between gap-2.5 font-semibold">
        <span>Đơn dịch vụ {o.orderCode}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {o.vendorName && <div className="mt-0.5 mb-2 text-[13px] text-muted-foreground">{o.vendorName}</div>}

      <div className="mb-1">
        {shown.map((i) => (
          <div key={i.id} className="border-b border-dashed border-line py-1.5 text-[13px]">
            <div className="flex justify-between gap-3">
              <span className="font-medium">{i.itemName}</span>
              <b className="text-right font-semibold whitespace-nowrap">{formatMoney(i.amount)}</b>
            </div>
            <div className="text-xs text-muted-foreground">
              {i.quantity} {i.unit} × {formatMoney(i.unitPrice)}
            </div>
          </div>
        ))}
        {more > 0 && <div className="border-b border-dashed border-line py-1.5 text-xs text-muted-foreground">và {more} hạng mục khác</div>}
      </div>

      {o.package && row('Sảnh', o.package.name)}
      {row('Ngày thực hiện', formatDate(o.eventDate))}
      <EventDateNote order={o} />
      {row('Tổng giá trị', formatMoney(o.totalAmount))}
      {updated && (
        <div className="border-b border-dashed border-line py-1.5 text-[12.5px] text-gold-700">
          Đã cập nhật: tổng {formatMoney(updated.oldTotalAmount)} → {formatMoney(updated.newTotalAmount as number)}
        </div>
      )}
      {o.status === 'Deposited' && last?.status === 'Applied' && last.revisionType === 'AfterDeposit' && last.requestNote && (
        <div className="border-b border-dashed border-line py-1.5 text-[12.5px] whitespace-pre-wrap">
          <span className="text-muted-foreground">Nội dung thay đổi: </span>
          {last.requestNote}
        </div>
      )}
      {row(`Đặt cọc (${Math.round(o.depositPercent * 100) / 100}%)`, <span className="text-gold-700">{formatMoney(o.depositAmount)}</span>)}
      {row('Còn lại', formatMoney(o.totalAmount - o.depositAmount))}
      {o.status === 'Pending' && o.depositDueDate && row('Hạn đặt cọc', <span className={cn(urgent && 'text-warn')}>{depositDeadline(o.depositDueDate).replace('Hạn cọc: ', '')}</span>)}
      {paidDate && (
        <div className="mt-2.5 text-[13px] font-semibold text-sage">
          Đã thanh toán cọc {formatMoney(o.depositAmount)} · {formatDayTime(paidDate)}
        </div>
      )}
      {o.note && <div className="mt-2 text-[13px] whitespace-pre-wrap">Ghi chú: {o.note}</div>}

      {hint && (
        <div
          className={cn(
            'mt-2.5 rounded-sm px-2.5 py-2 text-[13px] whitespace-pre-wrap',
            hintTone(o),
          )}
        >
          {hint}
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {o.status === 'Pending' && (
          <Button variant="success" disabled={overdue} onClick={() => navigate(paths.deal(o.id))}>
            {overdue ? 'Đơn đã hết hạn đặt cọc' : 'Thanh toán cọc'}
          </Button>
        )}
        {o.status === 'Deposited' && (
          <Button variant="outline" size="sm" onClick={() => navigate(`${paths.timeline}?category=${categorySlug}`)}>
            Xem việc cần làm
          </Button>
        )}
        {canRequestRevision(o) && (
          <Button variant="outline" size={o.status === 'Pending' ? 'default' : 'sm'} onClick={() => onRevise(o)}>
            Yêu cầu chỉnh sửa
          </Button>
        )}
        <Button variant="outline" size={o.status === 'Pending' ? 'default' : 'sm'} onClick={() => setDetail(true)}>
          Xem chi tiết
        </Button>
        {o.status === 'Completed' && finalInvoice && (
          <Button variant="outline" size="sm" onClick={() => setInvoice('FinalInvoice')}>
            Xem hóa đơn
          </Button>
        )}
        {o.status === 'Expired' && (
          <Button variant="outline" size="sm" onClick={onMessageVendor}>
            Nhắn tin cho NCC
          </Button>
        )}
      </div>

      {detail && <OrderDetailDialog order={o} viewer="couple" onClose={() => setDetail(false)} onViewInvoice={(_, type) => setInvoice(type)} />}
      {invoice && <InvoiceDialog order={o} type={invoice} vendorName={o.vendorName} onClose={() => setInvoice(null)} />}
    </div>
  )
}

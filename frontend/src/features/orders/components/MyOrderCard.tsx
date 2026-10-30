import { MessageCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { canRequestRevision, depositDeadline, formatDayTime } from '@/features/vendorOrders/calc'
import { ORDER_STATUS } from '@/features/vendorOrders/constants'
import { InvoiceDialog } from '@/features/vendorOrders/components/InvoiceDialog'
import { OrderDetailDialog } from '@/features/vendorOrders/components/OrderDetailDialog'
import { useNow } from '@/lib/clock'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { InvoiceType, Order } from '@/types/order'
import { hintOf, hintTone } from '../hint'
import { EventDateNote } from './EventDateNote'

const HOUR = 3_600_000

const row = (label: string, value: ReactNode) => (
  <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-[13px]">
    <span className="whitespace-nowrap text-muted-foreground">{label}</span>
    <b className="text-right font-semibold">{value}</b>
  </div>
)

/**
 * Một đơn trên trang Kế hoạch của tôi (dưới hạng mục của đơn): cùng nội dung với thẻ đơn trong chat (docs/THE_DON_PHIA_KHACH.md), gọn hơn,
 * kèm nút mở cuộc trò chuyện với NCC. Đợt 1 (cọc) thanh toán qua VNPay, đợt 2 (còn lại) trả tiền mặt cho NCC.
 */
export function MyOrderCard({ order: o, onRevise }: { order: Order; onRevise: (o: Order) => void }) {
  useNow()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceType | null>(null)

  const status = ORDER_STATUS[o.status]
  const dueMs = o.depositDueDate ? new Date(o.depositDueDate).getTime() - Date.now() : null
  const overdue = o.status === 'Pending' && dueMs !== null && dueMs <= 0
  const urgent = o.status === 'Pending' && dueMs !== null && dueMs < 6 * HOUR
  const paidDate = o.payment?.status === 'Paid' ? o.payment.paidDate : null
  const hint = hintOf(o)
  const finalInvoice = o.invoices.some((i) => i.type === 'FinalInvoice')
  const items = o.items.map((i) => i.itemName).join(', ')

  return (
    <article data-order={o.id} className="flex flex-col rounded-[18px] border border-line bg-surface px-5 py-[18px] shadow-bubble">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="font-sans text-[15px] font-semibold">Đơn {o.orderCode}</h3>
          {o.vendorName && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{o.vendorName}</p>}
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <p className="mt-2 mb-1 line-clamp-2 text-[13px] [overflow-wrap:anywhere]" title={items}>
        {items}
      </p>
      {row('Ngày thực hiện', formatDate(o.eventDate))}
      <EventDateNote order={o} />
      {row('Tổng giá trị', formatMoney(o.totalAmount))}
      {row(`Đợt 1 · Cọc ${Math.round(o.depositPercent * 100) / 100}% (VNPay)`, <span className="text-gold-700">{formatMoney(o.depositAmount)}</span>)}
      {row('Đợt 2 · Còn lại (tiền mặt cho NCC)', formatMoney(o.totalAmount - o.depositAmount))}
      {o.status === 'Pending' && o.depositDueDate && row('Hạn đặt cọc', <span className={cn(urgent && 'text-warn')}>{depositDeadline(o.depositDueDate).replace('Hạn cọc: ', '')}</span>)}
      {paidDate && (
        <p className="mt-2 text-[13px] font-semibold text-sage">
          Đã thanh toán cọc {formatMoney(o.depositAmount)} · {formatDayTime(paidDate)}
        </p>
      )}

      {hint && <div className={cn('mt-2.5 rounded-sm px-2.5 py-2 text-[13px] whitespace-pre-wrap', hintTone(o))}>{hint}</div>}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {o.status === 'Pending' && (
          <Button variant="success" size="sm" disabled={overdue} onClick={() => navigate(paths.deal(o.id))}>
            {overdue ? 'Đã hết hạn đặt cọc' : 'Thanh toán cọc'}
          </Button>
        )}
        {canRequestRevision(o) && (
          <Button variant="outline" size="sm" onClick={() => onRevise(o)}>
            Yêu cầu chỉnh sửa
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => setDetail(true)}>
          Xem chi tiết
        </Button>
        {finalInvoice && (
          <Button variant="outline" size="sm" onClick={() => setInvoice('FinalInvoice')}>
            Xem hóa đơn
          </Button>
        )}
        {o.conversationId && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`${paths.chat}?c=${encodeURIComponent(o.conversationId)}`)}>
            <MessageCircle />
            Nhắn NCC
          </Button>
        )}
      </div>

      {detail && <OrderDetailDialog order={o} viewer="couple" onClose={() => setDetail(false)} onViewInvoice={(_, type) => setInvoice(type)} />}
      {invoice && <InvoiceDialog order={o} type={invoice} vendorName={o.vendorName} onClose={() => setInvoice(null)} />}
    </article>
  )
}

import { Receipt } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { OrderStatusBadge } from '@/features/vendorOrders/components/OrderBadges'
import type { OrderFormMode } from '@/features/vendorOrders/components/OrderFormDialog'
import { CHANGE_LABEL } from '@/features/vendorOrders/constants'
import { depositDeadline, formatStamp } from '@/features/vendorOrders/calc'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { VendorMessage } from '@/types/vendorConversation'
import type { Order } from '@/types/vendorOrder'

interface MessageItemProps {
  message: VendorMessage
  order: Order | undefined
  /** Thẻ mới nhất của đơn (gửi lại thì các thẻ cũ thu gọn) */
  isLatestCard: boolean
  /** Đơn vừa gửi: làm nổi thẻ */
  highlight: boolean
  onOpenForm: (mode: OrderFormMode) => void
}

const Time = ({ at }: { at: string }) => <time className="mt-1 text-[11px] text-muted-foreground">{formatStamp(at)}</time>

/** Khung tin: của NCC bên phải, của khách bên trái; thẻ đơn rộng tối đa 440px. */
function Bubble({ mine, wide, at, children }: { mine: boolean; wide?: boolean; at: string; children: ReactNode }) {
  return (
    <div className={cn('grid max-w-[78%] max-[640px]:max-w-[94%]', mine ? 'self-end justify-items-end' : 'self-start', wide && 'w-full max-w-[min(440px,92%)] max-[640px]:max-w-full')}>
      {children}
      <Time at={at} />
    </div>
  )
}

const row = (label: string, value: ReactNode) => (
  <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-[13px]">
    <span className="whitespace-nowrap text-muted-foreground">{label}</span>
    <b className="text-right font-semibold">{value}</b>
  </div>
)

/**
 * Thẻ đơn trong chat (bản cơ bản của bước 1b: có nút mở form sửa theo trạng thái).
 * Nội dung đầy đủ theo docs/api/THE_DON_HANG.md và nút xem chi tiết, hoàn thành, hóa đơn làm ở bước 1c.
 */
function OrderCard({ order: o, highlight, onOpenForm }: { order: Order; highlight: boolean; onOpenForm: (mode: OrderFormMode) => void }) {
  const request = o.revisions.find((r) => r.status === 'Requested')
  return (
    <div
      data-order={o.id}
      className={cn('w-full overflow-hidden rounded-[22px] rounded-br-[5px] border border-line bg-surface text-left shadow-bubble transition-shadow', highlight && 'border-gold ring-4 ring-gold/25')}
    >
      <div className="px-5 py-[18px]">
        <div className="mb-1 flex items-center justify-between gap-2.5 font-semibold">
          <span>Đơn dịch vụ {o.orderCode}</span>
          <OrderStatusBadge status={o.status} />
        </div>
        <p className="mb-2 text-[12.5px] text-muted-foreground">{o.customerName}</p>
        {o.items.slice(0, 2).map((i) => (
          <div key={i.id}>{row(i.itemName, `${i.quantity} ${i.unit} × ${formatMoney(i.unitPrice)}`)}</div>
        ))}
        {o.items.length > 2 && <p className="py-1.5 text-[12.5px] text-muted-foreground">và {o.items.length - 2} hạng mục khác</p>}
        {row('Ngày thực hiện', formatDate(o.eventDate))}
        {row('Tổng giá trị', formatMoney(o.totalAmount))}
        {row(`Đặt cọc (${o.depositPercent}%)`, <span className="text-primary">{formatMoney(o.depositAmount)}</span>)}
        {row('Còn lại', `${formatMoney(o.totalAmount - o.depositAmount)} (tiền mặt, trực tiếp)`)}
        {o.status === 'Pending' && o.depositDueDate && <p className="mt-2 text-[12.5px] font-medium text-gold-ink">{depositDeadline(o.depositDueDate)}</p>}
        {o.payment?.status === 'Paid' && o.payment.paidDate && (
          <p className="mt-2 text-[13px] font-semibold text-sage">
            Đã thanh toán cọc {formatMoney(o.depositAmount)} · {formatStamp(o.payment.paidDate)}
          </p>
        )}
        {o.note && <p className="mt-2 text-[13px] text-muted-foreground">Ghi chú: {o.note}</p>}
        {request && (
          <p className="mt-2 rounded-md border-l-[3px] border-warn bg-warn-soft px-3 py-2 text-[13px] text-ink">
            Khách yêu cầu: {request.changes.map((c) => CHANGE_LABEL[c]).join(', ') || 'chỉnh sửa'}
            {request.requestNote ? ` · ${request.requestNote}` : ''}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {(o.status === 'Pending' || o.status === 'NeedRevision') && (
            <Button size="sm" variant={o.status === 'NeedRevision' ? 'default' : 'outline'} className={o.status === 'NeedRevision' ? '' : 'border-line-strong'} onClick={() => onOpenForm({ kind: 'resend', order: o })}>
              Sửa và gửi lại
            </Button>
          )}
          {o.status === 'Deposited' && (
            <Button size="sm" variant="outline" className="border-line-strong" onClick={() => onOpenForm({ kind: 'edit', order: o })}>
              Sửa đơn
            </Button>
          )}
          {o.status === 'Expired' && (
            <Button size="sm" onClick={() => onOpenForm({ kind: 'again', from: o })}>
              Tạo đơn mới từ đơn này
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Một tin trong khung chat, theo Messages.Type. */
export function MessageItem({ message: m, order, isLatestCard, highlight, onOpenForm }: MessageItemProps) {
  switch (m.type) {
    case 'Order': {
      if (!order) break
      if (!isLatestCard) {
        return (
          <p className="self-center rounded-pill bg-bg px-3.5 py-1.5 text-center text-[12.5px] text-muted-foreground">
            Đơn {order.orderCode} đã được cập nhật, xem bản mới nhất bên dưới <time className="ml-1 text-[11px]">{formatStamp(m.sentDate)}</time>
          </p>
        )
      }
      return (
        <Bubble mine wide at={m.sentDate}>
          <OrderCard order={order} highlight={highlight} onOpenForm={onOpenForm} />
        </Bubble>
      )
    }
    case 'DepositReceipt':
    case 'FinalInvoice':
      return (
        <Bubble mine={false} wide at={m.sentDate}>
          <div className="flex items-start gap-2.5 rounded-[18px] border border-line bg-surface px-4 py-3 text-[13.5px] leading-relaxed">
            <Receipt className="mt-0.5 size-4 flex-none text-sage" />
            <span>{m.content}</span>
          </div>
        </Bubble>
      )
  }

  if (m.sender === 'SYSTEM') {
    return (
      <p
        className={cn(
          'flex max-w-[94%] flex-wrap items-center justify-center gap-x-2 self-center rounded-[20px] px-[15px] py-[9px] text-center text-[13px]',
          /hủy|hết hạn/i.test(m.content) ? 'bg-warn-soft text-warn' : 'bg-sage-soft text-sage',
        )}
      >
        {m.content}
        <span className="text-[11.5px] text-muted-foreground">{formatStamp(m.sentDate)}</span>
      </p>
    )
  }

  const mine = m.sender === 'VENDOR'
  return (
    <Bubble mine={mine} at={m.sentDate}>
      <div className={cn('rounded-[20px] px-[15px] py-[11px] text-[13px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere]', mine ? 'rounded-br-[5px] bg-primary text-primary-foreground' : 'rounded-bl-[5px] bg-bg text-ink')}>
        {m.content}
      </div>
    </Bubble>
  )
}

import { MessageCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { canRequestRevision, depositDeadline, formatDayTime } from '@/features/vendorOrders/calc'
import { ORDER_STATUS } from '@/features/vendorOrders/constants'
import { InvoiceDialog } from '@/features/vendorOrders/components/InvoiceDialog'
import { PaidInFullBadge } from '@/features/vendorOrders/components/OrderBadges'
import { OrderDetailDialog } from '@/features/vendorOrders/components/OrderDetailDialog'
import { REST_TONE_CLASS, restLabel } from '@/features/vendorOrders/restPayment'
import { useNow } from '@/lib/clock'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { InvoiceType, Order } from '@/types/order'
import { hintOf, hintTone } from '../hint'
import { DepositTermsDialog } from './DepositTermsDialog'
import { EventDateNote } from './EventDateNote'

const HOUR = 3_600_000

const row = (label: string, value: ReactNode) => (
  <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-[13px]">
    <span className="whitespace-nowrap text-muted-foreground">{label}</span>
    <b className="text-right font-semibold">{value}</b>
  </div>
)

interface CoupleOrderCardProps {
  order: Order
  /**
   * chat: thẻ đơn NCC gửi trong khung chat (bong bóng bên trái).
   * plan: thẻ đơn dưới hạng mục trên trang Kế hoạch của tôi (có thêm nút mở cuộc trò chuyện).
   */
  variant: 'chat' | 'plan'
  /** Slug hạng mục, cho nút "Xem việc cần làm" (chỉ thẻ trong chat) */
  categorySlug?: string
  onRevise: (order: Order) => void
  /** Nhắn tin cho NCC (đưa con trỏ về ô nhập tin), chỉ thẻ trong chat */
  onMessageVendor?: () => void
}

/**
 * Thẻ đơn dịch vụ phía khách, dùng chung cho khung chat và trang Kế hoạch (docs/THE_DON_PHIA_KHACH.md): cùng nội dung, cùng nút,
 * chỉ khác khung ngoài và nút mở cuộc trò chuyện. Đợt 1 (cọc) thanh toán qua VietQR, đợt 2 (còn lại) trả tiền mặt trực tiếp cho NCC
 * và chỉ có một dòng. Hạn chót đợt 2 là ngày thực hiện, trả sớm lúc nào cũng được.
 */
export function CoupleOrderCard({ order: o, variant, categorySlug, onRevise, onMessageVendor }: CoupleOrderCardProps) {
  useNow()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceType | null>(null)
  const [termsOpen, setTermsOpen] = useState(false)

  const chat = variant === 'chat'
  const status = ORDER_STATUS[o.status]
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
  const rest = o.restPayment
  const restAmount = rest?.amount ?? o.totalAmount - o.depositAmount
  const restKnown = !!rest && rest.status !== 'NotApplicable'
  // Hạn chót đợt 2 chỉ nhắc khi đơn còn hiệu lực và chưa trả; quá hạn không cảnh báo (khách và NCC tự thỏa thuận)
  const showDeadline = ['Pending', 'NeedRevision', 'Deposited'].includes(o.status) && rest?.status !== 'Received'
  const btnSize = o.status === 'Pending' && chat ? 'default' : 'sm'

  return (
    <article
      data-order={o.id}
      className={cn(
        'border border-line bg-surface px-5 py-[18px] shadow-bubble',
        chat ? 'w-[min(360px,100%)] self-start rounded-[22px] rounded-bl-[4px]' : 'flex flex-col rounded-[18px]',
      )}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="font-sans text-[15px] font-semibold">Đơn dịch vụ {o.orderCode}</h3>
          {o.vendorName && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{o.vendorName}</p>}
        </div>
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          <PaidInFullBadge order={o} />
        </span>
      </div>

      <div className="mt-2 mb-1">
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
      {row(`Đợt 1 · Cọc ${Math.round(o.depositPercent * 100) / 100}% (VietQR)`, <span className="text-gold-700">{formatMoney(o.depositAmount)}</span>)}
      {row(
        'Đợt 2 · Còn lại (tiền mặt cho NCC)',
        restKnown ? (
          <span>
            {formatMoney(restAmount)} — <span className={REST_TONE_CLASS[restLabel(o, 'COUPLE').tone]}>{restLabel(o, 'COUPLE').text}</span>
          </span>
        ) : (
          formatMoney(restAmount)
        ),
      )}
      {showDeadline && <div className="border-b border-dashed border-line py-1.5 text-[12.5px] text-muted-foreground">Hạn chót đợt 2: {formatDate(o.eventDate)} (ngày cưới). Bạn có thể trả sớm hơn.</div>}
      {o.status === 'Pending' && o.depositDueDate && row('Hạn đặt cọc', <span className={cn(urgent && 'text-warn')}>{depositDeadline(o.depositDueDate).replace('Hạn cọc: ', '')}</span>)}
      {paidDate && (
        <p className="mt-2 text-[13px] font-semibold text-sage">
          Đã thanh toán cọc {formatMoney(o.depositAmount)} · {formatDayTime(paidDate)}
        </p>
      )}
      {o.note && <p className="mt-2 text-[13px] whitespace-pre-wrap">Ghi chú của NCC: {o.note}</p>}

      {hint && <div className={cn('mt-2.5 rounded-sm px-2.5 py-2 text-[13px] whitespace-pre-wrap', hintTone(o))}>{hint}</div>}

      <div className={cn('flex flex-wrap gap-2', chat ? 'mt-3' : 'mt-auto pt-3')}>
        {o.status === 'Pending' && (
          <Button variant="success" size={btnSize} disabled={overdue} onClick={() => navigate(paths.deal(o.id))}>
            {overdue ? 'Đã hết hạn đặt cọc' : 'Thanh toán cọc'}
          </Button>
        )}
        {chat && o.status === 'Deposited' && categorySlug && (
          <Button variant="outline" size="sm" onClick={() => navigate(`${paths.timeline}?category=${categorySlug}`)}>
            Xem việc cần làm
          </Button>
        )}
        {canRequestRevision(o) && (
          <Button variant="outline" size={btnSize} onClick={() => onRevise(o)}>
            Yêu cầu chỉnh sửa
          </Button>
        )}
        <Button variant="outline" size={btnSize} onClick={() => setDetail(true)}>
          Xem chi tiết
        </Button>
        {finalInvoice && (
          <Button variant="outline" size={btnSize} onClick={() => setInvoice('FinalInvoice')}>
            Xem hóa đơn
          </Button>
        )}
        {chat && o.status === 'Expired' && (
          <Button variant="outline" size="sm" onClick={onMessageVendor}>
            Nhắn tin cho NCC
          </Button>
        )}
        {!chat && o.conversationId && (
          <Button variant="ghost" size="sm" onClick={() => navigate(`${paths.chat}?c=${encodeURIComponent(o.conversationId)}`)}>
            <MessageCircle />
            Nhắn NCC
          </Button>
        )}
      </div>

      {o.status === 'Pending' && !overdue && (
        <button type="button" className="mt-2.5 self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-ink" onClick={() => setTermsOpen(true)}>
          Xem điều khoản đặt dịch vụ
        </button>
      )}
      <DepositTermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
      {detail && <OrderDetailDialog order={o} viewer="couple" onClose={() => setDetail(false)} onViewInvoice={(_, type) => setInvoice(type)} />}
      {invoice && <InvoiceDialog order={o} type={invoice} vendorName={o.vendorName} onClose={() => setInvoice(null)} />}
    </article>
  )
}

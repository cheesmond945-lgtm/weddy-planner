import { Clock, MessageCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { FormError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { canRequestRevision, formatDayTime } from '@/features/vendorOrders/calc'
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
import { openRevision } from '@/features/vendorOrders/calc'
import type { InvoiceType, Order } from '@/types/order'
import { depositChip, endedReason, itemsSummaryParts } from '../cardSummary'
import { useCreateDeposit } from '../hooks'
import { DepositQrDialog } from './DepositQrDialog'
import { DepositTermsDialog } from './DepositTermsDialog'
import { EventDateNote } from './EventDateNote'
import { CoupleOrderRequests } from './OrderRequests'

/**
 * Một dòng của phần tiền: MỘT cỡ chữ và một màu cho mọi nhãn, một cỡ cho mọi giá trị; "Tổng giá trị" (strong) chỉ đậm hơn.
 * Nhãn bên trái cắt "…" nếu dài, giá trị bên phải không xuống dòng và thẳng cột (tabular-nums).
 */
const ROW = 'flex items-baseline justify-between gap-3 py-1 text-[13.5px] leading-snug'
const money = (label: ReactNode, value: ReactNode, opts: { strong?: boolean; accent?: boolean; note?: ReactNode } = {}) => (
  <div className="py-0.5">
    <div className={cn(ROW, 'py-0.5')}>
      <dt className={cn('min-w-0 truncate text-muted-foreground', opts.strong && 'font-semibold')}>{label}</dt>
      <dd className={cn('shrink-0 text-right font-medium whitespace-nowrap tabular-nums', opts.strong && 'font-semibold', opts.accent && 'text-gold-ink')}>{value}</dd>
    </div>
    {opts.note && <div className="text-right text-xs leading-snug">{opts.note}</div>}
  </div>
)

interface CoupleOrderCardProps {
  order: Order
  /**
   * chat: thẻ đơn NCC gửi trong khung chat (bong bóng bên trái).
   * plan: thẻ đơn dưới hạng mục trên trang Kế hoạch của tôi (có thêm nút mở cuộc trò chuyện).
   */
  variant: 'chat' | 'plan'
  /** Slug hạng mục, cho nút "Xem việc cần làm" (mặc định lấy từ đơn) */
  categorySlug?: string
  onRevise: (order: Order) => void
  /** Nhắn tin cho NCC (đưa con trỏ về ô nhập tin), chỉ thẻ trong chat */
  onMessageVendor?: () => void
}

/**
 * Thẻ đơn dịch vụ phía khách, dùng chung cho khung chat và trang Kế hoạch (docs/THE_DON_PHIA_KHACH.md): cùng nội dung, cùng nút, chỉ khác
 * khung ngoài và nút mở cuộc trò chuyện. Thẻ chỉ giữ phần cốt lõi (NCC, hạng mục tóm tắt, ngày, tiền, nút); đơn giá từng dòng, sảnh, phương thức,
 * hạn chót đợt 2 và lịch sử nằm trong "Xem chi tiết". Bố cục 3 phần: đầu, tiền, hành động. Đơn hết hạn / hủy thu gọn một dòng.
 * Đợt 1 (cọc) thanh toán qua VietQR, đợt 2 (còn lại) trả tiền mặt trực tiếp cho NCC.
 */
export function CoupleOrderCard({ order: o, variant, categorySlug, onRevise, onMessageVendor }: CoupleOrderCardProps) {
  useNow()
  const navigate = useNavigate()
  const [detail, setDetail] = useState(false)
  const [invoice, setInvoice] = useState<InvoiceType | null>(null)
  const [termsOpen, setTermsOpen] = useState(false)
  const [agreed, setAgreed] = useState(false)
  const deposit = useCreateDeposit()

  const chat = variant === 'chat'
  const status = ORDER_STATUS[o.status]
  // Đơn hết hạn / đã hủy cùng tông xám
  const ended = o.status === 'Expired' || o.status === 'Cancelled'
  const chip = o.status === 'Pending' && o.depositDueDate ? depositChip(o.depositDueDate, Date.now()) : null
  const paidDate = o.payment?.status === 'Paid' ? o.payment.paidDate : null
  const last = o.revisions[0]
  const updated = last && last.status === 'Applied' && last.newTotalAmount !== null && last.newTotalAmount !== last.oldTotalAmount ? last : null
  const finalInvoice = o.invoices.some((i) => i.type === 'FinalInvoice')
  const rest = o.restPayment
  const restAmount = rest?.amount ?? o.totalAmount - o.depositAmount
  const restKnown = !!rest && rest.status !== 'NotApplicable'
  const waiting = openRevision(o)
  const slug = categorySlug ?? o.category?.slug
  const summary = itemsSummaryParts(o.items)
  const pct = `${Math.round(o.depositPercent * 100) / 100}%`
  const awaitingDeposit = o.status === 'Pending' || o.status === 'NeedRevision'

  const shell = cn(
    'border border-line bg-surface',
    chat ? 'w-[min(360px,100%)] self-start rounded-[22px] rounded-bl-[4px]' : 'flex flex-col rounded-[22px]',
  )

  const detailLink = (
    <button type="button" onClick={() => setDetail(true)} className="ml-auto text-[13px] font-medium text-gold-ink underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
      Xem chi tiết →
    </button>
  )

  const dialogs = (
    <>
      <DepositTermsDialog open={termsOpen} onOpenChange={setTermsOpen} />
      <DepositQrDialog orderId={o.id} amount={o.depositAmount} info={deposit.data} open={deposit.isPending || !!deposit.data} onClose={() => deposit.reset()} />
      {detail && <OrderDetailDialog order={o} viewer="couple" onClose={() => setDetail(false)} onViewInvoice={(_, type) => setInvoice(type)} />}
      {invoice && <InvoiceDialog order={o} type={invoice} vendorName={o.vendorName} onClose={() => setInvoice(null)} />}
    </>
  )

  // Hết hạn / Hủy: một dòng "NCC · trạng thái · lý do ngắn", không bóng, chữ nhạt
  if (ended) {
    return (
      <article data-order={o.id} className={cn(shell, 'bg-surface-2/60 px-4 py-3 text-muted-foreground')}>
        <p className="line-clamp-2 text-[13.5px] leading-snug [overflow-wrap:anywhere]">
          <b className="font-semibold">{o.vendorName}</b> · {status.label} · {endedReason(o.status, o.cancelReason)}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-xs tabular-nums">{o.orderCode}</span>
          {chat && o.status === 'Expired' && (
            <button type="button" onClick={onMessageVendor} className="text-[13px] font-medium text-gold-ink underline-offset-2 hover:underline">
              Nhắn tin cho NCC
            </button>
          )}
          {detailLink}
        </div>
        {dialogs}
      </article>
    )
  }

  return (
    <article
      data-order={o.id}
      className={cn(shell, 'p-5 shadow-card transition-shadow duration-150 ease-out hover:shadow-[0_12px_28px_rgb(var(--shadow-rgb)/0.14)] motion-reduce:transition-none', o.status === 'Completed' && 'bg-surface')}
    >
      {/* Phần đầu: NCC, mã đơn, trạng thái, hạng mục tóm tắt */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 font-serif text-[19px] leading-snug font-semibold [overflow-wrap:anywhere]">{o.vendorName}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">{o.orderCode}</p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          <PaidInFullBadge order={o} />
        </span>
      </header>
      <div className={cn(ROW, 'mt-3 text-muted-foreground')}>
        <span className="flex min-w-0 items-baseline">
          <span className="truncate">{summary.name}</span>
          {summary.more && <span className="shrink-0 whitespace-pre">{summary.more}</span>}
        </span>
        {summary.qty && <span className="shrink-0 text-right whitespace-nowrap tabular-nums">{summary.qty}</span>}
      </div>

      {/* Phần tiền */}
      <dl className="mt-4 border-t border-line pt-3">
        {money('Ngày thực hiện', formatDate(o.eventDate))}
        {money('Tổng giá trị', formatMoney(o.totalAmount), { strong: true })}
        {updated && <div className="pb-1 text-right text-xs text-gold-ink">Đã cập nhật: {formatMoney(updated.oldTotalAmount)} → {formatMoney(updated.newTotalAmount as number)}</div>}
        {money(paidDate ? `Đã cọc · ${formatDayTime(paidDate)}` : `Cọc ${pct}`, formatMoney(o.depositAmount), { accent: awaitingDeposit })}
        {money('Còn lại', formatMoney(restAmount), {
          note: restKnown && o.status !== 'NeedRevision' ? <span className={REST_TONE_CLASS[restLabel(o, 'COUPLE').tone]}>{restLabel(o, 'COUPLE').text}</span> : undefined,
        })}
      </dl>
      <EventDateNote order={o} />

      {/* Phần hành động */}
      <div className="mt-4 border-t border-line pt-4">
        {chip && (
          <p
            className={cn(
              'mb-3 inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold',
              chip.urgent ? 'bg-warn-soft text-warn' : 'bg-[color-mix(in_srgb,var(--gold)_16%,var(--surface))] text-gold-ink',
            )}
          >
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {chip.text}
          </p>
        )}
        {(o.status === 'NeedRevision' || (o.status === 'Deposited' && waiting)) && (
          <p className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-[color-mix(in_srgb,var(--gold)_16%,var(--surface))] px-3 py-1 text-xs font-semibold text-gold-ink">
            <Clock className="size-3.5 shrink-0" aria-hidden />
            {o.status === 'NeedRevision' ? 'Đang chờ nhà cung cấp chỉnh sửa đơn' : 'Đang chờ nhà cung cấp xử lý yêu cầu'}
          </p>
        )}

        {/* Sau cọc: đổi số khách (đơn tiệc), yêu cầu hủy đơn */}
        <CoupleOrderRequests order={o} />

        <div className="flex flex-wrap gap-2 [&>button]:min-w-[140px] [&>button]:grow [&>button]:basis-[140px]">
          {o.status === 'Pending' && (
            <Button variant="success" size={chat ? 'default' : 'sm'} disabled={chip?.overdue || !agreed || deposit.isPending} onClick={() => deposit.mutate(o.id)}>
              {chip?.overdue ? 'Đã hết hạn đặt cọc' : 'Thanh toán cọc'}
            </Button>
          )}
          {o.status === 'Deposited' && slug && (
            <Button variant="outline" size="sm" onClick={() => navigate(`${paths.timeline}?category=${slug}`)}>
              Xem việc cần làm
            </Button>
          )}
          {canRequestRevision(o) && (
            <Button variant="outline" size={o.status === 'Pending' && chat ? 'default' : 'sm'} onClick={() => onRevise(o)}>
              Yêu cầu chỉnh sửa
            </Button>
          )}
          {finalInvoice && (
            <Button variant="outline" size="sm" onClick={() => setInvoice('FinalInvoice')}>
              Xem hóa đơn
            </Button>
          )}
          {!chat && o.conversationId && (
            <Button variant="ghost" size="sm" onClick={() => navigate(`${paths.chat}?c=${encodeURIComponent(o.conversationId)}`)}>
              <MessageCircle />
              Nhắn NCC
            </Button>
          )}
        </div>
        {deposit.isError && <FormError message={deposit.error.message} />}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          {o.status === 'Pending' && !chip?.overdue && (
            <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="accent-primary" />
              <span>
                Tôi đã đọc và đồng ý{' '}
                <button type="button" className="underline underline-offset-2 hover:text-ink" onClick={() => setTermsOpen(true)}>
                  Điều khoản đặt dịch vụ
                </button>
              </span>
            </label>
          )}
          {detailLink}
        </div>
      </div>
      {dialogs}
    </article>
  )
}

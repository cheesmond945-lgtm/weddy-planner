import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { ORDER_STATUS } from '@/features/weddings/status'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import type { Order } from '@/types/order'
import { useOrder } from '../hooks'

interface OrderCardProps {
  orderId: string
  categorySlug: string
  onRevise: (order: Order) => void
}

/** Thẻ đơn dịch vụ NCC gửi trong khung chat (orderHtml trong prototype, 7.3). */
export function OrderCard({ orderId, categorySlug, onRevise }: OrderCardProps) {
  const { data: o } = useOrder(orderId, { poll: true })
  const navigate = useNavigate()

  if (!o) return <div className="h-[230px] w-[min(360px,100%)] animate-pulse self-start rounded-[22px] bg-muted" />

  const status = ORDER_STATUS[o.status]
  const row = (label: string, value: ReactNode) => (
    <div className="flex justify-between gap-3 border-b border-dashed border-line py-1.5 text-[13px]">
      <span className="whitespace-nowrap text-muted-foreground">{label}</span>
      <b className="text-right font-semibold">{value}</b>
    </div>
  )

  return (
    <div className="w-[min(360px,100%)] self-start rounded-[22px] rounded-bl-[4px] border border-line bg-surface px-5 py-[18px] shadow-bubble">
      <div className="mb-2 flex items-center justify-between gap-2.5 font-semibold">
        <span>Đơn dịch vụ {o.code}</span>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      {row('Gói dịch vụ', o.packageName)}
      {row('Ngày thực hiện', formatDate(o.serviceDate))}
      {row('Tổng giá trị', formatMoney(o.totalAmount))}
      {row('Cần cọc trước', <span className="text-primary">{formatMoney(o.depositAmount)}</span>)}
      {row(
        'Còn lại',
        <>
          {formatMoney(o.totalAmount - o.depositAmount)} <span className="font-normal text-muted-foreground">(thanh toán trực tiếp cho NCC)</span>
        </>,
      )}

      {o.status === 'PAID' && (
        <>
          <div className="mt-2.5 text-[13px] font-semibold text-sage">Đã thanh toán cọc {formatMoney(o.depositAmount)}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`${paths.timeline}?category=${categorySlug}`)}>
              Xem việc cần làm
            </Button>
          </div>
        </>
      )}
      {o.status === 'REVISION_REQUESTED' && (
        <div className="mt-2.5 rounded-sm bg-[color-mix(in_srgb,var(--gold)_14%,var(--surface))] px-2.5 py-2 text-[13px] whitespace-pre-wrap">
          <b className="font-semibold">Bạn đã yêu cầu chỉnh sửa:</b>
          <br />
          {o.revisionNote}
          <br />
          <span className="text-muted-foreground">Chờ nhà cung cấp gửi lại đơn.</span>
        </div>
      )}
      {o.status === 'SENT' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="success" onClick={() => navigate(paths.deal(o.id))}>
            Xác nhận &amp; thanh toán cọc
          </Button>
          <Button variant="outline" onClick={() => onRevise(o)}>
            Yêu cầu chỉnh sửa
          </Button>
        </div>
      )}
    </div>
  )
}

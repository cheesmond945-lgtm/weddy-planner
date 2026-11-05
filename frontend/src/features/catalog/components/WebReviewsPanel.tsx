import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useMyOrders } from '@/features/orders/hooks'
import { ReviewDialog } from '@/features/reviews/components/ReviewDialog'
import { useOrderReviews } from '@/features/reviews/hooks'
import { formatDate, formatRelativeTime } from '@/lib/date'
import type { ServiceReview } from '@/types/review'
import { useReviewSummary, useServiceReviews } from '../hooks'
import { DetailCard } from './DetailCard'
import { StarRating } from './StarRating'

const CLAMP = 240

/** Tab "Đánh giá và phản hồi": đánh giá của khách đã đặt dịch vụ trên web (bảng reviews), đặt trên phần đánh giá Google Maps. */
export function WebReviewsPanel({ serviceId }: { serviceId: string }) {
  return (
    <DetailCard title="Đánh giá từ khách đã đặt dịch vụ">
      <ReviewInvite serviceId={serviceId} />
      <WebReviewsContent serviceId={serviceId} />
    </DetailCard>
  )
}

/**
 * Khách đang đăng nhập có đơn Hoàn thành với nhà cung cấp này mà chưa đánh giá: ô mời nêu cảm nhận (mở form đánh giá của đơn đó).
 * Không phải khách / không có đơn hoàn thành thì không hiện gì.
 */
function ReviewInvite({ serviceId }: { serviceId: string }) {
  const orders = useMyOrders()
  const done = (orders.data ?? []).filter((o) => o.status === 'Completed' && o.serviceId === serviceId)
  return (
    <>
      {done.map((o) => (
        <InviteForOrder key={o.id} orderId={o.id} orderCode={o.orderCode} vendorName={o.vendorName} />
      ))}
    </>
  )
}

function InviteForOrder({ orderId, orderCode, vendorName }: { orderId: string; orderCode: string; vendorName?: string }) {
  const q = useOrderReviews(orderId)
  const [open, setOpen] = useState(false)
  const items = q.data ?? []
  const pkgOnly = items.some((i) => i.isPackage)
  if (!items.some((i) => i.canReview && (i.isPackage || !pkgOnly))) return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-gold-500 bg-gold-100 px-4 py-3 text-sm text-gold-800">
      <span className="min-w-0 flex-1">
        <b className="font-semibold">Bạn đã dùng dịch vụ này</b> (đơn {orderCode}). Chia sẻ cảm nhận để giúp các cặp đôi khác nhé!
      </span>
      <Button size="sm" onClick={() => setOpen(true)}>
        Đánh giá dịch vụ
      </Button>
      {open && <ReviewDialog orderId={orderId} vendorName={vendorName} onClose={() => setOpen(false)} />}
    </div>
  )
}

function WebReviewsContent({ serviceId }: { serviceId: string }) {
  const summary = useReviewSummary(serviceId)
  const list = useServiceReviews(serviceId)

  if (summary.isPending || list.isPending) {
    return (
      <div aria-busy="true" aria-label="Đang tải đánh giá" className="space-y-4">
        <div className="h-12 w-48 animate-pulse rounded-md bg-muted" />
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="size-10 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-40 animate-pulse rounded-sm bg-muted" />
              <div className="h-3 w-full animate-pulse rounded-sm bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (summary.isError || list.isError) {
    return (
      <div className="rounded-xl border border-dashed border-line p-[26px] text-center">
        <p className="text-muted-foreground">Chưa tải được đánh giá.</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={summary.isFetching || list.isFetching}
          onClick={() => {
            summary.refetch()
            list.refetch()
          }}
        >
          Thử lại
        </Button>
      </div>
    )
  }

  const { count, average } = summary.data
  const reviews = list.data.pages.flatMap((p) => p.data)

  if (!count || !reviews.length) {
    return <p className="rounded-xl border border-dashed border-line p-5 text-center text-muted-foreground">Chưa có đánh giá nào. Đánh giá chỉ đến từ khách đã đặt và hoàn thành dịch vụ.</p>
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        {average !== null && <b className="font-serif text-[40px] leading-none font-semibold">{average.toFixed(1)}</b>}
        <div>
          {average !== null && <StarRating value={average} size={16} />}
          <div className="text-[13px] text-muted-foreground">{count} đánh giá từ khách đã đặt dịch vụ</div>
        </div>
      </div>

      <ul className="mt-5 grid list-none gap-5 p-0">
        {reviews.map((r) => (
          <ReviewItem key={r.id} review={r} />
        ))}
      </ul>

      {list.hasNextPage && (
        <Button variant="outline" size="sm" className="mt-5" disabled={list.isFetchingNextPage} onClick={() => list.fetchNextPage()}>
          {list.isFetchingNextPage ? 'Đang tải…' : `Xem thêm đánh giá (${count - reviews.length})`}
        </Button>
      )}
    </>
  )
}

function ReviewItem({ review }: { review: ServiceReview }) {
  const [expanded, setExpanded] = useState(false)
  const textId = useId()
  const long = review.content.length > CLAMP
  const shown = long && !expanded ? `${review.content.slice(0, CLAMP).trimEnd()}…` : review.content
  const initials = review.customerName
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <li className="flex gap-3">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-gold">
        {initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="font-semibold">{review.customerName}</span>
          <time dateTime={review.createdAt} title={formatDate(review.createdAt.slice(0, 10))} className="text-xs text-muted-foreground">
            {formatRelativeTime(review.createdAt) ?? formatDate(review.createdAt.slice(0, 10))}
          </time>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <StarRating value={review.rating} size={13} />
          {review.packageName && <span className="text-xs text-muted-foreground">Gói: {review.packageName}</span>}
        </div>
        <p id={textId} className="mt-1.5 leading-[1.6] whitespace-pre-line [overflow-wrap:anywhere]">
          {shown}
        </p>
        {long && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={textId}
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 text-sm font-medium text-gold-700 underline underline-offset-[3px]"
          >
            {expanded ? 'Thu gọn' : 'Xem thêm'}
          </button>
        )}
        {review.tags?.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {review.tags.map((t) => (
              <span key={t} className="rounded-pill bg-gold-100 px-2.5 py-0.5 text-[12px] text-gold-800">
                {t}
              </span>
            ))}
          </div>
        )}
        {review.vendorReply && (
          <div className="mt-3 rounded-md border-l-2 border-gold bg-surface-2 px-3 py-2 text-[13.5px]">
            <b className="font-semibold">Phản hồi từ nhà cung cấp</b>
            <p className="mt-0.5 leading-[1.6] whitespace-pre-line [overflow-wrap:anywhere]">{review.vendorReply.content}</p>
          </div>
        )}
      </div>
    </li>
  )
}

import { ExternalLink } from 'lucide-react'
import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { formatRelativeTime } from '@/lib/date'
import { formatNumber } from '@/lib/format'
import type { GoogleReview } from '@/types/googleRating'
import { useGoogleRating } from '../useGoogleRating'
import { DetailCard } from './DetailCard'
import { GoogleAttribution } from './GoogleAttribution'
import { StarRating } from './StarRating'

const CLAMP = 240

/** Tab "Đánh giá và phản hồi": điểm và tối đa 5 đánh giá Google Maps. */
export function GoogleReviewsPanel({ vendorId, mapsUrl }: { vendorId: string; mapsUrl?: string | null }) {
  return (
    <DetailCard title="Đánh giá trên Google Maps">
      <GoogleReviewsContent vendorId={vendorId} mapsUrl={mapsUrl} />
    </DetailCard>
  )
}

function GoogleReviewsContent({ vendorId, mapsUrl }: { vendorId: string; mapsUrl?: string | null }) {
  const { data, isPending, isError, error, refetch, isFetching } = useGoogleRating(vendorId, 'reviews')

  if (isPending) {
    return (
      <div aria-busy="true" aria-label="Đang tải đánh giá Google" className="space-y-4">
        <div className="h-12 w-48 animate-pulse rounded-md bg-muted" />
        {[0, 1, 2].map((i) => (
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

  if (isError) {
    const status = (error as { status?: number }).status
    const noPlace = status === 404
    // BE chưa có khóa Places API: mời xem thẳng trên Google Maps
    if (status === 503 && mapsUrl)
      return (
        <div className="rounded-xl border border-dashed border-line p-[26px] text-center">
          <p className="text-muted-foreground">Xem điểm và đánh giá của nhà cung cấp này trực tiếp trên Google Maps.</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              Mở Google Maps
              <ExternalLink aria-hidden />
            </a>
          </Button>
        </div>
      )
    return (
      <div className="rounded-xl border border-dashed border-line p-[26px] text-center">
        <p className="text-muted-foreground">
          {noPlace ? 'Nhà cung cấp này chưa liên kết địa điểm Google Maps nên chưa có điểm Google.' : 'Chưa tải được đánh giá từ Google Maps.'}
        </p>
        {!noPlace && (
          <Button variant="outline" size="sm" className="mt-3" disabled={isFetching} onClick={() => refetch()}>
            {isFetching ? 'Đang thử lại…' : 'Thử lại'}
          </Button>
        )}
      </div>
    )
  }

  const reviews = (data.reviews ?? []).filter((r) => r.text.trim())
  const allLink = (
    <a
      href={data.googleMapsUri}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-gold-700 underline underline-offset-[3px]"
    >
      Xem tất cả đánh giá trên Google Maps
      <ExternalLink className="size-3.5" aria-hidden />
      <span className="sr-only">(mở tab mới)</span>
    </a>
  )

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
        {data.rating !== null ? (
          <>
            <b className="font-serif text-[40px] leading-none font-semibold">{data.rating.toFixed(1)}</b>
            <div>
              <StarRating value={data.rating} size={16} />
              <div className="text-[13px] text-muted-foreground">{formatNumber(data.userRatingCount)} đánh giá trên Google Maps</div>
            </div>
          </>
        ) : (
          <span className="text-muted-foreground">Địa điểm này chưa có điểm trên Google Maps.</span>
        )}
        <GoogleAttribution className="ml-auto" />
      </div>

      {reviews.length ? (
        <ul className="mt-5 grid list-none gap-5 p-0">
          {reviews.map((r, i) => (
            <ReviewItem key={`${r.authorName}-${r.publishTime}-${i}`} review={r} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 rounded-xl border border-dashed border-line p-5 text-center text-muted-foreground">Chưa có đánh giá có nội dung trên Google Maps.</p>
      )}

      <p className="mt-5 text-[13px] text-muted-foreground">Sắp xếp theo mức liên quan. Đánh giá lấy từ Google Maps, không phải từ khách hàng WebPlan.</p>
      <div className="mt-2">{allLink}</div>
    </>
  )
}

function ReviewItem({ review }: { review: GoogleReview }) {
  const [expanded, setExpanded] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const textId = useId()
  const long = review.text.length > CLAMP
  const shown = long && !expanded ? `${review.text.slice(0, CLAMP).trimEnd()}…` : review.text
  const time = formatRelativeTime(review.publishTime) ?? review.relativeTime
  const initials = review.authorName
    .split(/\s+/)
    .slice(-2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <li className="flex gap-3">
      {review.authorPhotoUri && !photoFailed ? (
        <img src={review.authorPhotoUri} alt="" onError={() => setPhotoFailed(true)} className="size-10 shrink-0 rounded-full bg-line object-cover" referrerPolicy="no-referrer" />
      ) : (
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-semibold text-gold">
          {initials}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {review.authorUri ? (
            <a href={review.authorUri} target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline-offset-[3px] hover:underline">
              {review.authorName}
              <span className="sr-only"> (mở tab mới)</span>
            </a>
          ) : (
            <span className="font-semibold">{review.authorName}</span>
          )}
          {time && <span className="text-xs text-muted-foreground">{time}</span>}
        </div>
        <StarRating value={review.rating} size={13} className="mt-0.5" />
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
      </div>
    </li>
  )
}

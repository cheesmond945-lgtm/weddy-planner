import { Star } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import { useInView } from '@/lib/useInView'
import { cn } from '@/lib/utils'
import { useGoogleRating } from '../useGoogleRating'
import { GoogleAttribution } from './GoogleAttribution'

interface GoogleRatingBadgeProps {
  vendorId: string
  className?: string
}

/**
 * Điểm Google gọn cho thẻ dịch vụ: sao + điểm + số đánh giá + nhãn "Google".
 * Chỉ gọi API (mode summary) khi thẻ vào vùng nhìn thấy, tránh gọi hàng loạt.
 * Lỗi hoặc thiếu dữ liệu thì không hiện gì (địa chỉ bên cạnh đã là link Google Maps), không báo lỗi ra giao diện.
 */
export function GoogleRatingBadge({ vendorId, className }: GoogleRatingBadgeProps) {
  const { ref, inView } = useInView<HTMLSpanElement>()
  const { data, isPending, isError } = useGoogleRating(vendorId, 'summary', { enabled: inView })

  let content
  if (!inView || isPending) {
    content = <span aria-label="Đang tải điểm Google" className="inline-block h-3 w-28 animate-pulse rounded-sm bg-muted" />
  } else if (isError || !data || data.rating === null) {
    content = null
  } else {
    content = (
      <>
        <Star className="size-3.5 fill-gold text-gold" aria-hidden />
        <b className="font-semibold text-ink">{data.rating.toFixed(1)}</b>
        <span>{formatNumber(data.userRatingCount)} đánh giá</span>
        <GoogleAttribution compact className="rounded-sm border border-line px-1 leading-4" />
      </>
    )
  }

  return (
    <span ref={ref} className={cn('inline-flex items-center gap-[5px]', className)}>
      {content}
    </span>
  )
}

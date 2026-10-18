import { MapPin, Star } from 'lucide-react'
import { formatNumber } from '@/lib/format'

/** Dòng khu vực + điểm đánh giá (metaRow trong prototype). */
export function RatingMeta({ location, rating, reviewCount }: { location: string; rating: number; reviewCount: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-[5px]">
        <MapPin className="size-3.5" aria-hidden />
        {location}
      </span>
      <span className="inline-flex items-center gap-[5px]">
        <Star className="size-3.5 fill-gold text-gold" aria-hidden />
        <b className="font-semibold text-ink">{rating.toFixed(1)}</b>
        {formatNumber(reviewCount)} đánh giá
      </span>
    </div>
  )
}

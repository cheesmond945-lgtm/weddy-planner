import { MapPin } from 'lucide-react'
import { GoogleRatingBadge } from './GoogleRatingBadge'

/** Dòng khu vực + điểm Google (metaRow trong prototype). Điểm tải riêng khi thẻ vào vùng nhìn thấy. */
export function RatingMeta({ location, vendorId }: { location: string; vendorId: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
      <span className="inline-flex items-center gap-[5px]">
        <MapPin className="size-3.5" aria-hidden />
        {location}
      </span>
      <GoogleRatingBadge vendorId={vendorId} />
    </div>
  )
}

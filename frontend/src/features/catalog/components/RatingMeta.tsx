import { ExternalLink, MapPin } from 'lucide-react'
import type { ServiceSummary } from '@/types/catalog'
import { GoogleRatingBadge } from './GoogleRatingBadge'
import { mapsHref } from './GoogleMapsLink'

/**
 * Dòng địa chỉ + điểm Google (metaRow trong prototype). Địa chỉ là link mở Google Maps như trang chi tiết.
 * Điểm tải riêng khi thẻ vào vùng nhìn thấy; chưa có điểm thì không hiện gì.
 */
export function RatingMeta({ service }: { service: ServiceSummary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
      <a
        href={mapsHref(service)}
        target="_blank"
        rel="noopener noreferrer"
        title="Xem trên Google Maps"
        className="inline-flex items-start gap-[5px] font-medium text-primary underline underline-offset-[3px] hover:text-gold"
      >
        <MapPin className="size-3.5 shrink-0" aria-hidden />
        <span>
          {service.address || service.location}
          <ExternalLink className="ml-1 inline size-3 align-[-1px]" aria-hidden />
        </span>
        <span className="sr-only">(mở Google Maps trong tab mới)</span>
      </a>
      <GoogleRatingBadge vendorId={service.id} />
    </div>
  )
}

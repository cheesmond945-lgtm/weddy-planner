import { MapPin } from 'lucide-react'
import type { ServiceSummary } from '@/types/catalog'
import { GoogleRatingBadge } from './GoogleRatingBadge'
import { mapsHref } from './GoogleMapsLink'

/**
 * Dòng địa chỉ + điểm Google (metaRow trong prototype). Trên thẻ chỉ hiện 2 cấp cuối của địa chỉ (quận, tỉnh / thành),
 * địa chỉ đầy đủ xem ở trang chi tiết. Là link mở Google Maps, chỉ gạch chân khi rê chuột.
 * Điểm tải riêng khi thẻ vào vùng nhìn thấy; chưa có điểm thì không hiện gì.
 */
/** "131 Nguyễn Phong Sắc, Cầu Giấy, Hà Nội" -> "Cầu Giấy, Hà Nội" (2 phần sau dấu phẩy cuối cùng trở lên). */
export const shortAddress = (address: string) =>
  address
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(-2)
    .join(', ')

export function RatingMeta({ service }: { service: ServiceSummary }) {
  const address = shortAddress(service.address || service.location)
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-ink-2">
      <a
        href={mapsHref(service)}
        target="_blank"
        rel="noopener noreferrer"
        title="Xem trên Google Maps"
        className="inline-flex min-w-0 max-w-full items-center gap-1.5 hover:text-gold-700 hover:underline hover:underline-offset-[3px]"
      >
        <MapPin className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
        <span className="line-clamp-1">{address}</span>
        <span className="sr-only">(mở Google Maps trong tab mới)</span>
      </a>
      <GoogleRatingBadge vendorId={service.id} />
    </div>
  )
}

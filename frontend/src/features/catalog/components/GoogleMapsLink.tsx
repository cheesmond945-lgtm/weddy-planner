import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ServiceSummary } from '@/types/catalog'

/** Link mở NCC trên Google Maps: link NCC đã nhập, không có thì tự tạo link tìm kiếm (Maps URLs, không cần khóa API). */
export function mapsHref(service: Pick<ServiceSummary, 'name' | 'location' | 'address' | 'googleMapsUrl'>) {
  return service.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${service.name} ${service.address || service.location}`)}`
}

/**
 * Hiện thay điểm khi chưa lấy được điểm Google (BE chưa có khóa Places API, không thấy địa điểm, lỗi):
 * mở link Google Maps của NCC để người dùng tự xem điểm và đánh giá. Không có link thì báo chưa có điểm.
 */
export function GoogleMapsLink({ url, label = 'Xem đánh giá trên Google Maps', className }: { url?: string | null; label?: string; className?: string }) {
  if (!url) return <span className={className}>Chưa có điểm Google</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center gap-1 font-medium text-gold-700 underline-offset-[3px] hover:underline', className)}
    >
      {label}
      <ExternalLink className="size-[0.95em]" aria-hidden />
    </a>
  )
}

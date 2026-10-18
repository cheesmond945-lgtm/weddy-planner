import { Star } from 'lucide-react'
import { formatNumber } from '@/lib/format'
import type { ServiceDetail } from '@/types/catalog'
import { DetailCard } from './DetailCard'

/** Tab "Đánh giá và phản hồi": điểm Google Maps, chưa có phản hồi trên WebPlan (như prototype). */
export function ServiceReviewsPanel({ service }: { service: ServiceDetail }) {
  return (
    <DetailCard title="Đánh giá và phản hồi">
      <div className="mb-3 flex items-center gap-3.5">
        <b className="font-serif text-[40px] leading-none font-semibold">{service.rating.toFixed(1)}</b>
        <div>
          <Star className="size-4 fill-gold text-gold" aria-hidden />
          <div className="text-[13px] text-muted-foreground">{formatNumber(service.reviewCount)} đánh giá trên Google Maps</div>
        </div>
      </div>
      <p className="mt-1.5 text-[13px] text-muted-foreground">Điểm đánh giá lấy từ Google Maps, không phải đánh giá trên WebPlan.</p>
      <div className="mt-4 rounded-xl border border-dashed border-line p-[26px] text-center text-muted-foreground">
        Chưa có phản hồi nào từ khách hàng Weddy.
        <br />
        Sau khi hoàn thành dịch vụ, bạn sẽ được mời đánh giá.
      </div>
    </DetailCard>
  )
}

import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatPriceRange } from '@/lib/format'
import { useReveal } from '@/lib/useReveal'
import { paths } from '@/routes/paths'
import type { ServiceSummary } from '@/types/catalog'
import { RatingMeta } from './RatingMeta'

interface ServiceCardProps {
  service: ServiceSummary
  /** Vị trí trong lưới, để các thẻ cùng hàng hiện lệch nhau một chút */
  index?: number
  /** Nút nổi góc ảnh (yêu thích, module favorites) */
  imageAction?: ReactNode
  /** Nút cạnh "Xem chi tiết" (thêm vào kế hoạch, module plan) */
  extraActions?: ReactNode
  /** Nhãn phụ dưới tên danh mục (ví dụ "Gợi ý cho bạn") */
  badge?: ReactNode
}

/** Thẻ dịch vụ trong lưới (svcCard trong prototype). */
export function ServiceCard({ service, index = 0, imageAction, extraActions, badge }: ServiceCardProps) {
  const location = useLocation()
  const reveal = useReveal<HTMLElement>()
  const detail = { pathname: paths.serviceDetail(service.id) }
  const fromState = { from: location.pathname + location.search }

  return (
    <article
      ref={reveal.ref}
      style={{ transitionDelay: `${(index % 3) * 75}ms` }}
      className={`flex flex-col overflow-hidden rounded-[15px] border border-line-soft bg-surface shadow-card ${reveal.className}`}
    >
      <div className="relative h-[clamp(105px,13vw,155px)] overflow-hidden bg-line">
        <img src={service.coverImageUrl} alt={service.category.name} loading="lazy" className="block size-full object-cover" />
        {imageAction && <div className="absolute top-2.5 right-2.5">{imageAction}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-[7px] px-[15px] pt-[13px] pb-[15px]">
        <span className="text-[10px] font-medium text-gold">{service.category.name}</span>
        {badge}
        <h3 className="text-base leading-[1.3]">
          <Link to={detail} state={fromState} className="hover:text-gold">
            {service.name}
          </Link>
        </h3>
        <RatingMeta service={service} />
        <div className="text-[11px] text-muted-foreground">
          <b className="text-sm font-semibold text-ink">{formatPriceRange(service.priceFrom, service.priceTo)}</b>
        </div>
        <div className="mt-auto flex gap-[7px] pt-2">
          <Button asChild size="sm" className="min-h-[34px] flex-1 rounded-[9px] text-[10px]">
            <Link to={detail} state={fromState}>
              Xem chi tiết
            </Link>
          </Button>
          {extraActions}
        </div>
      </div>
    </article>
  )
}

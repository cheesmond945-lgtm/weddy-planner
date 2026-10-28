import { Heart } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { RatingMeta } from '@/features/catalog/components/RatingMeta'
import { isTablePriced } from '@/features/catalog/price'
import { ComparePill } from '@/features/compare/components/ComparePill'
import { AddToPlanButton } from '@/features/weddings/planActions'
import { formatPriceRange } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useCompareState } from '@/store/compare'
import type { ServiceSummary } from '@/types/catalog'

interface FavoriteCardProps {
  service: ServiceSummary
  onToggleCompare: (service: ServiceSummary) => void
  onRemove: (service: ServiceSummary) => void
}

/**
 * Thẻ trong trang Dịch vụ yêu thích (favCard trong prototype).
 * memo + trạng thái so sánh đọc riêng từng thẻ: chọn/bỏ chọn chỉ vẽ lại thẻ thay đổi, ảnh không nhấp nháy.
 */
export const FavoriteCard = memo(function FavoriteCard({ service, onToggleCompare, onRemove }: FavoriteCardProps) {
  const state = useCompareState(service.id, service.category.slug)

  return (
    <article
      className={cn(
        'flex flex-col overflow-hidden rounded-[15px] border bg-surface shadow-card transition-[opacity,box-shadow,border-color]',
        state === 'on' ? 'border-primary shadow-[0_0_0_2px_var(--accent),var(--shadow-card)]' : 'border-line-soft',
        state === 'off' && 'opacity-60',
      )}
    >
      <div className="relative h-[clamp(130px,15vw,170px)] overflow-hidden bg-line">
        <img src={service.coverImageUrl} alt={service.category.name} loading="lazy" className="block size-full object-cover" />
        <div className="absolute top-2.5 left-2.5">
          <ComparePill state={state} name={service.name} onToggle={() => onToggleCompare(service)} />
        </div>
        <button
          type="button"
          aria-label={`Bỏ ${service.name} khỏi yêu thích`}
          title="Bỏ khỏi yêu thích"
          onClick={() => onRemove(service)}
          className="absolute top-2.5 right-2.5 grid size-9 place-items-center rounded-full bg-surface text-heart shadow-fab transition-transform hover:scale-110"
        >
          <Heart className="size-[17px] fill-heart" aria-hidden />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-[7px] px-[15px] pt-[13px] pb-[15px]">
        <span className="text-[11px] font-medium text-gold">{service.category.name}</span>
        <h3 className="text-base leading-[1.3]">{service.name}</h3>
        <RatingMeta service={service} />
        <div className="text-xs text-muted-foreground">
          <b className="text-sm font-semibold text-ink">{formatPriceRange(service.priceFrom, service.priceTo)}</b>
          {isTablePriced(service) && '/mâm · đã gồm sảnh'}
        </div>
        <div className="mt-auto flex gap-[7px] pt-2">
          <Button asChild size="sm" className="min-h-9 min-w-0 flex-1 rounded-[9px] text-xs">
            <Link to={paths.serviceDetail(service.id)} state={{ from: paths.favorites }}>
              Xem chi tiết
            </Link>
          </Button>
          <AddToPlanButton service={service} variant="icon" className="size-9" />
        </div>
      </div>
    </article>
  )
})

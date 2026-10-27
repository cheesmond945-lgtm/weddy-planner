import { Heart } from 'lucide-react'
import { useRequireCouple } from '@/features/auth/useRequireCouple'
import { cn } from '@/lib/utils'
import type { ServiceSummary } from '@/types/catalog'
import { useFavorites, useToggleFavorite } from '../hooks'

interface FavoriteButtonProps {
  service: ServiceSummary
  /** float: nút tròn nhỏ trên ảnh thẻ; icon: nút tròn lớn cạnh tên ở trang chi tiết */
  variant?: 'float' | 'icon'
}

/** Nút trái tim thêm/bỏ yêu thích (3.1). Chưa đăng nhập thì mở modal, đăng nhập xong mới thêm. */
export function FavoriteButton({ service, variant = 'float' }: FavoriteButtonProps) {
  const { isFavorite } = useFavorites()
  const toggle = useToggleFavorite()
  const requireCouple = useRequireCouple()
  const on = isFavorite(service.id)

  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`${on ? 'Bỏ yêu thích' : 'Thêm vào yêu thích'} ${service.name}`}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        requireCouple(() => toggle.mutate({ service, favorite: !on }))
      }}
      className={cn(
        'grid place-items-center rounded-full transition-transform hover:scale-110',
        variant === 'float' ? 'size-10 bg-[rgb(255_253_248/0.92)] text-ink-2 shadow-sm' : 'size-11 border border-line bg-surface text-ink shadow-soft max-[700px]:size-10',
        on && 'text-heart',
      )}
    >
      <Heart className={cn('size-5', on && 'fill-heart')} strokeWidth={1.75} aria-hidden />
    </button>
  )
}

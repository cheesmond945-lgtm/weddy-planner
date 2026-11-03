import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Hàng 5 sao, trình đọc màn hình đọc "4 trên 5 sao". */
export function StarRating({ value, size = 14, className }: { value: number; size?: number; className?: string }) {
  const rounded = Math.round(value)
  const label = `${Number.isInteger(value) ? value : value.toFixed(1)} trên 5 sao`
  return (
    <span role="img" aria-label={label} className={cn('inline-flex items-center gap-0.5', className)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} aria-hidden style={{ width: size, height: size }} className={i <= rounded ? 'fill-gold text-gold' : 'text-line'} />
      ))}
    </span>
  )
}

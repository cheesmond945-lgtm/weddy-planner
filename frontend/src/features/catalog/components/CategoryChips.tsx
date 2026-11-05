import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/catalog'
import { CategoryIcon } from '../categoryIcons'

interface CategoryChipsProps {
  categories: Category[]
  value: string
  onChange: (slug: string) => void
}

/** Tên danh mục dài trong CSDL rút gọn cho chip */
const SHORT_NAMES: Record<string, string> = { 'nha-hang': 'Trung tâm tiệc cưới' }

/**
 * Chip lọc theo danh mục (13): một hàng, cuộn ngang (snap), ẩn thanh cuộn, mép phải mờ dần khi còn chip bị khuất.
 * Bấm chip lọc ngay. Chip đang chọn nền rêu chữ trắng. Không ghi số dịch vụ (số kết quả đã có ở thanh kết quả).
 */
export function CategoryChips({ categories, value, onChange }: CategoryChipsProps) {
  const railRef = useRef<HTMLDivElement>(null)
  const [moreRight, setMoreRight] = useState(false)
  const items = [{ slug: '', name: 'Tất cả' }, ...categories]

  // Còn chip bị cắt bên phải thì hiện lớp mờ ở mép phải
  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const update = () => setMoreRight(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 1)
    update()
    rail.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(rail)
    return () => {
      rail.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [items.length])

  return (
    <div className="relative">
      <div
        ref={railRef}
        role="group"
        aria-label="Danh mục"
        className="flex snap-x snap-proximity gap-2 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((c) => {
          const active = value === c.slug
          return (
            <button
              key={c.slug || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(c.slug)}
              className={cn(
                'inline-flex h-10 shrink-0 snap-start items-center gap-2 rounded-pill border px-4 text-[13px] font-medium whitespace-nowrap transition-colors',
                active ? 'border-moss-700 bg-moss-700 text-white' : 'border-line bg-surface text-ink-2 hover:border-gold-500 hover:text-ink',
              )}
            >
              {c.slug && <CategoryIcon slug={c.slug} />}
              {SHORT_NAMES[c.slug] ?? c.name}
            </button>
          )
        })}
      </div>
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-bg to-transparent transition-opacity',
          moreRight ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  )
}

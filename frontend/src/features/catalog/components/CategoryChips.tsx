import { cn } from '@/lib/utils'
import { useReveal } from '@/lib/useReveal'
import type { Category } from '@/types/catalog'
import { CategoryIcon } from '../categoryIcons'

interface CategoryChipsProps {
  categories: Category[]
  value: string
  onChange: (slug: string) => void
}

/** Chip lọc theo danh mục, kèm số dịch vụ (service-categories trong prototype). */
export function CategoryChips({ categories, value, onChange }: CategoryChipsProps) {
  const reveal = useReveal<HTMLDivElement>()
  const total = categories.reduce((sum, c) => sum + c.serviceCount, 0)
  const items = [{ slug: '', name: 'Tất cả', serviceCount: total }, ...categories]

  return (
    <div ref={reveal.ref} className={`mb-[26px] ${reveal.className}`}>
      <div
        role="group"
        aria-label="Danh mục"
        className="flex flex-wrap justify-center gap-[7px] max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:px-0 max-md:pt-[3px] max-md:pb-2"
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
                'inline-flex shrink-0 items-center gap-1 rounded-pill border px-3 py-[7px] text-[10px] font-medium whitespace-nowrap shadow-[0_3px_8px_rgb(var(--shadow-rgb)/0.08)] transition-colors',
                active ? 'border-ink bg-ink text-bg' : 'border-line-soft bg-surface text-nav hover:border-primary',
              )}
            >
              {c.slug && <CategoryIcon slug={c.slug} />}
              {c.name}
              <span
                className={cn(
                  'ml-[5px] inline-flex rounded-pill px-[5px] py-px text-[9px]',
                  active ? 'bg-bg/20 text-bg' : 'bg-accent-soft text-gold',
                )}
              >
                {c.serviceCount}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

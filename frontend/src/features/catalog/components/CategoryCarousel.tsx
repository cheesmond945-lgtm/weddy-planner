import { useRef } from 'react'
import type { Category } from '@/types/catalog'

interface CategoryCarouselProps {
  categories: Category[]
  onSelect: (slug: string) => void
}

/** Băng chuyền ảnh danh mục ở đầu trang (hero-carousel trong prototype). */
export function CategoryCarousel({ categories, onSelect }: CategoryCarouselProps) {
  const railRef = useRef<HTMLDivElement>(null)

  function slide(direction: -1 | 1) {
    const rail = railRef.current
    const card = rail?.firstElementChild as HTMLElement | null
    if (!rail || !card) return
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0
    rail.scrollBy({ left: direction * (card.getBoundingClientRect().width + gap), behavior: 'smooth' })
  }

  const arrow =
    'absolute top-1/2 z-[2] grid size-[38px] -translate-y-1/2 place-items-center rounded-full border border-line bg-surface text-[25px] leading-none text-gold shadow-soft transition-colors hover:border-primary hover:bg-primary hover:text-primary-foreground max-md:size-[30px] max-md:text-[21px]'

  return (
    <div className="relative mx-auto mb-8 px-11 max-md:px-[34px] max-[500px]:px-7">
      <button type="button" aria-label="Xem danh mục trước" onClick={() => slide(-1)} className={`${arrow} left-0`}>
        ‹
      </button>
      <div
        ref={railRef}
        aria-label="Danh mục dịch vụ nổi bật"
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth [scrollbar-width:none] max-md:gap-[9px] [&::-webkit-scrollbar]:hidden"
      >
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(c.slug)}
            className="group relative h-[clamp(130px,19vw,210px)] shrink-0 basis-[calc((100%-32px)/3)] snap-start overflow-hidden rounded-xl bg-line text-left shadow-card max-md:basis-[calc((100%-9px)/2)] max-[500px]:h-[150px] max-[500px]:basis-full"
          >
            <img src={c.imageUrl} alt={c.name} loading="lazy" className="block size-full object-cover transition-transform duration-[250ms] group-hover:scale-[1.035]" />
            <span className="pointer-events-none absolute inset-x-0 top-[35%] bottom-0 bg-linear-to-b from-transparent to-black/60" />
            <span className="absolute bottom-[15px] left-4 z-[1] font-serif text-[17px] font-semibold text-white [text-shadow:0_1px_4px_rgb(var(--shadow-rgb))] max-md:left-2.5 max-md:text-[13px]">
              {c.name}
            </span>
          </button>
        ))}
      </div>
      <button type="button" aria-label="Xem danh mục tiếp theo" onClick={() => slide(1)} className={`${arrow} right-0`}>
        ›
      </button>
    </div>
  )
}

import type { Category } from '@/types/catalog'
import { CategoryCarousel } from './CategoryCarousel'

/** Phần đầu trang Dịch vụ cưới (services-hero trong prototype). */
export function ServicesHero({ categories, onSelectCategory }: { categories: Category[]; onSelectCategory: (slug: string) => void }) {
  return (
    <section className="mx-auto mt-0.5 mb-7 max-w-[1120px] text-center">
      <span className="mb-5 inline-flex rounded-pill border border-line bg-surface px-[13px] py-1 text-[9px] leading-snug font-semibold tracking-[0.18em] text-gold">
        WEDDY PLANNER VIỆT NAM
      </span>
      <h1 className="mx-auto max-w-[700px] text-[clamp(34px,4.2vw,48px)] leading-[1.05] tracking-[-0.035em] max-md:text-[34px] max-[500px]:text-[32px]">
        Hiện thực hóa
        <br />
        <em className="text-gold">giấc mơ cưới</em> của bạn
      </h1>
      <p className="mx-auto mt-3 mb-6 max-w-[560px] text-xs leading-[1.75] text-muted-foreground">
        Kết nối với hàng ngàn nhà cung cấp dịch vụ cưới hàng đầu và lên kế hoạch cho ngày trọng đại một cách dễ dàng.
      </p>
      {categories.length > 0 && <CategoryCarousel categories={categories} onSelect={onSelectCategory} />}
    </section>
  )
}

import { useSearchParams } from 'react-router'
import { Badge } from '@/components/Badge'
import { CategoryChips } from '@/features/catalog/components/CategoryChips'
import { ServiceResults } from '@/features/catalog/components/ServiceResults'
import { ServiceResultsBar } from '@/features/catalog/components/ServiceResultsBar'
import { ServiceSearchBar } from '@/features/catalog/components/ServiceSearchBar'
import { ServicesHero } from '@/features/catalog/components/ServicesHero'
import { toServiceQuery, useServiceFilters } from '@/features/catalog/filters'
import { useCategories, useServices } from '@/features/catalog/hooks'
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton'
import { AiSuggestionStrip } from '@/features/weddings/components/AiSuggestionStrip'
import { useAiSuggestions } from '@/features/weddings/hooks'
import { AddToPlanButton } from '@/features/weddings/planActions'

/** Trang Dịch vụ cưới (2.1), kèm khung gợi ý AI khi mở từ timeline/kế hoạch (4.3). */
export default function ServicesPage() {
  const { filters, setFilters, clearFilters } = useServiceFilters()
  const [params, setParams] = useSearchParams()
  const categories = useCategories()
  const services = useServices(toServiceQuery(filters))

  const aiCategory = params.get('ai') && filters.category ? categories.data?.find((c) => c.slug === filters.category) : undefined
  const ai = useAiSuggestions(filters.category, !!aiCategory)
  const aiIds = new Set(aiCategory ? (ai.data?.suggestions.map((s) => s.service.id) ?? []) : [])

  const closeAi = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('ai')
        return next
      },
      { replace: true, preventScrollReset: true },
    )

  return (
    <>
      <ServicesHero
        search={<ServiceSearchBar q={filters.q} price={filters.price} onSearch={(q) => setFilters({ q })} onPrice={(price) => setFilters({ price })} />}
      />
      {aiCategory && <AiSuggestionStrip categorySlug={aiCategory.slug} categoryName={aiCategory.name} onClose={closeAi} />}
      {/* Giữ chỗ cao bằng hàng chip khi danh mục đang tải để trang không nhảy */}
      <div className="min-h-[44px]">
        {categories.data && <CategoryChips categories={categories.data} value={filters.category} onChange={(category) => setFilters({ category })} />}
      </div>
      <ServiceResultsBar filters={filters} total={services.data?.pages[0]?.meta.total} onRemove={setFilters} onClear={clearFilters} />
      <ServiceResults
        query={services}
        onClearFilters={clearFilters}
        renderCardProps={(s) => ({
          imageAction: <FavoriteButton service={s} />,
          extraActions: <AddToPlanButton service={s} variant="icon" />,
          badge: aiIds.has(s.id) ? <Badge tone="talk" className="self-start">Gợi ý cho bạn</Badge> : undefined,
          // Đang lọc đúng một danh mục thì nhãn danh mục trên ảnh là thừa
          showCategory: !filters.category,
        })}
      />
    </>
  )
}

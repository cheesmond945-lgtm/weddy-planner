import { useCallback, useMemo, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { CategoryIcon, categoryColor } from '@/features/catalog/categoryIcons'
import { useCategories } from '@/features/catalog/hooks'
import { compareUrl } from '@/features/compare/components/CompareTray'
import { paths } from '@/routes/paths'
import { compareStore, MAX_COMPARE, useCompare, type CompareItem } from '@/store/compare'
import type { ServiceSummary } from '@/types/catalog'
import { useFavorites, useToggleFavorite } from '../hooks'
import { FavoriteCard } from './FavoriteCard'

const toCompareItem = (s: ServiceSummary): CompareItem => ({
  id: s.id,
  name: s.name,
  imageUrl: s.coverImageUrl,
  categorySlug: s.category.slug,
  categoryName: s.category.name,
})

/** Danh sách yêu thích nhóm theo hạng mục (renderFavorites trong prototype, 3.2). */
export function FavoriteGroups() {
  const { favorites, isPending } = useFavorites()
  const { data: categories = [] } = useCategories()
  const hasSelection = useCompare().length > 0
  const toggleFavorite = useToggleFavorite()
  const navigate = useNavigate()

  // Thứ tự nhóm theo thứ tự danh mục; tính lại chỉ khi danh sách yêu thích đổi
  const groups = useMemo(() => {
    const order = categories.map((c) => c.slug)
    const map = new Map<string, ServiceSummary[]>()
    for (const s of favorites) map.set(s.category.slug, [...(map.get(s.category.slug) ?? []), s])
    return [...map.entries()].sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
  }, [favorites, categories])

  // Callback ổn định để thẻ (memo) không vẽ lại khi chọn so sánh
  const onToggleCompare = useCallback((s: ServiceSummary) => {
    const result = compareStore.toggle(toCompareItem(s))
    if (result.kind === 'switched') toast(`Chuyển sang so sánh hạng mục ${result.categoryName.toLowerCase()}`)
    if (result.kind === 'full') toast(`Chỉ so sánh tối đa ${MAX_COMPARE} dịch vụ`)
  }, [])
  const { mutate: removeFavorite } = toggleFavorite
  const onRemove = useCallback((s: ServiceSummary) => removeFavorite({ service: s, favorite: false }), [removeFavorite])

  if (isPending) {
    return <div className="h-[280px] animate-pulse rounded-[15px] bg-muted" aria-busy="true" aria-label="Đang tải" />
  }

  if (!favorites.length) {
    return (
      <EmptyState
        title="Chưa có dịch vụ yêu thích"
        description="Bấm biểu tượng trái tim trên thẻ dịch vụ để lưu lại và so sánh sau."
        action={
          <Button asChild>
            <Link to={paths.services}>Khám phá dịch vụ</Link>
          </Button>
        }
      />
    )
  }

  return (
    <>
      {groups.map(([slug, items]) => (
        <section key={slug} className="mb-[30px]" style={{ '--cc': categoryColor(slug) } as CSSProperties} aria-labelledby={`fav-group-${slug}`}>
          <h2 id={`fav-group-${slug}`} className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-2 text-xl">
            <span className="text-(--cc)">
              <CategoryIcon slug={slug} size={22} />
            </span>
            {items[0].category.name}
            <span className="font-sans text-[13px] font-normal text-muted-foreground">{items.length} dịch vụ</span>
            {items.length >= 2 && items.length <= MAX_COMPARE && (
              <Button
                variant="outline"
                size="sm"
                className="ml-auto rounded-pill border-primary font-sans text-[13px] font-semibold text-gold"
                onClick={() => {
                  compareStore.replace(items.map(toCompareItem))
                  navigate(compareUrl(items.map((s) => s.id)))
                }}
              >
                So sánh cả nhóm
              </Button>
            )}
          </h2>
          <div className="grid grid-cols-1 gap-4 min-[501px]:grid-cols-2 md:grid-cols-3">
            {items.map((s) => (
              <FavoriteCard key={s.id} service={s} onToggleCompare={onToggleCompare} onRemove={onRemove} />
            ))}
          </div>
        </section>
      ))}
      {/* Chừa chỗ cuối trang để thanh so sánh không che hàng thẻ cuối */}
      {hasSelection && <div aria-hidden className="h-24 max-sm:h-40" />}
    </>
  )
}

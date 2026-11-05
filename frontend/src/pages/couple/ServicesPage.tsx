import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { CategoryChips } from '@/features/catalog/components/CategoryChips'
import { AiWaiting, GuidePanel, NlChips, SearchEmpty, TabHint, type NlChipKey } from '@/features/catalog/components/SearchFeedback'
import { ServiceResults } from '@/features/catalog/components/ServiceResults'
import { ServiceResultsBar } from '@/features/catalog/components/ServiceResultsBar'
import { ServiceSearchBar } from '@/features/catalog/components/ServiceSearchBar'
import { ServicesHero } from '@/features/catalog/components/ServicesHero'
import { dropdownArea, hasPrice, toServiceQuery, useServiceFilters } from '@/features/catalog/filters'
import { useAreas, useCategories, useServices, useServiceSearch } from '@/features/catalog/hooks'
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton'
import { HallsFreeBadge } from '@/features/halls/components/HallCalendar'
import { useHallsFree } from '@/features/halls/hooks'
import { RESTAURANT_SLUG } from '@/features/vendors/constants'
import { SuggestionsPanel, suggestionCardProps } from '@/features/weddings/components/SuggestionsPanel'
import { useAiSuggestions, usePlan, useWedding } from '@/features/weddings/hooks'
import { AddToPlanButton } from '@/features/weddings/planActions'
import { toISODate, today } from '@/lib/date'
import type { NlFilters, ServiceSummary } from '@/types/catalog'

const inPlanBadge = <span className="rounded-pill bg-moss-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">Trong kế hoạch</span>

/**
 * Trang Dịch vụ cưới (2.1), kèm "Gợi ý cho bạn" (4.3) khi mở từ nút gợi ý ở Kế hoạch / Timeline (?category=…&ai=1):
 * - ai=1 (thu gọn): chỉ khung gợi ý, ẩn thanh hạng mục và bộ lọc;
 * - ai=all (mở rộng): danh sách đầy đủ, 3 dịch vụ gợi ý ghim đầu danh sách kèm nhãn "Gợi ý cho bạn" trên thẻ.
 * Đổi bộ lọc hoặc tìm kiếm thì bỏ gợi ý (filters.ts xóa tham số ai), danh sách xếp theo kết quả lọc.
 *
 * Tìm theo câu gõ (?q=, docs/api/catalog.md GET /services/search): tầng 1 khớp chữ; không có kết quả thì backend trả NEEDS_AI,
 * trang hiện "Đang hiểu yêu cầu của bạn…" rồi gọi lại kèm ai=1. Bộ lọc AI hiểu được hiện thành chip; bỏ chip thì ghi phần còn lại
 * lên URL (nl*) và lọc bằng GET /services, không gọi AI nữa.
 */
export default function ServicesPage() {
  const { filters, setFilters, clearFilters, applyNl, removeNl } = useServiceFilters()
  const [params, setParams] = useSearchParams()
  const categories = useCategories()
  const areas = useAreas()
  const { data: wedding } = useWedding()
  const planIds = new Set(usePlan().data?.items.map((i) => i.service.id) ?? [])

  const aiMode = filters.category ? params.get('ai') : null
  // B1: người dùng chưa tự chọn khu vực thì chọn sẵn khu vực đám cưới (đổi được; "Tất cả khu vực" là ALL_AREAS)
  const weddingArea = !aiMode && wedding?.ward && areas.data?.includes(wedding.ward) ? wedding.ward : ''
  const view = { ...filters, area: filters.area || weddingArea }

  // Tìm theo câu gõ: lần 1 không cho AI; nhận NEEDS_AI thì lần 2 kèm ai=1. Câu mới thì yêu cầu cũ bị hủy, chỉ dùng kết quả cuối.
  const q = filters.q.trim()
  const searchQuery = { q, category: view.category || undefined, area: dropdownArea(view), priceMin: view.price.min, priceMax: view.price.max }
  const first = useServiceSearch(searchQuery, false, !!q)
  const needsAi = first.data?.pages[0]?.mode === 'NEEDS_AI'
  const second = useServiceSearch(searchQuery, true, !!q && needsAi)
  const search = needsAi ? second : first
  const result = search.data?.pages[0]
  // Câu rỗng sau chuẩn hóa (chỉ emoji, ký tự đặc biệt): giữ danh sách hiện tại
  const textMode = !!q && result?.mode !== 'EMPTY'
  const services = useServices(toServiceQuery(view), !textMode)
  const active = textMode ? search : services

  // Bộ lọc AI đang áp dụng: từ URL (nl*) hoặc từ kết quả tầng 2 vừa nhận. Phần trùng hạng mục / dropdown thì không hiện chip.
  const understood: NlFilters | null = filters.nl
    ? { category: filters.nl.category || null, area: filters.nl.area || null, styles: filters.nl.styles, priceMin: filters.nl.price.min ?? null, priceMax: filters.nl.price.max ?? null }
    : textMode && result?.mode === 'AI'
      ? (result.ai?.filters ?? null)
      : null
  const samePrice = understood && (understood.priceMin ?? undefined) === view.price.min && (understood.priceMax ?? undefined) === view.price.max
  const shown: NlFilters | null = understood && {
    category: understood.category === view.category ? null : understood.category,
    area: understood.area === dropdownArea(view) ? null : understood.area,
    styles: understood.styles,
    priceMin: samePrice ? null : understood.priceMin,
    priceMax: samePrice ? null : understood.priceMax,
  }
  const hasChips = !!shown && (!!shown.category || !!shown.area || shown.styles.length > 0 || shown.priceMin != null || shown.priceMax != null)
  const activeCategory = shown?.category || view.category
  const categoryName = (slug: string) => categories.data?.find((c) => c.slug === slug)?.name ?? ''

  // B9: bỏ chip → phần còn lại thành bộ lọc trên URL, backend lọc lại ngay, không gọi AI
  const removeChip = (key: NlChipKey, style?: string) => {
    if (filters.nl) return removeNl(key, style)
    if (!shown || !result) return
    applyNl(result.query, {
      ...shown,
      category: key === 'category' ? null : shown.category,
      area: key === 'area' ? null : shown.area,
      styles: key === 'styles' ? shown.styles.filter((s) => s !== style) : shown.styles,
      priceMin: key === 'price' ? null : shown.priceMin,
      priceMax: key === 'price' ? null : shown.priceMax,
    })
  }

  const pinning = aiMode === 'all' && !filters.q && !filters.nl && !filters.area && !hasPrice(filters.price)
  const ai = useAiSuggestions(filters.category, pinning)
  const suggestionOf = new Map(pinning ? (ai.data?.suggestions.map((s) => [s.service.id, s] as const) ?? []) : [])

  // Khách có ngày cưới sắp tới: thẻ trung tâm sự kiện báo còn bao nhiêu sảnh trống ngày đó (docs/LICH_BAN_SANH.md)
  const weddingDate = wedding?.date && wedding.date >= toISODate(today()) ? wedding.date : null
  const hallIds = useMemo(() => active.data?.pages.flatMap((p) => p.data.filter((s) => s.category.slug === RESTAURANT_SLUG).map((s) => s.id)) ?? [], [active.data])
  const hallsFree = useHallsFree(weddingDate, hallIds).data

  const setAiMode = (mode: '1' | 'all') => {
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.set('ai', mode)
      return next
    })
    window.scrollTo(0, 0)
  }

  // Nút trên thẻ: yêu thích (góc ảnh) và dấu cộng thêm vào kế hoạch
  const cardActions = (s: ServiceSummary) => ({ imageAction: <FavoriteButton service={s} />, extraActions: <AddToPlanButton service={s} variant="icon" /> })

  if (aiMode && aiMode !== 'all') {
    return <SuggestionsPanel categorySlug={filters.category} categoryName={categoryName(filters.category)} onExpand={() => setAiMode('all')} cardActions={cardActions} />
  }

  const waitingAi = textMode && needsAi && second.isPending

  let body
  if (textMode && result?.mode === 'GUIDE' && result.guide) {
    body = (
      <GuidePanel
        guide={result.guide}
        onCategory={(category) => setFilters({ q: '', category })}
        onStyle={(style) => applyNl(style, { category: null, area: null, styles: [style], priceMin: null, priceMax: null })}
      />
    )
  } else if (textMode && result?.hint) {
    const { categorySlug } = result.hint
    body = <TabHint hint={result.hint} onGo={() => setFilters({ category: categorySlug })} />
  } else {
    body = (
      <ServiceResults
        query={active}
        onClearFilters={clearFilters}
        empty={textMode || filters.nl ? <SearchEmpty result={textMode ? result : undefined} hasNlChips={hasChips} onClear={clearFilters} /> : undefined}
        pinned={pinning ? (ai.data?.suggestions.map((s) => s.service) ?? []) : []}
        renderCardProps={(s) => {
          const free = weddingDate ? hallsFree?.[s.id] : undefined
          return {
            ...cardActions(s),
            // B5: dịch vụ đã trong kế hoạch vẫn hiện, kèm nhãn
            ...(planIds.has(s.id) && { imageBadge: inPlanBadge }),
            ...suggestionCardProps(suggestionOf.get(s.id)),
            badge: free ? <HallsFreeBadge free={free} /> : undefined,
            // Đang lọc đúng một danh mục thì nhãn danh mục trên ảnh là thừa
            showCategory: !activeCategory,
          }
        }}
      />
    )
  }

  return (
    <>
      <ServicesHero
        search={
          <ServiceSearchBar
            q={filters.q || filters.nl?.text || ''}
            area={view.area}
            areaCustom={!!shown?.area}
            priceCustom={!!shown && (shown.priceMin != null || shown.priceMax != null)}
            areas={areas.data ?? []}
            onArea={(area) => setFilters({ area })}
            price={view.price}
            onSearch={(text) => setFilters({ q: text })}
            onPrice={(price) => setFilters({ price })}
          />
        }
      />
      {/* Giữ chỗ cao bằng hàng chip khi danh mục đang tải để trang không nhảy */}
      <div className="min-h-[44px]">
        {categories.data && <CategoryChips categories={categories.data} value={activeCategory} onChange={(category) => setFilters({ category })} />}
      </div>
      <ServiceResultsBar filters={view} onRemove={setFilters} onClear={clearFilters} />
      {waitingAi && <AiWaiting />}
      {shown && (hasChips || (textMode && result?.ai?.priceRejected)) && (
        <NlChips filters={shown} categoryName={shown.category ? categoryName(shown.category) : undefined} priceRejected={textMode && result?.ai?.priceRejected} onRemove={removeChip} />
      )}
      {body}
    </>
  )
}

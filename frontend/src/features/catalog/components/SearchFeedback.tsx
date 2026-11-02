import { Loader2, Sparkles, X } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import type { NlFilters, ServiceSearchResult } from '@/types/catalog'

/** Chip trong hàng "Hiểu theo ngôn ngữ tự nhiên"; key dùng để bỏ đúng phần đó */
export type NlChipKey = 'category' | 'area' | 'styles' | 'price'

/** "Dưới 20.000.000đ", "Từ 8.000.000đ đến 12.000.000đ", "Từ 30.000.000đ" */
export function nlPriceLabel(min: number | null | undefined, max: number | null | undefined) {
  if (min != null && max != null) return `Từ ${formatMoney(min)} đến ${formatMoney(max)}`
  if (max != null) return `Dưới ${formatMoney(max)}`
  if (min != null) return `Từ ${formatMoney(min)}`
  return ''
}

/** B4: câu chỉ có từ chung chung ("đẹp") → không tìm, không gọi AI; hiện hướng dẫn và chip bấm nhanh */
export function GuidePanel({
  guide,
  onCategory,
  onStyle,
}: {
  guide: NonNullable<ServiceSearchResult['guide']>
  onCategory: (slug: string) => void
  onStyle: (style: string) => void
}) {
  const chip = 'h-9 rounded-pill border border-line bg-surface px-3.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-gold-500 hover:text-ink'
  return (
    <div className="rounded-lg border border-line bg-surface px-6 py-8 text-center">
      <p className="mx-auto mb-5 max-w-[520px] text-[15px] text-ink-2">{guide.message}</p>
      <div className="flex flex-wrap justify-center gap-2">
        {guide.categories.map((c) => (
          <button key={c.slug} type="button" className={chip} onClick={() => onCategory(c.slug)}>
            {c.name}
          </button>
        ))}
      </div>
      {guide.styles.length > 0 && (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {guide.styles.map((s) => (
            <button key={s} type="button" className={chip} onClick={() => onStyle(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** B5: tab đang chọn không có kết quả nhưng hạng mục khác có */
export function TabHint({ hint, onGo }: { hint: NonNullable<ServiceSearchResult['hint']>; onGo: () => void }) {
  return (
    <EmptyState
      title={`Không có trong ${hint.tab}`}
      description={`Có ${hint.count} kết quả ở ${hint.categoryName}.`}
      action={<Button onClick={onGo}>Xem ở {hint.categoryName}</Button>}
    />
  )
}

/** B9: trong lúc chờ AI */
export function AiWaiting() {
  return (
    <p className="mb-4 flex items-center gap-2 text-sm text-ink-2" aria-live="polite">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Đang hiểu yêu cầu của bạn…
    </p>
  )
}

/** B9: hàng chip bộ lọc AI đã hiểu + nhãn nhỏ; bỏ chip thì lọc lại bằng backend, không gọi AI */
export function NlChips({
  filters,
  categoryName,
  priceRejected,
  onRemove,
}: {
  filters: NlFilters
  categoryName?: string
  priceRejected?: boolean
  onRemove: (key: NlChipKey, style?: string) => void
}) {
  type Chip = { id: string; key: NlChipKey; label: string; style?: string }
  const chips = ([
    filters.category && { id: 'category', key: 'category' as const, label: categoryName || filters.category },
    filters.area && { id: 'area', key: 'area' as const, label: filters.area.replace(/^(Phường|Xã) /, '') },
    ...filters.styles.map((s) => ({ id: `style-${s}`, key: 'styles' as const, label: s, style: s })),
    (filters.priceMin != null || filters.priceMax != null) && { id: 'price', key: 'price' as const, label: nlPriceLabel(filters.priceMin, filters.priceMax) },
  ] as (Chip | null | false | '')[]).filter((c): c is Chip => !!c)

  if (!chips.length && !priceRejected) return null
  return (
    <div className="mb-5 flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-xs text-ink-3">
        <Sparkles className="size-3.5" aria-hidden />
        Hiểu theo ngôn ngữ tự nhiên
      </span>
      {chips.map((c) => (
        <span key={c.id} className="inline-flex h-8 items-center gap-1 rounded-pill border border-gold-500 bg-gold-100 pr-1 pl-3 text-[13px] text-ink">
          {c.label}
          <button
            type="button"
            onClick={() => onRemove(c.key, c.style)}
            aria-label={`Bỏ ${c.label}`}
            className="grid size-6 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {priceRejected && <span className="text-xs text-ink-3">Mức giá bạn gõ không hợp lệ nên đã bỏ qua.</span>}
    </div>
  )
}

const AI_ERROR: Record<string, string> = {
  LIMIT: 'Bạn đã tìm bằng câu tự nhiên nhiều lần, vui lòng thử lại sau hoặc dùng bộ lọc.',
  TIMEOUT: 'Chưa hiểu kịp yêu cầu của bạn. Thử gõ ngắn hơn hoặc dùng bộ lọc.',
  FAILED: 'Chưa hiểu được yêu cầu lúc này. Thử gõ ngắn hơn hoặc dùng bộ lọc.',
  UNAVAILABLE: 'Chưa hiểu được yêu cầu lúc này. Thử gõ ngắn hơn hoặc dùng bộ lọc.',
}

/** B10: không có kết quả / AI lỗi / quá giới hạn → khung trống bình thường kèm gợi ý; không bao giờ treo */
export function SearchEmpty({ result, hasNlChips, onClear }: { result?: ServiceSearchResult; hasNlChips: boolean; onClear: () => void }) {
  const lines = [
    result?.ai?.error && AI_ERROR[result.ai.error],
    result?.empty?.noServicesInArea && `Chưa có dịch vụ tại ${result.empty.noServicesInArea}.`,
    result?.empty?.cheapestFrom != null && `Dịch vụ rẻ nhất hiện có từ ${formatMoney(result.empty.cheapestFrom)}.`,
    hasNlChips && 'Thử bỏ chip mức giá hoặc phong cách ở trên.',
  ].filter(Boolean) as string[]
  return (
    <EmptyState
      title="Không tìm thấy dịch vụ phù hợp"
      description={lines.length ? lines.map((l) => <span key={l} className="block">{l}</span>) : 'Thử bỏ bớt bộ lọc.'}
      action={
        <Button variant="outline" onClick={onClear}>
          Xóa bộ lọc
        </Button>
      }
    />
  )
}

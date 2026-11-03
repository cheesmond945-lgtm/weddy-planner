import { X } from 'lucide-react'
import { hasPrice, priceLabel, type ServiceFilters } from '../filters'

interface ServiceResultsBarProps {
  filters: ServiceFilters
  /** Tổng số dịch vụ khớp bộ lọc; chưa tải xong thì giữ chỗ */
  total?: number
  onRemove: (patch: Partial<ServiceFilters>) => void
  onClear: () => void
}

/**
 * Hàng kết quả cố định dưới chip danh mục, luôn hiện: "N dịch vụ", các bộ lọc đang bật (từ khóa, mức giá) dạng tag có nút x,
 * và "Xóa bộ lọc" khi có bộ lọc. Chiều cao cố định để trang không nhảy khi bật / tắt lọc.
 */
export function ServiceResultsBar({ filters, total, onRemove, onClear }: ServiceResultsBarProps) {
  const tags = [
    filters.q && { key: 'q', label: `"${filters.q}"`, remove: () => onRemove({ q: '' }) },
    hasPrice(filters.price) && { key: 'price', label: priceLabel(filters.price), remove: () => onRemove({ price: {} }) },
  ].filter((t): t is { key: string; label: string; remove: () => void } => !!t)
  const anyFilter = tags.length > 0 || !!filters.category

  return (
    <div className="mt-4 mb-6 flex min-h-10 flex-wrap items-center gap-x-3 gap-y-2">
      <p className="text-sm font-medium text-ink-2" aria-live="polite">
        {total === undefined ? <span className="inline-block h-4 w-20 animate-pulse rounded-sm bg-muted align-middle" /> : `${total} dịch vụ`}
      </p>
      {tags.map((t) => (
        <span key={t.key} className="inline-flex h-8 items-center gap-1 rounded-pill border border-line bg-surface pr-1 pl-3 text-[13px] text-ink">
          {t.label}
          <button
            type="button"
            onClick={t.remove}
            aria-label={`Bỏ lọc ${t.label}`}
            className="grid size-6 place-items-center rounded-full text-ink-2 transition-colors hover:bg-gold-100 hover:text-ink"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
      {anyFilter && (
        <button type="button" onClick={onClear} className="ml-auto h-8 px-1 text-sm font-medium text-gold-700 hover:underline">
          Xóa bộ lọc
        </button>
      )}
    </div>
  )
}

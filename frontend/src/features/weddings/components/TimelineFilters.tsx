import { Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { controlClass } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import { hasFilters, type MonthOption, type OwnerFilter, type TimelineFilters as Filters } from '../timelineFilter'

interface TimelineFiltersProps {
  filters: Filters
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
  /** Lựa chọn tháng (đã kèm số việc); không truyền thì ẩn ô chọn tháng (cách xem Lịch có thanh chuyển tháng riêng) */
  months?: readonly MonthOption[]
  /** Hạng mục (dịch vụ) có trong timeline */
  categories: readonly { slug: string; label: string }[]
  category: string
  onCategory: (slug: string) => void
  /** Số việc đang hiện sau khi lọc */
  shown: number
}

const OWNERS: { value: OwnerFilter; label: string }[] = [
  { value: 'all', label: 'Mọi việc' },
  { value: 'mine', label: 'Việc của tôi' },
  { value: 'vendor', label: 'Việc do NCC làm' },
]

/**
 * Tìm kiếm và lọc việc của timeline: từ khóa (tên việc, dịch vụ, tên NCC, mã đơn, ngày hạn "12/11", "tháng 12"; không cần gõ dấu),
 * tháng, dịch vụ, và ai làm. Lọc ngay trên máy, không gọi API. Từ khóa được áp sau 250 ms để gõ mượt.
 */
export function TimelineFilters({ filters, onChange, onReset, months, categories, category, onCategory, shown }: TimelineFiltersProps) {
  const [text, setText] = useState(filters.q)
  const latest = useRef(onChange)
  latest.current = onChange

  useEffect(() => {
    if (text === filters.q) return
    const t = setTimeout(() => latest.current({ q: text }), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  // Đổi từ ngoài (nút "Xóa bộ lọc"): đồng bộ ô tìm
  useEffect(() => setText(filters.q), [filters.q])

  const active = hasFilters(filters) || !!category
  const select = cn(controlClass, 'sm:w-auto sm:min-w-[150px]')

  return (
    <div className="mt-4" role="search" aria-label="Tìm và lọc việc">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tìm việc, dịch vụ, nhà cung cấp, mã đơn, ngày…"
            aria-label="Tìm việc theo tên, dịch vụ, nhà cung cấp, mã đơn, ngày hoặc tháng"
            className="w-full rounded-pill border border-line bg-surface py-2.5 pr-9 pl-9 text-sm text-ink outline-none focus:border-gold [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button type="button" aria-label="Xóa từ khóa" onClick={() => setText('')} className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-bg">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {months && (
          <select aria-label="Lọc theo tháng" value={filters.month} onChange={(e) => onChange({ month: e.target.value })} className={select}>
            <option value="">Mọi tháng</option>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label} ({m.count})
              </option>
            ))}
          </select>
        )}
        <select aria-label="Lọc theo dịch vụ" value={category} onChange={(e) => onCategory(e.target.value)} className={select}>
          <option value="">Mọi dịch vụ</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.label}
            </option>
          ))}
        </select>
        <select aria-label="Lọc theo người thực hiện" value={filters.owner} onChange={(e) => onChange({ owner: e.target.value as OwnerFilter })} className={select}>
          {OWNERS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {active && (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground" role="status">
          <span>
            <b className="font-semibold text-ink">{shown}</b> việc phù hợp
          </span>
          <button type="button" onClick={onReset} className="font-semibold text-ink underline underline-offset-2 hover:text-gold">
            Xóa bộ lọc
          </button>
        </p>
      )}
    </div>
  )
}

import { CalendarDays, ListFilter, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { controlClass } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import type { ViewMode } from '../timelineGroups'
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
  /** Đang xem danh sách hay lịch; nút lịch cạnh "Bộ lọc" chuyển qua lại */
  view: ViewMode
  onToggleView: () => void
}

/** Giá trị tháng "YYYY-MM" (còn lại là lọc theo hạn: overdue / soon) */
const MONTH_RE = /^\d{4}-\d{2}$/

const OWNERS: { value: OwnerFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả việc' },
  { value: 'mine', label: 'Việc của tôi' },
  { value: 'vendor', label: 'Việc do NCC làm' },
]

/**
 * Tìm kiếm và lọc việc của timeline: ô từ khóa hiện sẵn (tên việc, dịch vụ, tên NCC, ngày hạn "12/11", "tháng 12"; không cần gõ dấu);
 * tháng, dịch vụ và ai làm gom vào nút "Bộ lọc" (hiện số bộ lọc đang bật). Lọc ngay trên máy, không gọi API. Từ khóa được áp sau 250 ms để gõ mượt.
 */
export function TimelineFilters({ filters, onChange, onReset, months, categories, category, onCategory, shown, view, onToggleView }: TimelineFiltersProps) {
  const [text, setText] = useState(filters.q)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
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

  // Đóng bảng bộ lọc khi bấm ra ngoài hoặc nhấn Esc
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !panelRef.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const active = hasFilters(filters) || !!category
  // Số bộ lọc đang bật trong nút "Bộ lọc" (không tính từ khóa vì ô tìm kiếm hiện sẵn)
  const count = (months && filters.month ? 1 : 0) + (category ? 1 : 0) + (filters.owner !== 'all' ? 1 : 0)
  const select = controlClass

  return (
    <div className="mt-4" role="search" aria-label="Tìm và lọc việc">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Tìm việc, dịch vụ, nhà cung cấp, ngày…"
            aria-label="Tìm việc theo tên, dịch vụ, nhà cung cấp, ngày hoặc tháng"
            className="w-full rounded-pill border border-line bg-surface py-2.5 pr-9 pl-9 text-sm text-ink outline-none focus:border-gold [&::-webkit-search-cancel-button]:hidden"
          />
          {text && (
            <button type="button" aria-label="Xóa từ khóa" onClick={() => setText('')} className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-bg">
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <div ref={panelRef} className="relative shrink-0">
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            onClick={() => setOpen((o) => !o)}
            className={cn(
              'inline-flex h-[42px] items-center gap-2 rounded-pill border border-line bg-surface px-4 text-[13.5px] text-muted-foreground hover:border-line-strong hover:text-ink',
              count > 0 && 'border-gold/45 bg-gold-soft text-gold-ink',
            )}
          >
            <ListFilter className="size-[17px]" />
            Bộ lọc
            {count > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-pill bg-(image:--gold-grad) px-[5px] text-[11px] font-semibold text-gold-on tabular-nums">{count}</span>}
          </button>
          {open && (
            <div role="dialog" aria-label="Bộ lọc việc" className="absolute top-[calc(100%+6px)] right-0 z-20 grid w-[280px] gap-3 rounded-lg border border-line bg-surface p-4 shadow-portal-lift max-sm:right-auto max-sm:left-0">
              {months && (
                <label className="grid gap-1 text-[13px] font-medium">
                  Thời gian
                  {/* Tách "theo hạn" (Quá hạn, Sắp đến hạn) khỏi "theo tháng" để không lẫn hai cách lọc trong một danh sách */}
                  <select aria-label="Lọc theo thời gian" value={filters.month} onChange={(e) => onChange({ month: e.target.value })} className={select}>
                    <option value="">Tất cả thời gian</option>
                    {months.some((m) => !MONTH_RE.test(m.value)) && (
                      <optgroup label="Theo hạn">
                        {months
                          .filter((m) => !MONTH_RE.test(m.value))
                          .map((m) => (
                            <option key={m.value} value={m.value}>
                              {m.label} ({m.count} việc)
                            </option>
                          ))}
                      </optgroup>
                    )}
                    <optgroup label="Theo tháng">
                      {months
                        .filter((m) => MONTH_RE.test(m.value))
                        .map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label} ({m.count} việc)
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </label>
              )}
              <label className="grid gap-1 text-[13px] font-medium">
                Dịch vụ
                <select aria-label="Lọc theo dịch vụ" value={category} onChange={(e) => onCategory(e.target.value)} className={select}>
                  <option value="">Tất cả dịch vụ</option>
                  {categories.map((c) => (
                    <option key={c.slug} value={c.slug}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-[13px] font-medium">
                Người thực hiện
                <select aria-label="Lọc theo người thực hiện" value={filters.owner} onChange={(e) => onChange({ owner: e.target.value as OwnerFilter })} className={select}>
                  {OWNERS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label={view === 'calendar' ? 'Xem danh sách' : 'Xem lịch'}
          title={view === 'calendar' ? 'Xem danh sách' : 'Xem lịch'}
          onClick={onToggleView}
          className={cn(
            'grid size-[42px] shrink-0 place-items-center rounded-pill border border-line bg-surface text-muted-foreground hover:border-line-strong hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
            view === 'calendar' && 'border-gold/45 bg-gold-soft text-gold-ink',
          )}
        >
          <CalendarDays className="size-[18px]" />
        </button>
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

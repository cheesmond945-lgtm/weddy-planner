import { ChevronDown, Search, Tag } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ClearFilters, FilterBar, FilterSelect, SearchBox } from '@/features/adminShared/components/Filters'
import { StatusChips, type ChipItem, type ChipTone } from '@/features/adminShared/components/StatusChips'
import { cn } from '@/lib/utils'
import { PACKAGE_STATUSES, type PackageStatus, type VendorPackage } from '@/types/vendorPackage'
import { PACKAGE_STATUS } from '../constants'
import { SORTS, type PackageFilters as Filters } from '../filters'

const TONE: Record<PackageStatus, ChipTone> = { DRAFT: 'wait', PENDING: 'info', NEEDS_REVISION: 'warn', PUBLISHED: 'done', HIDDEN: 'neutral' }

/** Nhãn trạng thái kèm số gói (đã lọc theo từ khóa và tag), nằm dưới thanh tìm kiếm và bộ lọc. */
export function PackageStatusChips({ value, onChange, matched }: { value: PackageStatus | ''; onChange: (v: PackageStatus | '') => void; matched: VendorPackage[] }) {
  const items: ChipItem<PackageStatus | 'ALL'>[] = [
    { value: 'ALL', label: 'Tất cả', count: matched.length, tone: 'neutral' },
    ...PACKAGE_STATUSES.map((s) => ({ value: s, label: PACKAGE_STATUS[s].label, count: matched.filter((p) => p.status === s).length, tone: TONE[s] })),
  ]
  return <StatusChips items={items} value={value || 'ALL'} onChange={(v) => onChange(v === 'ALL' ? '' : v)} label="Lọc theo trạng thái gói" />
}

/** Chọn nhiều tag, có ô tìm. */
function TagFilter({ all, value, onChange }: { all: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const shown = all.filter((t) => t.toLowerCase().includes(q.trim().toLowerCase()))

  return (
    <div ref={ref} className="relative max-sm:flex-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex h-10 items-center gap-2 rounded-[999px] border border-line-strong bg-surface px-4 text-[13.5px] whitespace-nowrap max-sm:w-full [&_svg]:size-[15px] [&_svg]:text-muted-foreground',
          value.length > 0 && 'border-gold bg-gold-soft text-gold-ink',
        )}
      >
        <Tag />
        {value.length ? `Tags (${value.length})` : 'Lọc theo tags'}
        <ChevronDown className="ml-auto" />
      </button>
      {open && (
        <div role="dialog" aria-label="Chọn tags" className="absolute top-[calc(100%+4px)] left-0 z-30 grid w-[260px] gap-2 rounded-md border border-line bg-surface p-2.5 shadow-portal-lift">
          <div className="flex h-[34px] items-center rounded-sm border border-line-strong focus-within:border-gold">
            <Search className="ml-3 size-4 flex-none text-muted-foreground" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tag" aria-label="Tìm tag" className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13.5px] outline-none" />
          </div>
          <div className="grid max-h-[240px] gap-0.5 overflow-y-auto">
            {shown.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-[7px] text-[13px] hover:bg-surface-2">
                <input type="checkbox" className="accent-gold" checked={value.includes(t)} onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))} />
                {t}
              </label>
            ))}
            {!shown.length && <p className="px-2 text-[12.5px] text-muted-foreground">Không có tag phù hợp.</p>}
          </div>
          <p className="text-xs text-muted-foreground">Hiện gói có ít nhất một tag đã chọn.</p>
        </div>
      )}
    </div>
  )
}

interface PackageToolbarProps {
  filters: Filters
  allTags: string[]
  onChange: (patch: Partial<Filters>) => void
  onReset: () => void
}

/** Thanh tìm kiếm và bộ lọc (tìm theo tên gói hoặc tag, lọc tag, sắp xếp), cùng kiểu trang Quản lý hồ sơ của Admin. */
export function PackageToolbar({ filters, allTags, onChange, onReset }: PackageToolbarProps) {
  const filtering = !!(filters.q || filters.tags.length || filters.sort !== 'updated')
  return (
    <FilterBar>
      <SearchBox value={filters.q} onChange={(q) => onChange({ q })} placeholder="Tìm theo tên gói hoặc tag..." />
      <TagFilter all={allTags} value={filters.tags} onChange={(tags) => onChange({ tags })} />
      <FilterSelect label="Sắp xếp" value={filters.sort} onChange={(v) => onChange({ sort: v as Filters['sort'] })}>
        {SORTS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </FilterSelect>
      <ClearFilters show={filtering} onClick={onReset} />
    </FilterBar>
  )
}

import { ChevronDown, RotateCw, Search, Tag, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { controlClass } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import { PACKAGE_STATUSES, type PackageStatus, type VendorPackage } from '@/types/vendorPackage'
import { PACKAGE_STATUS } from '../constants'
import { SORTS, type PackageFilters as Filters } from '../filters'

/** Tab trạng thái kèm số gói (đã lọc theo từ khóa và tag). */
export function StatusTabs({ value, onChange, matched }: { value: PackageStatus | ''; onChange: (v: PackageStatus | '') => void; matched: VendorPackage[] }) {
  const tabs: [PackageStatus | '', string][] = [['', 'Tất cả'], ...PACKAGE_STATUSES.map((s) => [s, PACKAGE_STATUS[s].label] as [PackageStatus, string])]
  return (
    <div role="tablist" aria-label="Lọc theo trạng thái" className="mb-4 flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:thin]">
      {tabs.map(([s, label]) => {
        const on = value === s
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(s)}
            className={cn(
              'relative -mb-px flex flex-none items-center gap-2 px-3.5 py-2.5 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-ink',
              'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-(image:--gold-grad) after:transition-transform after:duration-300',
              on && 'font-semibold text-ink after:scale-x-100',
            )}
          >
            {label}
            <span
              className={cn(
                'rounded-pill border px-[7px] text-[11.5px] tabular-nums',
                on ? 'border-transparent bg-gold-soft text-gold-ink' : 'border-line bg-surface-2',
              )}
            >
              {(s ? matched.filter((p) => p.status === s) : matched).length}
            </span>
          </button>
        )
      })}
    </div>
  )
}

/** Chọn nhiều tag, có ô tìm (TagFilter trong prototype NCC). */
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
          'inline-flex h-10 items-center gap-2 rounded-sm border border-line-strong bg-surface px-3 text-[13.5px] whitespace-nowrap max-sm:w-full [&_svg]:size-[15px] [&_svg]:text-muted-foreground',
          value.length > 0 && 'border-gold bg-gold-soft text-gold-ink',
        )}
      >
        <Tag />
        {value.length ? `Tags (${value.length})` : 'Lọc tags'}
        <ChevronDown className="ml-auto" />
      </button>
      {open && (
        <div role="dialog" aria-label="Chọn tags" className="absolute top-[calc(100%+4px)] left-0 z-30 grid w-[260px] gap-2 rounded-md border border-line bg-surface p-2.5 shadow-portal-lift">
          <div className="flex h-[34px] items-center rounded-sm border border-line-strong focus-within:border-gold">
            <Search className="ml-3 size-4 flex-none text-muted-foreground" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm tag"
              aria-label="Tìm tag"
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13.5px] outline-none"
            />
          </div>
          <div className="grid max-h-[240px] gap-0.5 overflow-y-auto">
            {shown.map((t) => (
              <label key={t} className="flex cursor-pointer items-center gap-2 rounded-[6px] px-2 py-[7px] text-[13px] hover:bg-surface-2">
                <input
                  type="checkbox"
                  className="accent-gold"
                  checked={value.includes(t)}
                  onChange={(e) => onChange(e.target.checked ? [...value, t] : value.filter((x) => x !== t))}
                />
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

/** Ô tìm, lọc tag, sắp xếp, nút đặt lại và các chip điều kiện đang lọc. */
export function PackageToolbar({ filters, allTags, onChange, onReset }: PackageToolbarProps) {
  const sortLabel = SORTS.find((s) => s.value === filters.sort)!.label
  const chips = [
    filters.q && { key: 'q', label: `Từ khóa: ${filters.q}`, clear: () => onChange({ q: '' }) },
    ...filters.tags.map((t) => ({ key: `t-${t}`, label: `Tag: ${t}`, clear: () => onChange({ tags: filters.tags.filter((x) => x !== t) }) })),
    filters.sort !== 'updated' && { key: 'sort', label: `Sắp xếp: ${sortLabel}`, clear: () => onChange({ sort: 'updated' }) },
  ].filter((c): c is { key: string; label: string; clear: () => void } => !!c)

  return (
    <>
      <div className="mb-2.5 flex flex-wrap items-center gap-2.5">
        <div className="flex h-10 min-w-[200px] flex-[1_1_240px] items-center rounded-sm border border-line-strong bg-surface focus-within:border-gold max-sm:basis-full">
          <Search className="ml-3 size-4 flex-none text-muted-foreground" />
          <input
            value={filters.q}
            onChange={(e) => onChange({ q: e.target.value })}
            placeholder="Tìm theo tên gói hoặc tag"
            aria-label="Tìm theo tên gói hoặc tag"
            className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13.5px] outline-none"
          />
          {filters.q && (
            <button type="button" aria-label="Xóa tìm kiếm" onClick={() => onChange({ q: '' })} className="mr-1 grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <TagFilter all={allTags} value={filters.tags} onChange={(tags) => onChange({ tags })} />
        <select
          aria-label="Sắp xếp"
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as Filters['sort'] })}
          className={cn(controlClass, 'w-auto min-w-[150px] cursor-pointer max-sm:flex-1')}
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-label="Đặt lại bộ lọc"
          title="Đặt lại bộ lọc"
          disabled={!chips.length}
          onClick={onReset}
          className="grid size-10 place-items-center rounded-sm border border-line-strong bg-surface text-muted-foreground hover:text-ink disabled:opacity-40"
        >
          <RotateCw className="size-[18px]" />
        </button>
      </div>
      {chips.length > 0 && (
        <div className="mt-1 mb-3.5 flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <span key={c.key} className="inline-flex h-7 items-center gap-1 rounded-pill bg-gold-soft pr-1 pl-2.5 text-[12.5px] text-gold-ink">
              {c.label}
              <button type="button" aria-label={`Bỏ ${c.label}`} onClick={c.clear} className="grid size-[22px] place-items-center rounded-full hover:bg-ink/10">
                <X className="size-3" />
              </button>
            </span>
          ))}
          {filters.sort !== 'updated' && <span className="text-[12.5px] text-muted-foreground">Sắp xếp giá theo giá tối thiểu của gói.</span>}
        </div>
      )}
    </>
  )
}

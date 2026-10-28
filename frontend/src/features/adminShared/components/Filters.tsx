import { Search, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { controlClass } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'

/** Ô tìm kiếm bo tròn có biểu tượng kính lúp. */
export function SearchBox({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cn('relative min-w-[220px] flex-1', className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(controlClass, 'rounded-[999px] pr-9 pl-10')}
      />
      {value && (
        <button type="button" aria-label="Xóa từ khóa" onClick={() => onChange('')} className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-ink">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}

/** Ô chọn bo tròn trong thanh lọc. */
export function FilterSelect({ value, onChange, label, children, className }: { value: string; onChange: (v: string) => void; label: string; children: ReactNode; className?: string }) {
  return (
    <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(controlClass, 'w-auto min-w-[150px] rounded-[999px] pr-8', className)}>
      {children}
    </select>
  )
}

/** Nút "Xóa lọc", chỉ hiện khi đang có bộ lọc. */
export function ClearFilters({ show, onClick }: { show: boolean; onClick: () => void }) {
  if (!show) return null
  return (
    <button type="button" onClick={onClick} className="px-2 text-[13px] font-medium whitespace-nowrap text-gold-ink hover:underline">
      Xóa lọc
    </button>
  )
}

/** Thanh lọc: nằm trên đầu bảng, ngăn cách bằng đường kẻ. */
export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">{children}</div>
}

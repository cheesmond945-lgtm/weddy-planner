import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ColorFilterOption {
  value: string
  label: string
  /** Màu chấm (cùng màu với lịch) */
  color: CSSProperties['backgroundColor']
  /** Chữ nhỏ cạnh tên (mã đơn, "ẩn"…) */
  sub?: string
  /** Nhãn nổi bên phải (số việc trễ…) */
  badge?: ReactNode
  title?: string
}

interface ColorFilterProps {
  ariaLabel: string
  /** Chữ khi không lọc ("Tất cả sảnh", "Tất cả khách") */
  allLabel: string
  /** Đơn vị khi chọn nhiều ("khách" → "3 khách") */
  unit: string
  options: ColorFilterOption[]
  /** Rỗng = tất cả */
  value: string[]
  onChange: (value: string[]) => void
  /** Chọn được nhiều mục (bấm để bật / tắt); không thì chọn một mục là đóng bảng */
  multiple?: boolean
}

/**
 * Bộ lọc gọn cho lịch: một nút tròn ("Tất cả sảnh ▾") thay cho cả hàng thẻ tên dài; bấm mở danh sách nổi, mỗi dòng có chấm màu (cùng màu
 * trên lịch), tên, chữ phụ, dấu chọn. Nút hiện mục đang lọc kèm màu (chọn nhiều thì "N khách"). Bấm ra ngoài hoặc Esc thì đóng.
 */
export function ColorFilter({ ariaLabel, allLabel, unit, options, value, onChange, multiple }: ColorFilterProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()

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

  const picked = options.filter((o) => value.includes(o.value))
  const pick = (v: string) => {
    if (!multiple) {
      onChange(value.includes(v) ? [] : [v])
      setOpen(false)
      return
    }
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v])
  }
  const row = 'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] hover:bg-bg'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex max-w-[280px] items-center gap-2 rounded-pill border px-3.5 py-1.5 text-[13.5px] font-medium transition-colors',
          picked.length ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-ink',
        )}
      >
        {picked.length === 0 ? (
          allLabel
        ) : picked.length === 1 ? (
          <>
            <i aria-hidden className="size-2.5 flex-none rounded-full" style={{ backgroundColor: picked[0].color }} />
            <span className="truncate">{picked[0].label}</span>
          </>
        ) : (
          <>
            <span aria-hidden className="flex -space-x-1">
              {picked.slice(0, 3).map((o) => (
                <i key={o.value} className="size-2.5 rounded-full ring-2 ring-ink" style={{ backgroundColor: o.color }} />
              ))}
            </span>
            {picked.length} {unit}
          </>
        )}
        <ChevronDown aria-hidden className={cn('size-4 flex-none opacity-70 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          id={panelId}
          role="listbox"
          aria-multiselectable={multiple || undefined}
          className="absolute top-full left-0 z-30 mt-1.5 max-h-[320px] w-[min(320px,calc(100vw-32px))] overflow-y-auto rounded-xl border border-line bg-surface p-1.5 shadow-[0_8px_24px_rgb(var(--shadow-rgb)/0.12)]"
        >
          <button
            type="button"
            role="option"
            aria-selected={value.length === 0}
            onClick={() => {
              onChange([])
              setOpen(false)
            }}
            className={cn(row, 'font-medium')}
          >
            <span className="flex-1">{allLabel}</span>
            {value.length === 0 && <Check aria-hidden className="size-4 text-gold-700" />}
          </button>
          <div className="my-1 border-t border-line" />
          {options.map((o) => {
            const on = value.includes(o.value)
            return (
              <button key={o.value} type="button" role="option" aria-selected={on} title={o.title} onClick={() => pick(o.value)} className={cn(row, on && 'bg-gold-100/60')}>
                <i aria-hidden className="size-3 flex-none rounded-full" style={{ backgroundColor: o.color }} />
                <span className="min-w-0 flex-1 truncate">
                  {o.label}
                  {o.sub && <span className="ml-1.5 text-[12px] text-muted-foreground">{o.sub}</span>}
                </span>
                {o.badge}
                {on && <Check aria-hidden className="size-4 flex-none text-gold-700" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

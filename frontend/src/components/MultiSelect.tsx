import { ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface MultiSelectProps {
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  /** Chữ trên nút, tính theo danh sách đang chọn */
  summary: (selected: string[]) => string
  /** Có nút "Chọn tất cả / Bỏ chọn tất cả" */
  selectAll?: boolean
  'aria-labelledby'?: string
}

/** Ô chọn nhiều dạng thả xuống (.msel trong prototype). */
export function MultiSelect({ options, value, onChange, summary, selectAll, ...aria }: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const all = options.length > 0 && value.length === options.length

  // Bấm ra ngoài hoặc Esc thì đóng
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

  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...options.map((o) => o.value)].filter((x) => x === v || value.includes(x)))

  return (
    <div ref={ref}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-[46px] w-full cursor-pointer items-center justify-between gap-2.5 rounded-[14px] border border-line bg-surface px-4 py-2.5 text-left text-sm font-medium text-ink hover:border-gold aria-expanded:border-gold"
        {...aria}
      >
        <span className={cn('min-w-0 flex-1 truncate', !value.length && 'font-normal text-muted-foreground')}>{summary(value)}</span>
        <ChevronDown className={cn('size-[18px] shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div id={panelId} hidden={!open} className="mt-1.5 rounded-[14px] border border-line bg-bg p-2">
        {selectAll && (
          <div className="flex justify-end px-2 pt-0.5 pb-1.5">
            <button type="button" onClick={() => onChange(all ? [] : options.map((o) => o.value))} className="text-[13px] font-medium text-ink underline underline-offset-[3px]">
              {all ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
        )}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-0.5">
          {options.map((o) => {
            const checked = value.includes(o.value)
            return (
              <label key={o.value} className="flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-[9px] text-sm font-medium hover:bg-accent-soft">
                <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} className="size-[18px] shrink-0 cursor-pointer accent-gold" />
                {o.label}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

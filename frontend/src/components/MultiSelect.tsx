import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface MultiSelectProps {
  options: { value: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
  /** Chữ mờ trên nút khi chưa chọn gì */
  placeholder: string
  /** Chữ trên nút khi chọn hết (vd "Tất cả dịch vụ"); không có thì vẫn hiện thẻ như thường */
  allLabel?: string
  /** Số thẻ tên tối đa hiện trên nút, phần còn lại gộp thành "+N" */
  maxChips?: number
  /** Có nút "Chọn tất cả / Bỏ chọn tất cả" */
  selectAll?: boolean
  /** Icon nhỏ bên trái chữ trên nút */
  icon?: ReactNode
  /** Viền đỏ khi có lỗi */
  invalid?: boolean
  'aria-labelledby'?: string
}

/** Chiều cao tối đa của bảng chọn (px); nhiều lựa chọn hơn thì cuộn trong bảng */
const PANEL_MAX_H = 260

/** Ô chọn nhiều dạng thả xuống (.msel trong prototype). Bảng chọn mở ngay dưới nút, đẩy nội dung bên dưới xuống; các lựa chọn là thẻ bo tròn xếp tràn hàng. */
export function MultiSelect({ options, value, onChange, placeholder, allLabel, maxChips = 2, selectAll, icon, invalid, ...aria }: MultiSelectProps) {
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
        aria-invalid={invalid || undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-line bg-white/85 px-3.5 py-2 text-left text-sm font-medium text-ink hover:border-gold aria-expanded:border-gold aria-invalid:border-destructive"
        {...aria}
      >
        {icon && (
          <span aria-hidden className="shrink-0 text-gold-700 [&_svg]:size-[18px]">
            {icon}
          </span>
        )}
        <SelectedChips options={options} value={value} placeholder={placeholder} allLabel={all ? allLabel : undefined} maxChips={maxChips} />
        <ChevronDown className={cn('size-[18px] shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      <div
        id={panelId}
        hidden={!open}
        style={{ maxHeight: PANEL_MAX_H }}
        className="mt-1.5 overflow-auto rounded-xl border border-line bg-surface p-3 shadow-[0_8px_24px_rgb(var(--shadow-rgb)/0.1)]"
      >
        {selectAll && (
          <div className="mb-2 flex justify-end">
            <button type="button" onClick={() => onChange(all ? [] : options.map((o) => o.value))} className="text-[13px] font-medium text-gold-700 underline underline-offset-[3px] hover:text-gold-800">
              {all ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {options.map((o) => {
            const checked = value.includes(o.value)
            return (
              <label
                key={o.value}
                className={cn(
                  'inline-flex cursor-pointer items-center gap-1.5 rounded-pill border px-3 py-1.5 text-[13px] font-medium transition-colors select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-ring',
                  checked ? 'border-gold bg-gold-100 text-gold-800' : 'border-line bg-white/70 text-ink-2 hover:border-gold hover:text-ink',
                )}
              >
                <input type="checkbox" checked={checked} onChange={() => toggle(o.value)} className="sr-only" />
                {checked && <Check aria-hidden className="size-3.5" strokeWidth={2.6} />}
                {o.label}
              </label>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Phần chữ trên nút: chưa chọn thì chữ mờ, chọn hết thì allLabel, còn lại là thẻ tên các mục đã chọn kèm "+N" */
function SelectedChips({ options, value, placeholder, allLabel, maxChips }: { options: { value: string; label: string }[]; value: string[]; placeholder: string; allLabel?: string; maxChips: number }) {
  if (!value.length) return <span className="min-w-0 flex-1 truncate font-normal text-muted-foreground">{placeholder}</span>
  if (allLabel) return <span className="min-w-0 flex-1 truncate">{allLabel}</span>
  const labels = options.filter((o) => value.includes(o.value)).map((o) => o.label)
  const shown = labels.slice(0, maxChips)
  const rest = labels.length - shown.length
  return (
    <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
      {shown.map((l) => (
        <span key={l} className="shrink-0 whitespace-nowrap rounded-pill bg-gold-100 px-2.5 py-0.5 text-[13px] font-medium text-gold-800">
          {l}
        </span>
      ))}
      {rest > 0 && <span className="shrink-0 text-[13px] font-semibold text-gold-700">+{rest}</span>}
    </span>
  )
}

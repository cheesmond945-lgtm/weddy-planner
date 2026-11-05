import { CalendarDays } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { DatePickPopover } from '@/features/vendorOrders/components/DatePickPopover'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'

interface DateFieldProps {
  id?: string
  /** "YYYY-MM-DD" hoặc rỗng */
  value: string
  onValueChange: (value: string) => void
  /** Ngày sớm nhất / muộn nhất chọn được ("YYYY-MM-DD"); không có thì không giới hạn */
  min?: string
  max?: string
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  /** Có thì lịch có nút "Xóa ngày" (ô ngày tùy chọn) */
  clearable?: boolean
  className?: string
  'aria-describedby'?: string
}

/** "dd/mm/yyyy" đủ 10 ký tự, ngày có thật -> "YYYY-MM-DD"; không thì null. */
function parseTyped(text: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (!m) return null
  const [, d, mo, y] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  if (dt.getFullYear() !== Number(y) || dt.getMonth() !== Number(mo) - 1 || dt.getDate() !== Number(d)) return null
  return `${y}-${mo}-${d}`
}

/** Chỉ giữ chữ số (tối đa 8) và chèn "/" thành dd/mm/yyyy khi gõ. */
function maskTyped(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

/**
 * Ô chọn ngày dùng chung: gõ thẳng "dd/mm/yyyy" (tự chèn dấu "/") hoặc bấm biểu tượng lịch để chọn trên lịch dựng sẵn của "Đổi ngày"
 * (tiếng Việt, tuần bắt đầu thứ Hai, đúng màu theme). Ngày gõ ngoài khoảng min/max thì không nhận, rời ô sẽ trả về ngày đang có.
 */
export function DateField({ id, value, onValueChange, min, max, placeholder = 'dd/mm/yyyy', disabled, invalid, clearable, className, ...aria }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(value ? formatDate(value) : '')
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useEffect(() => setDraft(value ? formatDate(value) : ''), [value])
  const clear = clearable && value ? () => {
    onValueChange('')
    setOpen(false)
  } : undefined
  const inRange = (iso: string) => (!min || iso >= min) && (!max || iso <= max)
  const onType = (raw: string) => {
    const text = maskTyped(raw)
    setDraft(text)
    const iso = parseTyped(text)
    if (iso && inRange(iso)) onValueChange(iso)
    else if (!text && clearable) onValueChange('')
  }
  const onBlur = () => {
    const iso = parseTyped(draft)
    if (!(iso && inRange(iso))) setDraft(value ? formatDate(value) : '')
  }
  return (
    <>
      <div
        ref={ref}
        className={cn(
          'flex w-full min-w-0 items-center justify-between gap-2 rounded-sm border border-input bg-surface px-3 py-2.5 text-left text-[15px] text-ink',
          'focus-within:border-ring focus-within:outline-2 focus-within:outline-offset-0 focus-within:outline-ring',
          disabled && 'cursor-not-allowed opacity-50',
          invalid && 'border-destructive',
          open && 'border-ring',
          className,
        )}
      >
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          aria-invalid={invalid ? true : undefined}
          placeholder={placeholder}
          value={draft}
          onChange={(e) => onType(e.target.value)}
          onBlur={onBlur}
          className="min-w-0 flex-1 bg-transparent tabular-nums outline-none placeholder:text-muted-foreground"
          {...aria}
        />
        <button type="button" disabled={disabled} aria-label="Mở lịch" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="shrink-0">
          <CalendarDays aria-hidden className="size-4 text-muted-foreground" />
        </button>
      </div>
      {open && (
        <DatePickPopover
          anchor={ref}
          value={value}
          eventDate=""
          min={min ?? null}
          max={max ?? null}
          confirmStep={false}
          onClear={clear}
          onPick={(d) => {
            onValueChange(d)
            setOpen(false)
          }}
          onClose={close}
        />
      )}
    </>
  )
}

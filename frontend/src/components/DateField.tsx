import { CalendarDays } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
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

/**
 * Ô chọn ngày dùng chung thay cho ô ngày của trình duyệt (<input type="date">): bấm mở đúng lịch dựng sẵn của "Đổi ngày" (tiếng Việt, tuần bắt đầu thứ Hai,
 * đúng màu theme), hiện "dd/mm/yyyy". Cùng kiểu ô nhập: className như của Input / controlClass ở nơi dùng.
 */
export function DateField({ id, value, onValueChange, min, max, placeholder = 'dd/mm/yyyy', disabled, invalid, clearable, className, ...aria }: DateFieldProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const clear = clearable && value ? () => {
    onValueChange('')
    setOpen(false)
  } : undefined
  return (
    <>
      <button
        ref={ref}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid ? true : undefined}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full min-w-0 items-center justify-between gap-2 rounded-sm border border-input bg-surface px-3 py-2.5 text-left text-[15px] text-ink',
          'focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
          open && 'border-ring',
          className,
        )}
        {...aria}
      >
        <span className={cn('truncate tabular-nums', !value && 'text-muted-foreground')}>{value ? formatDate(value) : placeholder}</span>
        <CalendarDays aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      </button>
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

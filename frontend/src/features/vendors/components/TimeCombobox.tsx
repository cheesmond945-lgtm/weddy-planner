import { Clock } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { HALF_HOURS } from '../constants'
import { controlClass } from './FormParts'

interface TimeComboboxProps {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  error?: string
  disabled?: boolean
}

/** Ô giờ: gõ tự do dạng HH:mm hoặc chọn trong danh sách mốc 30 phút (danh sách ngắn, cuộn được). */
export function TimeCombobox({ label, value, onChange, placeholder, error, disabled }: TimeComboboxProps) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    // Cuộn tới mốc đang chọn
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          maxLength={5}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-expanded={open}
          aria-controls={`${id}-list`}
          onFocus={() => !disabled && setOpen(true)}
          onClick={() => !disabled && setOpen(true)}
          onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
          onChange={(e) => onChange(e.target.value)}
          className={cn(controlClass, 'pr-9', disabled && 'bg-surface-2')}
        />
        <Clock aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>

      {open && !disabled && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className="absolute top-[calc(100%+4px)] left-0 z-30 max-h-[180px] w-full min-w-[120px] overflow-y-auto rounded-md border border-line bg-surface py-1 shadow-portal-lift"
        >
          {HALF_HOURS.map((t) => (
            <li key={t} role="option" aria-selected={t === value}>
              <button
                type="button"
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(t)
                  setOpen(false)
                }}
                className={cn('block w-full px-3 py-1.5 text-left text-[13.5px] tabular-nums hover:bg-surface-2', t === value && 'bg-gold-soft font-semibold text-gold-ink')}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" data-field-error className="mt-1.5 text-[13px] text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}

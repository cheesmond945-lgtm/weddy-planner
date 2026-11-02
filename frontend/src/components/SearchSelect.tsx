import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SearchSelectGroup {
  label: string
  options: { value: string; label: string }[]
}

interface SearchSelectProps {
  groups: SearchSelectGroup[]
  value: string
  onChange: (value: string) => void
  /** Chữ mờ trên nút khi chưa chọn */
  placeholder: string
  /** Chữ mờ trong ô tìm */
  searchPlaceholder?: string
  /** Chữ trên nút khi đã chọn; mặc định là nhãn của lựa chọn */
  display?: (value: string) => string
  /** Icon nhỏ bên trái chữ trên nút */
  icon?: ReactNode
  /** Viền đỏ khi có lỗi */
  invalid?: boolean
  id?: string
  'aria-labelledby'?: string
  'aria-describedby'?: string
}

/** Chiều cao tối đa của danh sách (px); nhiều lựa chọn hơn thì cuộn */
const LIST_MAX_H = 260

/** Bỏ dấu tiếng Việt, viết thường: "Cầu Giấy" -> "cau giay" (tìm không cần gõ dấu) */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'd')
    .toLowerCase()

/**
 * Ô chọn một giá trị dạng thả xuống, có ô tìm kiếm và nhóm lựa chọn. Cùng kiểu nút với MultiSelect;
 * bảng chọn mở ngay dưới nút, đẩy nội dung bên dưới xuống. Bàn phím: ↑/↓ chọn dòng, Enter chọn, Esc đóng.
 */
export function SearchSelect({ groups, value, onChange, placeholder, searchPlaceholder = 'Tìm…', display, icon, invalid, id, ...aria }: SearchSelectProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const listId = useId()
  const optionId = (i: number) => `${listId}-o${i}`

  const q = fold(query.trim())
  const shown = groups.map((g) => ({ ...g, options: g.options.filter((o) => !q || fold(o.label).includes(q)) })).filter((g) => g.options.length)
  const flat = shown.flatMap((g) => g.options)
  const selected = groups.flatMap((g) => g.options).find((o) => o.value === value)

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Giữ dòng đang chọn trong tầm nhìn khi dùng phím mũi tên
  useEffect(() => {
    if (open) document.getElementById(optionId(active))?.scrollIntoView({ block: 'nearest' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open])

  const openPanel = () => {
    setQuery('')
    setActive(Math.max(0, flat.findIndex((o) => o.value === value)))
    setOpen(true)
  }
  const close = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }
  const pick = (v: string) => {
    onChange(v)
    close()
  }

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(flat.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (flat[active]) pick(flat[active].value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  let index = -1
  return (
    <div ref={ref}>
      <button
        ref={buttonRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={invalid || undefined}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className="flex min-h-10 w-full cursor-pointer items-center justify-between gap-2.5 rounded-xl border border-line bg-white/85 px-3.5 py-2 text-left text-sm font-medium text-ink hover:border-gold aria-expanded:border-gold aria-invalid:border-destructive"
        {...aria}
      >
        {icon && (
          <span aria-hidden className="shrink-0 text-gold-700 [&_svg]:size-[18px]">
            {icon}
          </span>
        )}
        <span className={cn('min-w-0 flex-1 truncate', !selected && 'font-normal text-muted-foreground')}>{selected ? (display?.(selected.value) ?? selected.label) : placeholder}</span>
        <ChevronDown className={cn('size-[18px] shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="mt-1.5 rounded-xl border border-line bg-surface p-2 shadow-[0_8px_24px_rgb(var(--shadow-rgb)/0.1)]">
          <div className="relative mb-1.5">
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={flat[active] ? optionId(active) : undefined}
              aria-label={searchPlaceholder}
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onKey}
              className="h-9 w-full rounded-lg border border-line bg-white/85 pr-3 pl-9 text-sm focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" style={{ maxHeight: LIST_MAX_H }} className="overflow-auto">
            {!flat.length && <li className="px-3 py-2.5 text-sm text-muted-foreground">Không tìm thấy</li>}
            {shown.map((g) => (
              <li key={g.label} role="presentation">
                <div className="px-3 pt-2 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  {g.label} <span className="font-normal">({g.options.length})</span>
                </div>
                <ul role="group" aria-label={g.label}>
                  {g.options.map((o) => {
                    index++
                    const i = index
                    const isSelected = o.value === value
                    return (
                      <li
                        key={o.value}
                        id={optionId(i)}
                        role="option"
                        aria-selected={isSelected}
                        onMouseMove={() => setActive(i)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pick(o.value)}
                        className={cn(
                          'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm',
                          i === active && 'bg-gold-100 text-gold-800',
                          isSelected && 'font-semibold',
                        )}
                      >
                        {o.label}
                        {isSelected && <Check aria-hidden className="size-4 shrink-0 text-gold-700" strokeWidth={2.6} />}
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

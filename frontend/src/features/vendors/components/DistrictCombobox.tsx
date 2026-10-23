import { Check, ChevronDown, MapPin, Search, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { DISTRICTS } from '../constants'

/** Bỏ dấu, chữ thường để tìm "cau giay" ra "Cầu Giấy". Mỗi ký tự giữ nguyên vị trí để tô đậm đúng chỗ. */
const fold = (s: string) =>
  Array.from(s)
    .map((ch) => (ch === 'đ' || ch === 'Đ' ? 'd' : ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() || ch))
    .join('')

function Highlight({ text, query }: { text: string; query: string }) {
  const q = fold(query.trim())
  const i = q ? fold(text).indexOf(q) : -1
  if (i < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-[3px] bg-gold/30 px-px font-bold text-inherit">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

interface DistrictComboboxProps {
  value: string
  onChange: (district: string) => void
  disabled?: boolean
  invalid?: boolean
}

/** Chọn quận, có ô tìm kiếm không dấu (DistrictCombo trong prototype NCC). */
export function DistrictCombobox({ value, onChange, disabled, invalid }: DistrictComboboxProps) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const q = fold(query.trim())
  const options = q ? DISTRICTS.filter((d) => fold(d).includes(q)) : DISTRICTS

  // Bấm ra ngoài thì đóng
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  function openList() {
    setQuery('')
    setActive(Math.max(0, DISTRICTS.indexOf(value)))
    setOpen(true)
  }

  function pick(d: string) {
    onChange(d)
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onSearchKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(options.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (options[active]) pick(options[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
      buttonRef.current?.focus()
    }
  }

  const box = 'flex h-10 w-full min-w-0 items-center overflow-hidden rounded-sm border border-line-strong bg-surface text-[13.5px]'

  if (disabled) {
    return (
      <div className={cn(box, 'bg-surface-2')}>
        <MapPin className="ml-3 size-4 flex-none text-muted-foreground" />
        <span className="truncate px-2 text-ink">{value || 'Chưa chọn quận'}</span>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={cn(
          box,
          'transition-[border-color,box-shadow]',
          invalid && 'border-destructive',
          open && 'border-gold ring-[3px] ring-gold/20',
        )}
      >
        <button
          ref={buttonRef}
          type="button"
          role="combobox"
          aria-label="Quận"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-invalid={invalid || undefined}
          onClick={() => (open ? setOpen(false) : openList())}
          onKeyDown={(e) => {
            if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
              e.preventDefault()
              openList()
            }
          }}
          className="flex h-full min-w-0 flex-1 items-center text-left outline-none"
        >
          <MapPin className="ml-3 size-4 flex-none text-muted-foreground" />
          <span className={cn('truncate pl-2', !value && 'text-muted-foreground')}>{value || 'Chọn quận'}</span>
        </button>
        {value && (
          <button
            type="button"
            aria-label="Xóa quận đã chọn"
            title="Xóa lựa chọn"
            onClick={() => onChange('')}
            className="mr-0.5 grid size-7 flex-none place-items-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )}
        <ChevronDown className="mr-3 size-4 flex-none text-muted-foreground" />
      </div>

      {open && (
        <div className="absolute inset-x-0 top-[calc(100%+6px)] z-[70] grid gap-1.5 rounded-md border border-line bg-surface p-2 shadow-portal-lift">
          <div className="flex h-[34px] items-center rounded-sm border border-line-strong focus-within:border-gold">
            <Search className="ml-3 size-4 flex-none text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActive(0)
              }}
              onKeyDown={onSearchKey}
              placeholder="Tìm quận…"
              aria-label="Tìm quận"
              aria-controls={listId}
              aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
              className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13.5px] outline-none"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Danh sách quận" className="max-h-[260px] overflow-y-auto">
            {options.map((d, i) => (
              <li
                key={d}
                id={`${listId}-${i}`}
                data-i={i}
                role="option"
                aria-selected={d === value}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault()
                  pick(d)
                }}
                className={cn(
                  'flex cursor-pointer items-center justify-between gap-2 rounded-[7px] px-2.5 py-[9px] text-[13.5px]',
                  i === active && 'bg-surface-2',
                  d === value && 'font-semibold text-gold-ink',
                )}
              >
                <span>
                  Quận <Highlight text={d} query={query} />
                </span>
                {d === value && <Check className="size-[15px] text-gold" />}
              </li>
            ))}
            {!options.length && (
              <li role="presentation" className="px-2.5 py-[9px] text-center text-[13.5px] text-muted-foreground">
                Không tìm thấy quận phù hợp
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}

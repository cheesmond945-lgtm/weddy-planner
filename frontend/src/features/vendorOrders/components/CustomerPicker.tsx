import { Check, ChevronDown, Search } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { matchesBoard, type CustomerInfo } from '../taskBoard'

export type CustomerOption = CustomerInfo

interface CustomerPickerProps {
  options: readonly CustomerOption[]
  /** orderId đang chọn, '' là tất cả khách */
  value: string
  onChange: (orderId: string) => void
  hueFor: (orderId: string) => number
}

/**
 * Ô chọn khách của Bảng việc: thay hàng nút khách (hàng trăm khách vẫn gọn). Bấm mở danh sách có ô tìm (không cần dấu, theo tên hoặc mã đơn);
 * mũi tên lên / xuống để di chuyển, Enter chọn, Esc đóng.
 */
export function CustomerPicker({ options, value, onChange, hueFor }: CustomerPickerProps) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const id = useId()
  const current = options.find((o) => o.orderId === value)
  // Mục đầu là "Tất cả khách" (orderId ''), chỉ hiện khi chưa gõ tìm
  const shown: (CustomerOption | null)[] = [...(q.trim() ? [] : [null]), ...options.filter((o) => matchesBoard({ ...o, packageNames: o.packages ? [o.packages] : [], title: '' }, q))]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !rootRef.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${cursor}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const pick = (o: CustomerOption | null) => {
    onChange(o?.orderId ?? '')
    setOpen(false)
    setQ('')
  }
  const openList = () => {
    setOpen(true)
    setCursor(Math.max(0, shown.findIndex((o) => (o?.orderId ?? '') === value)))
  }

  return (
    <div ref={rootRef} className="relative max-sm:w-full">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn(
          'inline-flex h-9 w-full max-w-[280px] items-center gap-2 rounded-pill border px-3 text-[13.5px] font-medium transition-colors max-sm:max-w-none',
          value ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-ink',
        )}
      >
        {current && <i aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${hueFor(current.orderId)} 60% 48%)` }} />}
        <span className="min-w-0 flex-1 truncate text-left">{current ? `${current.customerName} · ${current.orderCode}` : `Tất cả khách (${options.length})`}</span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div id={`${id}-panel`} className="absolute top-[calc(100%+4px)] left-0 z-30 w-[340px] max-w-[calc(100vw-32px)] rounded-lg border border-line bg-surface p-2 shadow-portal-lift">
          <label className="relative block">
            <span className="sr-only">Tìm khách theo tên hoặc mã đơn</span>
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              autoFocus
              type="search"
              role="combobox"
              aria-expanded
              aria-controls={`${id}-list`}
              aria-activedescendant={shown.length ? `${id}-opt-${cursor}` : undefined}
              value={q}
              placeholder="Tìm tên khách, mã đơn…"
              onChange={(e) => {
                setQ(e.target.value)
                setCursor(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') setCursor((c) => Math.min(c + 1, shown.length - 1))
                else if (e.key === 'ArrowUp') setCursor((c) => Math.max(c - 1, 0))
                else if (e.key === 'Enter' && shown.length) pick(shown[cursor])
                else if (e.key === 'Escape') setOpen(false)
                else return
                e.preventDefault()
              }}
              className="h-9 w-full rounded-md border border-line bg-bg pr-3 pl-8 text-[13.5px] outline-none placeholder:text-muted-foreground focus-visible:border-sage"
            />
          </label>
          <ul ref={listRef} id={`${id}-list`} role="listbox" aria-label="Khách" className="mt-1.5 max-h-[300px] overflow-y-auto">
            {shown.map((o, i) => {
              const selected = (o?.orderId ?? '') === value
              return (
                <li
                  key={o?.orderId ?? 'all'}
                  id={`${id}-opt-${i}`}
                  data-index={i}
                  role="option"
                  aria-selected={selected}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseMove={() => setCursor(i)}
                  onClick={() => pick(o)}
                  className={cn('flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-[13.5px]', i === cursor && 'bg-surface-2')}
                >
                  <i aria-hidden className="size-2.5 shrink-0 rounded-full" style={o ? { backgroundColor: `hsl(${hueFor(o.orderId)} 60% 48%)` } : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{o ? o.customerName || 'Khách' : 'Tất cả khách'}</span>
                    {o && (
                      <span className="block text-[12px] text-muted-foreground">
                        {o.orderCode}
                        {o.packages && ` · Gói ${o.packages}`}
                      </span>
                    )}
                    {o && (
                      <span className="block text-[12px] text-muted-foreground">
                        {o.done}/{o.total} việc xong · {o.confirmed}/{o.total} đã hẹn
                      </span>
                    )}
                  </span>
                  {o && o.late > 0 && <span className="shrink-0 rounded-pill bg-warn px-1.5 text-[11px] font-bold text-white">{o.late} trễ</span>}
                  {selected && <Check className="size-4 shrink-0" aria-hidden />}
                </li>
              )
            })}
            {!shown.length && <li className="px-2.5 py-3 text-center text-[13px] text-muted-foreground">Không có khách nào khớp.</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

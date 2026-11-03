import { CalendarRange, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { controlClass } from '@/features/vendors/components/FormParts'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { ORDER_STATUSES, type OrderListQuery, type OrderStatus } from '@/types/vendorOrder'
import { ORDER_STATUS } from '../constants'

interface TabsProps {
  counts: Record<OrderStatus, number> | undefined
  value?: OrderStatus
  onChange: (s?: OrderStatus) => void
}

/** Lọc theo 7 trạng thái, có số đếm; cuộn ngang được trên màn nhỏ. */
export function OrderStatusTabs({ counts, value, onChange }: TabsProps) {
  const total = counts ? Object.values(counts).reduce((s, n) => s + n, 0) : undefined
  const tabs: {
    key: OrderStatus | undefined
    label: string
    n: number | undefined
  }[] = [
    { key: undefined, label: 'Tất cả', n: total },
    ...ORDER_STATUSES.map((s) => ({
      key: s,
      label: ORDER_STATUS[s].label,
      n: counts?.[s],
    })),
  ]
  return (
    <div role="tablist" aria-label="Lọc theo trạng thái đơn" className="-mx-1 mb-3.5 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      {tabs.map((t) => {
        const on = value === t.key
        return (
          <button
            key={t.label}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={cn(
              'inline-flex h-[36px] flex-none items-center gap-1.5 rounded-pill border border-line bg-surface px-3.5 text-[13px] text-muted-foreground transition-colors hover:border-line-strong hover:text-ink',
              on && 'border-gold/45 bg-gold-soft font-semibold text-gold-ink',
            )}
          >
            {t.label}
            {t.n !== undefined && (
              <span
                className={cn('grid h-[18px] min-w-[18px] place-items-center rounded-pill px-[5px] text-[11px] font-semibold tabular-nums', on ? 'bg-(image:--gold-grad) text-gold-on' : 'bg-bg text-muted-foreground')}
              >
                {t.n}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

interface ToolbarProps {
  query: OrderListQuery
  onChange: (patch: Partial<OrderListQuery>) => void
  onReset: () => void
  hasFilter: boolean
}

/** Ô tìm kiếm pill (mã đơn, tên khách, số điện thoại) và nút chọn khoảng ngày sự kiện, cùng kiểu trang Tin nhắn. */
export function OrderToolbar({ query, onChange, onReset, hasFilter }: ToolbarProps) {
  const [text, setText] = useState(query.q ?? '')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Gõ xong mới tìm (tránh gọi API mỗi phím); dùng bản onChange mới nhất để không ghi đè bộ lọc vừa đổi
  const latest = useRef(onChange)
  latest.current = onChange
  useEffect(() => {
    if (text === (query.q ?? '')) return
    const t = setTimeout(() => latest.current({ q: text.trim() || undefined }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text])
  // Đổi từ ngoài (đặt lại bộ lọc): đồng bộ ô tìm
  useEffect(() => setText(query.q ?? ''), [query.q])

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

  const ranged = !!(query.from || query.to)
  const label = ranged ? `${query.from ? formatDate(query.from) : '…'} – ${query.to ? formatDate(query.to) : '…'}` : 'Ngày sự kiện'

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <div className="relative min-w-[240px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tìm mã đơn, tên khách, số điện thoại..."
          aria-label="Tìm mã đơn, tên khách, số điện thoại"
          className="w-full rounded-pill border border-line bg-surface py-3 pr-10 pl-9 text-sm text-ink outline-none focus:border-gold"
        />
        {text && (
          <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setText('')} className="absolute top-1/2 right-2.5 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:bg-bg">
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div ref={ref} className="relative">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'inline-flex h-[46px] items-center gap-2 rounded-pill border border-line bg-surface px-4 text-[13.5px] text-muted-foreground hover:border-line-strong hover:text-ink',
            ranged && 'border-gold/45 bg-gold-soft text-gold-ink',
          )}
        >
          <CalendarRange className="size-[17px]" />
          {label}
        </button>
        {open && (
          <div className="absolute top-[calc(100%+6px)] right-0 z-20 grid w-[280px] gap-3 rounded-lg border border-line bg-surface p-4 shadow-portal-lift max-sm:right-auto max-sm:left-0">
            <p className="text-[12.5px] text-muted-foreground">Lọc theo ngày diễn ra sự kiện</p>
            <label className="grid gap-1 text-[13px] font-medium">
              Từ ngày
              <input type="date" className={controlClass} value={query.from ?? ''} max={query.to || undefined} onChange={(e) => onChange({ from: e.target.value || undefined })} />
            </label>
            <label className="grid gap-1 text-[13px] font-medium">
              Đến ngày
              <input type="date" className={controlClass} value={query.to ?? ''} min={query.from || undefined} onChange={(e) => onChange({ to: e.target.value || undefined })} />
            </label>
            {ranged && (
              <button type="button" onClick={() => onChange({ from: undefined, to: undefined })} className="justify-self-start text-[13px] font-medium text-gold-ink hover:underline">
                Bỏ khoảng ngày
              </button>
            )}
          </div>
        )}
      </div>

      {(query.depositFrom || query.depositTo) && (
        <span className="inline-flex h-[46px] items-center gap-2 rounded-pill border border-gold/45 bg-gold-soft pr-2 pl-4 text-[13.5px] text-gold-ink">
          Ngày cọc: {query.depositFrom ? formatDate(query.depositFrom) : '…'} – {query.depositTo ? formatDate(query.depositTo) : '…'}
          <button type="button" aria-label="Bỏ lọc ngày cọc" onClick={() => onChange({ depositFrom: undefined, depositTo: undefined })} className="grid size-7 place-items-center rounded-full hover:bg-surface/60">
            <X className="size-3.5" />
          </button>
        </span>
      )}

      {hasFilter && (
        <button type="button" onClick={onReset} className="text-[13px] font-medium text-gold-ink hover:underline">
          Đặt lại bộ lọc
        </button>
      )}
    </div>
  )
}

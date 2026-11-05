import { CalendarRange } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ClearFilters, FilterBar, SearchBox } from '@/features/adminShared/components/Filters'
import { StatusChips, type ChipItem } from '@/features/adminShared/components/StatusChips'
import { DateField } from '@/components/DateField'
import { controlClass } from '@/features/vendors/components/FormParts'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { OrderCounts, OrderListQuery } from '@/types/vendorOrder'
import { ORDER_STATUS } from '../constants'
import { CLOSED_STATUS, LISTED_STATUSES } from '../filters'

interface TabsProps {
  counts: OrderCounts | undefined
  /** Giá trị ?status= đang chọn (undefined = Tất cả) */
  value?: string
  onChange: (status?: string) => void
}

/** Chip trạng thái theo luồng đơn: Tất cả (trừ bản nháp) | Chờ cọc | Chờ chỉnh sửa | Đã cọc | Hoàn thành | Hết hạn / Hủy. */
const ALL = 'ALL'
const TABS: { key: string | undefined; label: string; tone: ChipItem<string>['tone']; of: (c: OrderCounts) => number }[] = [
  { key: undefined, label: 'Tất cả', tone: 'neutral', of: (c) => LISTED_STATUSES.reduce((s, k) => s + c[k], 0) },
  { key: 'Pending', label: ORDER_STATUS.Pending.label, tone: 'wait', of: (c) => c.Pending },
  { key: 'NeedRevision', label: ORDER_STATUS.NeedRevision.label, tone: 'warn', of: (c) => c.NeedRevision },
  { key: 'Deposited', label: ORDER_STATUS.Deposited.label, tone: 'info', of: (c) => c.Deposited },
  { key: 'Completed', label: ORDER_STATUS.Completed.label, tone: 'done', of: (c) => c.Completed },
  { key: CLOSED_STATUS, label: 'Hết hạn / Hủy', tone: 'neutral', of: (c) => c.Expired + c.Cancelled },
]

/** Lọc theo trạng thái, có chấm màu và số đếm; cùng kiểu với các trang quản lý của Admin. */
export function OrderStatusTabs({ counts, value, onChange }: TabsProps) {
  const items: ChipItem<string>[] = TABS.map((t) => ({ value: t.key ?? ALL, label: t.label, count: counts ? t.of(counts) : 0, tone: t.tone }))
  return <StatusChips items={items} value={value ?? ALL} onChange={(v) => onChange(v === ALL ? undefined : v)} label="Lọc theo trạng thái đơn" />
}

interface ToolbarProps {
  query: OrderListQuery
  onChange: (patch: Partial<OrderListQuery>) => void
  onReset: () => void
  hasFilter: boolean
}

/** Thanh lọc trên đầu bảng đơn (cùng kiểu trang Admin): ô tìm (mã đơn, tên khách, số điện thoại), khoảng ngày thực hiện, Xóa lọc. */
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
  const label = ranged ? `${query.from ? formatDate(query.from) : '…'} – ${query.to ? formatDate(query.to) : '…'}` : 'Ngày thực hiện'

  const pill = 'inline-flex h-10 items-center gap-2 rounded-[999px] border border-line-strong bg-surface px-4 text-[13.5px] text-muted-foreground transition-colors hover:text-ink'
  return (
    <FilterBar>
      <SearchBox value={text} onChange={setText} placeholder="Tìm mã đơn, tên khách, số điện thoại..." />

      <div ref={ref} className="relative">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn(pill, ranged && 'border-gold/45 bg-gold-soft text-gold-ink')}>
          <CalendarRange className="size-[17px]" />
          {label}
        </button>
        {open && (
          <div className="absolute top-[calc(100%+6px)] right-0 z-20 grid w-[280px] gap-3 rounded-lg border border-line bg-surface p-4 shadow-portal-lift max-sm:right-auto max-sm:left-0">
            <p className="text-[12.5px] text-muted-foreground">Lọc theo ngày thực hiện đơn</p>
            <label className="grid gap-1 text-[13px] font-medium">
              Từ ngày
              <DateField className={controlClass} clearable value={query.from ?? ''} max={query.to || undefined} onValueChange={(v) => onChange({ from: v || undefined })} />
            </label>
            <label className="grid gap-1 text-[13px] font-medium">
              Đến ngày
              <DateField className={controlClass} clearable value={query.to ?? ''} min={query.from || undefined} onValueChange={(v) => onChange({ to: v || undefined })} />
            </label>
            {ranged && (
              <button type="button" onClick={() => onChange({ from: undefined, to: undefined })} className="justify-self-start text-[13px] font-medium text-gold-ink hover:underline">
                Bỏ khoảng ngày
              </button>
            )}
          </div>
        )}
      </div>

      <ClearFilters show={hasFilter} onClick={onReset} />
    </FilterBar>
  )
}

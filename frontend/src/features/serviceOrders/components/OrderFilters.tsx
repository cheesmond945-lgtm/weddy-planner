import { CalendarDays, Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { controlClass } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderListQuery, type OrderPaymentStatus, type ServiceOrderStatus } from '@/types/serviceOrder'
import { ORDER_STATUS, PAYMENT_STATUS } from '../constants'

/** Dải đếm đơn theo trạng thái, bấm để lọc (status-strip trong prototype NCC). */
export function OrderStatusStrip({ counts, value, onChange }: { counts: Record<ServiceOrderStatus, number> | undefined; value?: ServiceOrderStatus; onChange: (s?: ServiceOrderStatus) => void }) {
  return (
    <div className="mb-4 grid grid-cols-5 gap-2.5 max-[900px]:grid-cols-3 max-sm:grid-cols-2">
      {ORDER_STATUSES.map((s) => {
        const on = value === s
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? undefined : s)}
            className={cn(
              'grid rounded-md border border-line bg-surface px-4 py-3 text-left shadow-portal transition hover:-translate-y-0.5 hover:border-gold/40',
              on && 'border-gold bg-gold-soft',
            )}
          >
            <b className="text-[22px] leading-tight font-semibold tabular-nums">{counts?.[s] ?? '–'}</b>
            <span className={cn('text-[12.5px] text-muted-foreground', on && 'text-gold-ink')}>{ORDER_STATUS[s].label}</span>
          </button>
        )
      })}
    </div>
  )
}

interface OrderFiltersProps {
  query: OrderListQuery
  onChange: (patch: Partial<OrderListQuery>) => void
  onReset: () => void
  hasFilter: boolean
}

/** Tìm mã đơn / tên khách / SĐT, lọc trạng thái đơn, thanh toán, khoảng ngày sự kiện. */
export function OrderFilters({ query, onChange, onReset, hasFilter }: OrderFiltersProps) {
  // Gõ tìm: đợi 300ms mới lọc để không gọi API theo từng phím
  const [text, setText] = useState(query.q ?? '')
  useEffect(() => setText(query.q ?? ''), [query.q])
  useEffect(() => {
    if (text === (query.q ?? '')) return
    const t = setTimeout(() => onChange({ q: text }), 300)
    return () => clearTimeout(t)
    // Chỉ chạy khi chữ gõ đổi; query.q, onChange đổi theo URL nên không đưa vào để tránh lọc lại
  }, [text])

  return (
    <div className="mb-[18px] flex flex-wrap items-center gap-2.5">
      <div className="flex h-10 min-w-[220px] flex-[1_1_260px] items-center rounded-sm border border-line-strong bg-surface focus-within:border-gold max-sm:basis-full">
        <Search className="ml-3 size-4 flex-none text-muted-foreground" />
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Tìm mã đơn, tên khách hoặc số điện thoại"
          aria-label="Tìm mã đơn, tên khách hoặc số điện thoại"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-[13.5px] outline-none"
        />
        {text && (
          <button type="button" aria-label="Xóa tìm kiếm" onClick={() => setText('')} className="mr-1 grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2">
            <X className="size-3.5" />
          </button>
        )}
      </div>
      <select
        aria-label="Trạng thái đơn"
        className={cn(controlClass, 'w-auto min-w-[170px] max-sm:flex-1')}
        value={query.status ?? ''}
        onChange={(e) => onChange({ status: (e.target.value || undefined) as ServiceOrderStatus | undefined })}
      >
        <option value="">Trạng thái đơn: Tất cả</option>
        {ORDER_STATUSES.map((s) => (
          <option key={s} value={s}>
            {ORDER_STATUS[s].label}
          </option>
        ))}
      </select>
      <select
        aria-label="Thanh toán"
        className={cn(controlClass, 'w-auto min-w-[170px] max-sm:flex-1')}
        value={query.paymentStatus ?? ''}
        onChange={(e) => onChange({ paymentStatus: (e.target.value || undefined) as OrderPaymentStatus | undefined })}
      >
        <option value="">Thanh toán: Tất cả</option>
        {PAYMENT_STATUSES.map((s) => (
          <option key={s} value={s}>
            {PAYMENT_STATUS[s].label}
          </option>
        ))}
      </select>
      <div className="flex h-10 max-w-full items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-2.5 text-[12.5px] focus-within:border-gold max-sm:w-full">
        <CalendarDays className="size-[15px] flex-none text-muted-foreground" />
        <span className="whitespace-nowrap text-muted-foreground max-sm:hidden">Ngày sự kiện</span>
        <input
          type="date"
          aria-label="Ngày sự kiện từ"
          value={query.from ?? ''}
          max={query.to || undefined}
          onChange={(e) => onChange({ from: e.target.value || undefined })}
          className="w-[124px] min-w-0 bg-transparent outline-none max-sm:flex-1"
        />
        <span className="text-muted-foreground">–</span>
        <input
          type="date"
          aria-label="Ngày sự kiện đến"
          value={query.to ?? ''}
          min={query.from || undefined}
          onChange={(e) => onChange({ to: e.target.value || undefined })}
          className="w-[124px] min-w-0 bg-transparent outline-none max-sm:flex-1"
        />
      </div>
      {hasFilter && (
        <button
          type="button"
          onClick={() => {
            setText('')
            onReset()
          }}
          className="py-1.5 text-[13px] font-medium text-gold-ink hover:underline"
        >
          Đặt lại
        </button>
      )}
    </div>
  )
}

import { CalendarHeart, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { DayStatus, PackageDayStatus } from '@/types/availability'
import { useServiceAvailability, useWeddingDate } from '../hooks'
import { DAY_STATUSES, STATUS_VIEW, WEEKDAYS, calendarCells, monthLabel, shiftMonth } from '../status'

/** Nhãn trạng thái: chấm màu + chữ. */
export function StatusBadge({ status, className }: { status: DayStatus; className?: string }) {
  const v = STATUS_VIEW[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset', v.chip, className)}>
      <span aria-hidden className={cn('size-1.5 rounded-full', v.dot)} />
      {v.label}
    </span>
  )
}

export function StatusLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-2', className)} aria-label="Chú thích màu">
      {DAY_STATUSES.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span aria-hidden className={cn('size-2.5 rounded-full', STATUS_VIEW[s].dot)} />
          {STATUS_VIEW[s].label}
        </li>
      ))}
    </ul>
  )
}

interface MonthCalendarProps {
  month: string
  onMonth: (month: string) => void
  /** Trạng thái theo ngày; thiếu ngày nào thì coi như Chưa cập nhật */
  statusOf: (date: string) => DayStatus | undefined
  /** Ghi chú nhỏ trong ô (phía NCC: gói cùng sảnh đang chặn) */
  noteOf?: (date: string) => string | null
  /** Ngày cưới của khách: biểu tượng trái tim */
  markDate?: string | null
  minMonth?: string
  maxMonth?: string
  loading?: boolean
  /** Ngày đang chọn (khách: ngày đang xem; NCC: các ngày sẽ cập nhật) */
  selected?: Set<string>
  onToggle?: (date: string) => void
  /** Ngày trước hôm nay: mờ, không chọn được */
  pastDisabled?: boolean
}

const NAV_BTN =
  'grid size-9 place-items-center rounded-md border border-line bg-surface text-ink transition-colors hover:border-ink-2 disabled:opacity-40 disabled:hover:border-line'

/**
 * Lịch tháng kiểu "Lịch làm việc" của cổng NCC: tiêu đề tháng + "Hôm nay" và hai mũi tên, lưới có viền (thứ hai đầu tuần),
 * ngày của tháng trước / sau tô xám, hôm nay viền xanh, mỗi ngày một nhãn trạng thái nhỏ có thanh màu bên trái.
 */
export function MonthCalendar({ month, onMonth, statusOf, noteOf, markDate, minMonth, maxMonth, loading, selected, onToggle, pastDisabled = true }: MonthCalendarProps) {
  const todayIso = toISODate(today())
  const thisMonth = todayIso.slice(0, 7)
  const cells = calendarCells(month)
  const canPrev = !minMonth || month > minMonth
  const canNext = !maxMonth || month < maxMonth

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <b className="font-serif text-xl font-semibold" aria-live="polite">
          {monthLabel(month)}
        </b>
        <div className="flex items-center gap-1.5">
          <button type="button" disabled={month === thisMonth} onClick={() => onMonth(thisMonth)} className={cn(NAV_BTN, 'w-auto px-3 text-sm font-medium')}>
            Hôm nay
          </button>
          <button type="button" aria-label="Tháng trước" disabled={!canPrev} onClick={() => onMonth(shiftMonth(month, -1))} className={NAV_BTN}>
            <ChevronLeft className="size-4" />
          </button>
          <button type="button" aria-label="Tháng sau" disabled={!canNext} onClick={() => onMonth(shiftMonth(month, 1))} className={NAV_BTN}>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div role="grid" aria-label={`Lịch khả dụng ${monthLabel(month)}`} aria-busy={loading || undefined} className="overflow-hidden rounded-lg border border-line bg-surface">
        <div role="row" className="grid grid-cols-7 border-b border-line bg-surface-2">
          {WEEKDAYS.map((w) => (
            <span key={w} role="columnheader" className="py-2 text-center text-xs font-semibold text-ink-2">
              {w}
            </span>
          ))}
        </div>
        <div className={cn('grid grid-cols-7', loading && 'animate-pulse')}>
          {cells.map(({ date, inMonth }, i) => {
            const day = Number(date.slice(8))
            const edge = cn('border-line', (i + 1) % 7 !== 0 && 'border-r', i < cells.length - 7 && 'border-b')
            if (!inMonth) {
              return (
                <span key={date} aria-hidden className={cn('min-h-[58px] bg-muted/60 p-1.5 text-[13px] text-ink-3', edge)}>
                  {day}
                </span>
              )
            }
            const status = loading ? undefined : (statusOf(date) ?? 'UNKNOWN')
            const past = pastDisabled && date < todayIso
            const isToday = date === todayIso
            const isWedding = date === markDate
            const isSelected = selected?.has(date)
            const note = noteOf?.(date)
            const label = `${formatDate(date)}: ${status ? STATUS_VIEW[status].label : 'đang tải'}${isWedding ? ', ngày cưới của bạn' : ''}${note ? `, ${note}` : ''}`
            const body = (
              <>
                <span className="flex items-center justify-between gap-1">
                  <span className={cn('grid size-6 place-items-center rounded-full text-[13px] font-semibold', isToday && 'bg-moss-700 text-white')}>{day}</span>
                  {isWedding && <CalendarHeart aria-hidden className="size-3.5 text-gold-700" />}
                </span>
                {status && !past && (
                  <span className={cn('mt-1 block truncate rounded-sm border-l-2 px-1 py-px text-[11px] leading-4 font-medium', STATUS_VIEW[status].pill)}>
                    {note ?? STATUS_VIEW[status].short}
                  </span>
                )}
              </>
            )
            const cls = cn(
              'relative min-h-[58px] p-1.5 text-left',
              edge,
              past && 'bg-muted/40 text-ink-3',
              isToday && 'outline-2 -outline-offset-2 outline-moss-700',
              isSelected && 'bg-gold-100/60 outline-2 -outline-offset-2 outline-gold-700',
            )
            return onToggle && !past ? (
              <button key={date} type="button" role="gridcell" aria-label={label} aria-selected={!!isSelected} onClick={() => onToggle(date)} className={cn(cls, 'transition-colors hover:bg-surface-2')}>
                {body}
              </button>
            ) : (
              <span key={date} role="gridcell" aria-label={label} className={cls}>
                {body}
              </span>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Thẻ dịch vụ của trung tâm tiệc cưới: ngày cưới của khách và trạng thái từng gói ngày đó. Không có ngày cưới / lỗi thì không hiện. */
export function ServiceCardAvailability({ serviceId }: { serviceId: string }) {
  const { date } = useWeddingDate()
  const { data, isPending, isError } = useServiceAvailability(serviceId, date)
  if (!date || isError) return null
  if (isPending) return <div aria-hidden className="h-[52px] animate-pulse rounded-md bg-muted" />
  if (!data?.length) return null
  return <PackageStatusList date={date} packages={data} max={3} />
}

/** Danh sách gói + trạng thái trong một ngày. */
export function PackageStatusList({ date, packages, max }: { date: string; packages: PackageDayStatus[]; max?: number }) {
  const shown = max ? packages.slice(0, max) : packages
  const more = packages.length - shown.length
  return (
    <div className="rounded-md border border-line bg-surface-2/60 px-3 py-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs text-ink-2">
        <CalendarHeart aria-hidden className="size-3.5 text-gold-700" />
        Ngày cưới của bạn: <b className="font-semibold text-ink">{formatDate(date)}</b>
      </p>
      <ul className="grid gap-1">
        {shown.map((p) => (
          <li key={p.packageId} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="min-w-0 truncate">{p.name}</span>
            <StatusBadge status={p.status} />
          </li>
        ))}
      </ul>
      {more > 0 && <p className="mt-1 text-xs text-ink-2">+{more} gói khác, xem trong chi tiết</p>}
    </div>
  )
}

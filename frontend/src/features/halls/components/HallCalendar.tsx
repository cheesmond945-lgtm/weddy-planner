import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { WEEKDAYS, gridRange, monthGrid, monthOf, monthTitle, shiftMonth } from '@/features/calendar/monthGrid'
import { formatDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { HallsFree } from '@/types/hall'
import { useHallDates, useHallsFree } from '../hooks'

/** Ngày cưới còn ở phía trước (hôm nay tính là còn), không thì bỏ qua. */
const upcoming = (date: string | null | undefined, now: string) => (date && date >= now ? date : null)

interface HallCalendarProps {
  packageId: string
  /** "YYYY-MM-DD" ngày cưới của khách (đã đăng nhập, đã thiết lập): đánh dấu, báo sảnh bận / trống ngày đó, mở lịch ở tháng đó */
  weddingDate?: string | null
  /** Ngày chính khách này đã đặt cọc sảnh (đơn Đã cọc / Hoàn thành của khách): hiện "Bạn đã đặt" thay vì "Bận" */
  mine?: readonly string[]
}

/**
 * Lịch của một sảnh trong khung chi tiết gói (Trung tâm tổ chức sự kiện, docs/LICH_BAN_SANH.md): hai trạng thái bận / còn trống theo ngày.
 * Bận = sảnh đã có tiệc đặt cọc hoặc nhà cung cấp báo bận; không hiện khách hay đơn nào. Giúp khách chọn ngày hoặc đổi sảnh trước khi nhắn.
 */
export function HallCalendar({ packageId, weddingDate, mine = [] }: HallCalendarProps) {
  const now = toISODate(today())
  const wedding = upcoming(weddingDate, now)
  const [month, setMonth] = useState(monthOf(wedding ?? now))
  const { from, to } = useMemo(() => gridRange(month), [month])
  const days = useMemo(() => monthGrid(month), [month])
  const q = useHallDates(packageId, from, to)
  const w = useHallDates(wedding ? packageId : null, wedding ?? '', wedding ?? '')
  const busy = useMemo(() => new Set(q.data?.dates ?? []), [q.data])
  const own = useMemo(() => new Set(mine), [mine])
  const weddingMine = !!wedding && own.has(wedding)
  const weddingBusy = !!wedding && !weddingMine && !!w.data?.dates.includes(wedding)

  return (
    <section aria-label="Lịch của sảnh" className="mt-5 rounded-xl border border-line bg-bg p-4">
      <h3 className="flex items-center gap-2 font-serif text-lg font-semibold">
        <CalendarDays className="size-5 text-gold-700" strokeWidth={1.75} aria-hidden />
        Lịch của sảnh
      </h3>

      {wedding ? (
        <p
          role="status"
          className={cn(
            'mt-2 rounded-lg px-3.5 py-2.5 text-sm font-medium',
            !weddingMine && w.isPending ? 'bg-surface-2 text-muted-foreground' : weddingBusy ? 'bg-warn-soft text-warn' : 'bg-sage-soft text-sage',
          )}
        >
          {weddingMine
            ? `Bạn đã đặt cọc sảnh này cho ngày cưới (${formatDate(wedding)}).`
            : w.isPending
              ? 'Đang kiểm tra ngày cưới của bạn…'
              : weddingBusy
                ? `Sảnh này bận vào ngày cưới của bạn (${formatDate(wedding)}). Chọn sảnh khác hoặc nhắn nhà cung cấp để đổi ngày.`
                : `Sảnh này còn trống vào ngày cưới của bạn (${formatDate(wedding)}).`}
        </p>
      ) : (
        <p className="mt-1 text-[13px] text-muted-foreground">Thiết lập ngày cưới ở Lập timeline để so sánh nhanh với lịch của sảnh.</p>
      )}

      <header className="mt-3 mb-2 flex items-center justify-between gap-2">
        <span className="font-serif text-base font-semibold" aria-live="polite">
          {monthTitle(month)}
        </span>
        <span className="flex items-center gap-1.5">
          {wedding && monthOf(wedding) !== month && (
            <Button variant="outline" size="sm" className="h-8 rounded-pill" onClick={() => setMonth(monthOf(wedding))}>
              Tháng cưới
            </Button>
          )}
          <Button variant="outline" size="icon" className="size-8" aria-label="Tháng trước" disabled={month <= monthOf(now)} onClick={() => setMonth(shiftMonth(month, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" aria-label="Tháng sau" onClick={() => setMonth(shiftMonth(month, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </span>
      </header>

      {q.isError ? (
        <p className="rounded-lg bg-warn-soft px-3.5 py-2.5 text-sm text-warn">
          Chưa tải được lịch của sảnh.{' '}
          <button type="button" className="font-semibold underline" onClick={() => q.refetch()}>
            Thử lại
          </button>
        </p>
      ) : (
        <div aria-busy={q.isFetching} className={cn('grid grid-cols-7 gap-1 transition-opacity', q.isPlaceholderData && 'opacity-60')}>
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-1 text-center text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
              {d}
            </div>
          ))}
          {days.map(({ date, inMonth }) => {
            const day = Number(date.slice(8))
            if (!inMonth) return <span key={date} aria-hidden />
            const past = date < now
            const isMine = !past && own.has(date)
            const isBusy = !past && !isMine && busy.has(date)
            const isWedding = date === wedding
            return (
              <span
                key={date}
                role="img"
                aria-label={`${day}/${date.slice(5, 7)}${isWedding ? ', ngày cưới của bạn' : ''}: ${past ? 'đã qua' : isMine ? 'bạn đã đặt sảnh' : isBusy ? 'sảnh bận' : 'còn trống'}`}
                className={cn(
                  'flex min-h-10 flex-col items-center justify-center rounded-md border text-[13px] font-semibold tabular-nums',
                  past ? 'border-transparent text-muted-foreground/50' : isMine ? 'border-sage/50 bg-sage-soft text-sage' : isBusy ? 'border-warn/40 bg-warn-soft text-warn' : 'border-line bg-surface',
                  isWedding && 'ring-2 ring-sage ring-offset-1 ring-offset-bg',
                  date === now && 'underline decoration-2 underline-offset-4',
                )}
              >
                {day}
                {isMine && <span className="text-[9.5px] leading-none font-bold uppercase">Của bạn</span>}
                {isBusy && <span className="text-[9.5px] leading-none font-bold uppercase">Bận</span>}
              </span>
            )
          })}
        </div>
      )}

      <ul aria-label="Chú giải" className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="size-3 rounded-[4px] border border-line bg-surface" />
          Còn trống
        </li>
        <li className="flex items-center gap-1.5">
          <i aria-hidden className="size-3 rounded-[4px] border border-warn/40 bg-warn-soft" />
          Bận
        </li>
        {mine.length > 0 && (
          <li className="flex items-center gap-1.5">
            <i aria-hidden className="size-3 rounded-[4px] border border-sage/50 bg-sage-soft" />
            Bạn đã đặt
          </li>
        )}
        {wedding && (
          <li className="flex items-center gap-1.5">
            <i aria-hidden className="size-3 rounded-[4px] ring-2 ring-sage" />
            Ngày cưới của bạn
          </li>
        )}
      </ul>
      <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
        Bận là ngày sảnh đã có tiệc đặt cọc hoặc nhà cung cấp báo bận. Ngày còn trống vẫn cần nhắn nhà cung cấp để giữ chỗ.
      </p>
    </section>
  )
}

const freeText = (f: HallsFree) => (f.free === 0 ? 'Tất cả sảnh đã bận' : f.free === f.halls ? `Còn trống cả ${f.halls} sảnh` : `Còn ${f.free}/${f.halls} sảnh trống`)

/**
 * Dòng ở khung giá trang chi tiết trung tâm sự kiện: số sảnh còn trống ngày cưới, và hướng dẫn xem lịch từng sảnh.
 * `bookedHall`: tên sảnh khách này đã đặt cọc ở đây cho ngày cưới (nếu có).
 */
export function HallsVerdict({ serviceId, weddingDate, bookedHall }: { serviceId: string; weddingDate?: string | null; bookedHall?: string | null }) {
  const wedding = upcoming(weddingDate, toISODate(today()))
  const q = useHallsFree(wedding, [serviceId])
  const f = q.data?.[serviceId]
  return (
    <div className="mb-2.5 flex items-start gap-3 rounded-xl bg-bg px-3.5 py-3">
      <CalendarDays className="mt-0.5 size-[18px] shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <small className="block text-xs text-muted-foreground">{wedding ? `Ngày cưới của bạn (${formatDate(wedding)})` : 'Lịch của sảnh'}</small>
        {wedding && bookedHall && <b className="block text-sm font-semibold text-sage">Bạn đã đặt cọc {bookedHall}</b>}
        {wedding && (
          <b className={cn('block font-semibold', bookedHall ? 'text-[13px] text-muted-foreground' : 'text-sm', !bookedHall && (f && f.free === 0 ? 'text-warn' : 'text-sage'))} aria-live="polite">
            {q.isPending ? 'Đang kiểm tra…' : f ? freeText(f) : 'Chưa có sảnh nào đang nhận tiệc'}
          </b>
        )}
        <span className="mt-0.5 block text-[12.5px] text-muted-foreground">Bấm vào từng sảnh ở mục Gói dịch vụ để xem ngày nào sảnh đã bận.</span>
      </div>
    </div>
  )
}

/** Nhãn ngày cưới trên thẻ trung tâm sự kiện ở danh sách dịch vụ. */
export function HallsFreeBadge({ free }: { free: HallsFree }) {
  return (
    <span title="Theo lịch bận của từng sảnh. Nhắn nhà cung cấp để giữ chỗ.">
      <Badge tone={free.free === 0 ? 'warn' : 'done'}>{free.free === 0 ? 'Hết sảnh ngày cưới' : `Còn ${free.free} sảnh trống ngày cưới`}</Badge>
    </span>
  )
}

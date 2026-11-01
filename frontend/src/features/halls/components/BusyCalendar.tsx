import { CalendarPlus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { CalendarMonth, dayHeading, type CalendarEvent } from '@/features/calendar/components/CalendarMonth'
import { gridRange, monthOf } from '@/features/calendar/monthGrid'
import { HUES } from '@/features/calendar/orderColors'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { formatDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { BusyDay, BusySource } from '@/types/hall'
import { useRemoveBusy, useVendorBusy } from '../hooks'
import { BusyDialog } from './BusyDialog'

type Manual = Extract<BusySource, { kind: 'MANUAL' }>

/** Ô ngày bận: đỏ đậm khi mọi sảnh đang xem đều bận, đỏ nhạt khi còn sảnh trống (pha với nền nên đúng cả chế độ tối). */
const DAY_FULL = 'bg-[color-mix(in_srgb,var(--warn)_24%,var(--surface))] text-warn hover:bg-[color-mix(in_srgb,var(--warn)_30%,var(--surface))]'
const DAY_PART = 'bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] text-warn hover:bg-[color-mix(in_srgb,var(--warn)_15%,var(--surface))]'
const SWATCH_FULL = 'bg-[color-mix(in_srgb,var(--warn)_24%,var(--surface))] border-warn/50'
const SWATCH_PART = 'bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] border-warn/30'

const dot = (hue: number | undefined) => ({ backgroundColor: hue === undefined ? undefined : `hsl(${hue} 60% 48%)` })
const range = (m: Manual) => (m.startDate === m.endDate ? formatDate(m.startDate) : `${formatDate(m.startDate)} – ${formatDate(m.endDate)}`)

/**
 * Tab "Lịch bận" ở Lịch làm việc của Trung tâm tổ chức sự kiện (docs/LICH_BAN_SANH.md): lịch tháng các ngày từng sảnh bận, ghi rõ nguồn
 * "Đơn" (đơn Đã cọc / Hoàn thành) hay "Thủ công" (NCC đánh dấu, gỡ được). Mỗi sảnh một màu; lọc theo sảnh; danh sách của ngày theo sảnh.
 */
export function BusyCalendar() {
  const now = toISODate(today())
  const [month, setMonth] = useState(monthOf(now))
  const [selected, setSelected] = useState(now)
  const [hall, setHall] = useState<string | null>(null)
  const [adding, setAdding] = useState<{ date: string; packageId: string | null } | null>(null)
  const [removing, setRemoving] = useState<(Manual & { hallName: string }) | null>(null)
  const remove = useRemoveBusy()
  const { from, to } = useMemo(() => gridRange(month), [month])
  const q = useVendorBusy(from, to)
  const dayRef = useRef<HTMLElement>(null)
  // Bấm một ngày: danh sách của ngày (nơi gỡ / đánh dấu bận) thường nằm dưới lịch, ngoài màn hình thì cuộn tới
  const pick = (date: string) => {
    setSelected(date)
    requestAnimationFrame(() => {
      const el = dayRef.current
      if (el && el.getBoundingClientRect().top > window.innerHeight - 160) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const halls = useMemo(() => q.data?.halls ?? [], [q.data])
  const hueOf = useMemo(() => new Map(halls.map((h, i) => [h.id, HUES[i % HUES.length]])), [halls])
  const nameOf = (id: string) => halls.find((h) => h.id === id)?.name ?? 'Sảnh'
  const items = useMemo(() => (q.data?.items ?? []).filter((i) => !hall || i.packageId === hall), [q.data, hall])
  const events = useMemo<CalendarEvent[]>(
    () =>
      items.map((i) => {
        const name = halls.find((h) => h.id === i.packageId)?.name ?? 'Sảnh'
        // Nguồn đứng đầu để ô hẹp vẫn đọc được "Đơn" / "Thủ công"; mã đơn, lý do ở danh sách của ngày
        const src = i.source.kind === 'ORDER' ? 'Đơn' : 'Thủ công'
        return {
          id: `${i.packageId}-${i.date}-${i.source.kind === 'ORDER' ? i.source.orderId : i.source.busyId}`,
          date: i.date,
          title: `${src} · ${name}`,
          tone: i.source.kind === 'ORDER' ? 'event' : 'todo',
          hue: hueOf.get(i.packageId),
          groupKey: i.packageId,
          groupLabel: name,
        }
      }),
    [items, halls, hueOf],
  )
  const ofDay = items.filter((i) => i.date === selected)
  const shownHalls = hall ? halls.filter((h) => h.id === hall) : halls
  // Số sảnh bận mỗi ngày (theo bộ lọc sảnh): tô đỏ ô ngày, đậm khi mọi sảnh đang xem đều bận
  const busyHalls = useMemo(() => {
    const map = new Map<string, Set<string>>()
    for (const i of items) map.set(i.date, (map.get(i.date) ?? new Set()).add(i.packageId))
    return map
  }, [items])
  const dayClassName = (date: string) => {
    const n = busyHalls.get(date)?.size ?? 0
    if (!n) return undefined
    return n >= shownHalls.length ? DAY_FULL : DAY_PART
  }
  const busyCount = new Set(ofDay.map((i) => i.packageId)).size
  const chip = (on: boolean) => cn('inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[13px] font-medium transition-colors', on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-ink')

  if (q.isError) return <EmptyState title="Chưa tải được lịch bận" description={q.error.message} action={<Button onClick={() => q.refetch()}>Thử lại</Button>} />
  if (q.data && !halls.length) {
    return <EmptyState title="Chưa có sảnh nào" description="Mỗi gói dịch vụ đang đăng là một sảnh. Đăng gói ở Quản lý gói dịch vụ để quản lý lịch bận của sảnh." />
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo sảnh">
        <button type="button" aria-pressed={!hall} className={chip(!hall)} onClick={() => setHall(null)}>
          Tất cả sảnh
        </button>
        {halls.map((h) => (
          <button key={h.id} type="button" aria-pressed={hall === h.id} className={chip(hall === h.id)} onClick={() => setHall(hall === h.id ? null : h.id)}>
            <i aria-hidden className="size-2.5 rounded-full" style={dot(hueOf.get(h.id))} />
            {h.name}
            {h.hidden && <span className={cn('text-[11.5px]', hall === h.id ? 'opacity-80' : 'text-muted-foreground')}>(ẩn)</span>}
          </button>
        ))}
        <Button size="sm" className="ml-auto rounded-pill" onClick={() => setAdding({ date: selected >= now ? selected : now, packageId: hall })} disabled={!halls.length}>
          <CalendarPlus />
          Đánh dấu bận
        </Button>
      </div>

      <div aria-busy={q.isFetching}>
        <CalendarMonth
          month={month}
          onMonthChange={setMonth}
          events={events}
          today={now}
          selected={selected}
          onSelect={pick}
          onToday={() => {
            setMonth(monthOf(now))
            setSelected(now)
          }}
          dayClassName={dayClassName}
          nouns={{ item: 'mục bận', group: 'sảnh' }}
          legend={
            <div className="mt-3 grid gap-1.5 text-[12px] leading-relaxed text-muted-foreground">
              <ul aria-label="Chú giải" className="flex flex-wrap gap-x-4 gap-y-1">
                <li className="flex items-center gap-1.5">
                  <i aria-hidden className={cn('size-3 rounded-[4px] border', SWATCH_FULL)} />
                  {hall ? 'Sảnh bận' : 'Mọi sảnh đều bận'}
                </li>
                {!hall && halls.length > 1 && (
                  <li className="flex items-center gap-1.5">
                    <i aria-hidden className={cn('size-3 rounded-[4px] border', SWATCH_PART)} />
                    Có sảnh bận, còn sảnh trống
                  </li>
                )}
              </ul>
              <p>
                Mỗi sảnh một màu. Ô bận ghi nguồn: <b className="font-semibold text-ink">Đơn</b> (đơn đã cọc hoặc hoàn thành, tự động) hoặc{' '}
                <b className="font-semibold text-ink">Thủ công</b> (bạn đánh dấu, gỡ được). Đơn chờ cọc chưa làm sảnh bận.
              </p>
              <p className="font-medium text-ink">Bấm vào một ngày để xem từng sảnh: gỡ ngày bận thủ công (nút "Gỡ bận") hoặc đánh dấu bận.</p>
            </div>
          }
        />
      </div>

      <section ref={dayRef} aria-label="Sảnh trong ngày" className="mt-5 scroll-mt-24">
        <h3 className="mb-3 flex flex-wrap items-baseline gap-2 font-serif text-xl leading-tight">
          {dayHeading(selected)}
          <span className="font-sans text-[13px] font-medium text-muted-foreground">
            {busyCount ? `${busyCount}/${shownHalls.length} sảnh bận` : 'Mọi sảnh còn trống'}
          </span>
        </h3>
        <ul className="grid gap-2">
          {shownHalls.map((h) => {
            const sources: BusyDay[] = ofDay.filter((i) => i.packageId === h.id)
            return (
              <li key={h.id} className="flex flex-wrap items-start gap-x-3 gap-y-2 rounded-md border border-line bg-surface px-3.5 py-2.5">
                <span className="flex min-w-[160px] items-center gap-2 pt-0.5 text-[14px] font-semibold">
                  <i aria-hidden className="size-3 shrink-0 rounded-full" style={dot(hueOf.get(h.id))} />
                  {h.name}
                </span>
                <div className="grid min-w-0 flex-1 gap-1.5">
                  {sources.length === 0 && (
                    <span className="flex flex-wrap items-center gap-2 text-[13.5px]">
                      <span className="font-medium text-sage">Trống</span>
                      {selected >= now && (
                        <Button variant="outline" size="sm" className="h-7 border-line-strong px-2.5 text-[12.5px]" onClick={() => setAdding({ date: selected, packageId: h.id })}>
                          Đánh dấu bận
                        </Button>
                      )}
                    </span>
                  )}
                  {sources.map(({ source: s }) =>
                    s.kind === 'ORDER' ? (
                      <span key={s.orderId} className="flex flex-wrap items-center gap-2 text-[13.5px]">
                        <span className="rounded-pill bg-gold-soft px-2 py-px text-[11.5px] font-bold text-gold-ink">Đơn</span>
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {s.orderCode} · {s.customerName}
                        </span>
                        <Link to={`${paths.vendor.orders}?order=${s.orderId}`} className="text-[12.5px] font-semibold text-gold-700 underline underline-offset-2">
                          Xem đơn
                        </Link>
                        <span className="basis-full text-[12px] text-muted-foreground">Bận theo đơn: hủy hoặc đổi ngày, đổi sảnh của đơn thì sảnh trống lại.</span>
                      </span>
                    ) : (
                      <span key={s.busyId} className="flex flex-wrap items-center gap-2 text-[13.5px]">
                        <span className="rounded-pill bg-surface-2 px-2 py-px text-[11.5px] font-bold">Thủ công</span>
                        <span className="min-w-0 [overflow-wrap:anywhere]">
                          {s.reason} <span className="text-muted-foreground">({range(s)})</span>
                        </span>
                        <Button variant="outline" size="sm" className="h-7 border-warn/50 px-2.5 text-[12.5px] font-semibold text-warn" onClick={() => setRemoving({ ...s, hallName: nameOf(h.id) })}>
                          Gỡ bận
                        </Button>
                      </span>
                    ),
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      {adding && <BusyDialog halls={halls} initial={adding} onClose={() => setAdding(null)} />}
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title="Gỡ ngày bận?"
        confirmLabel="Gỡ ngày bận"
        danger
        onConfirm={() => {
          if (removing) remove.mutate(removing.busyId)
          setRemoving(null)
        }}
      >
        {removing && (
          <p>
            Gỡ đánh dấu bận "{removing.reason}" của {removing.hallName} ({range(removing)})? Cả khoảng ngày của lần đánh dấu này sẽ trống lại, khách thấy ngay.
          </p>
        )}
      </ConfirmDialog>
    </>
  )
}

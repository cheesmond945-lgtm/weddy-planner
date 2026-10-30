import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WEEKDAYS, groupByDate, monthGrid, monthTitle, shiftMonth } from '../monthGrid'

/** todo: việc chưa xong; overdue: quá hạn; done: đã xong; event: ngày thực hiện của đơn / mốc quan trọng. */
export type CalendarTone = 'todo' | 'overdue' | 'done' | 'event'

export interface CalendarEvent {
  id: string
  /** "YYYY-MM-DD" */
  date: string
  title: string
  tone: CalendarTone
  /** Màu theo đơn / khách (hue 0 đến 360). Có thì thẻ tô màu đó; trạng thái hiện bằng dấu hiệu riêng (quá hạn: "!" và viền đỏ, đã xong: gạch ngang) */
  hue?: number
  /** Gom khi ô đông việc: các việc cùng `groupKey` thành một thẻ "{groupLabel} · n" */
  groupKey?: string
  groupLabel?: string
}

/** Thẻ tô theo hue, pha với nền và chữ của giao diện để đúng cả chế độ sáng và tối. */
const hueStyle = (hue: number, strong?: boolean): CSSProperties => ({
  backgroundColor: `color-mix(in srgb, hsl(${hue} 65% 50%) ${strong ? 30 : 18}%, var(--surface))`,
  color: `color-mix(in srgb, hsl(${hue} 60% 32%) 70%, var(--ink))`,
  boxShadow: `inset 3px 0 0 hsl(${hue} 60% 48%)`,
})
const hueDot = (hue: number): CSSProperties => ({ backgroundColor: `hsl(${hue} 60% 48%)` })

/** Dấu hiệu trạng thái khi thẻ đã có màu đơn: quá hạn viền đỏ, đã xong mờ và gạch ngang. */
const STATE: Partial<Record<CalendarTone, string>> = { overdue: 'ring-1 ring-warn', done: 'line-through opacity-60' }

interface CellGroup {
  key: string
  label: string
  hue?: number
  count: number
  overdue: number
}

/** Gom các việc của ngày theo `groupKey` (giữ thứ tự xuất hiện đầu tiên). */
function groupsOf(list: readonly CalendarEvent[]): CellGroup[] {
  const map = new Map<string, CellGroup>()
  for (const e of list) {
    const key = e.groupKey ?? e.id
    const g = map.get(key) ?? { key, label: e.groupLabel ?? e.title, hue: e.hue, count: 0, overdue: 0 }
    g.count++
    if (e.tone === 'overdue') g.overdue++
    map.set(key, g)
  }
  return [...map.values()]
}

const CHIP: Record<CalendarTone, string> = {
  todo: 'bg-surface-2 text-ink',
  overdue: 'bg-warn-soft text-warn font-semibold',
  done: 'text-muted-foreground line-through opacity-70',
  event: 'bg-gold-soft text-gold-ink font-semibold',
}
const DOT: Record<CalendarTone, string> = { todo: 'bg-ink/50', overdue: 'bg-warn', done: 'bg-sage/60', event: 'bg-gold' }
const MAX_CHIPS = 3

interface CalendarMonthProps {
  /** "YYYY-MM" */
  month: string
  onMonthChange: (month: string) => void
  events: readonly CalendarEvent[]
  /** "YYYY-MM-DD" của hôm nay */
  today: string
  selected: string | null
  onSelect: (date: string) => void
  /** Ngày được đánh dấu riêng (ví dụ ngày cưới) kèm nhãn ngắn */
  marks?: readonly { date: string; label: string }[]
  /** Việc làm khi bấm "Hôm nay" (mặc định: nhảy tới tháng của hôm nay và chọn hôm nay) */
  onToday?: () => void
}

/**
 * Lịch tháng kiểu Google Calendar, chỉ xem và chọn ngày (không kéo thả): đổi hạn, tick việc làm ở danh sách của ngày được chọn.
 * Màn rộng: mỗi ô hiện tối đa 3 việc dạng thẻ nhỏ và "+N việc"; màn hẹp: chấm màu theo trạng thái.
 */
export function CalendarMonth({ month, onMonthChange, events, today, selected, onSelect, marks = [], onToday }: CalendarMonthProps) {
  const days = useMemo(() => monthGrid(month), [month])
  const byDate = useMemo(() => groupByDate(events), [events])
  const markOf = useMemo(() => new Map(marks.map((m) => [m.date, m.label])), [marks])

  return (
    <section aria-label={monthTitle(month)} className="rounded-[22px] border border-line bg-surface p-3 shadow-card sm:p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-serif text-xl leading-tight" aria-live="polite">
          {monthTitle(month)}
        </h2>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="rounded-pill" onClick={onToday ?? (() => onMonthChange(today.slice(0, 7)))}>
            Hôm nay
          </Button>
          <Button variant="outline" size="icon" className="size-8" aria-label="Tháng trước" onClick={() => onMonthChange(shiftMonth(month, -1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon" className="size-8" aria-label="Tháng sau" onClick={() => onMonthChange(shiftMonth(month, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-surface-2 py-1.5 text-center text-[11.5px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {w}
          </div>
        ))}
        {days.map(({ date, inMonth }) => {
          const list = byDate.get(date) ?? []
          const isToday = date === today
          const isSelected = date === selected
          const mark = markOf.get(date)
          const day = Number(date.slice(8))
          return (
            <button
              key={date}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${day}/${date.slice(5, 7)}${mark ? `, ${mark}` : ''}: ${list.length ? `${list.length} việc` : 'không có việc'}`}
              onClick={() => onSelect(date)}
              className={cn(
                'flex min-h-[58px] flex-col items-stretch gap-1 bg-surface p-1 text-left transition-colors hover:bg-surface-2 focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-sage sm:min-h-[104px] sm:p-1.5',
                !inMonth && 'bg-surface-2/60 text-muted-foreground',
                isSelected && 'z-10 outline-2 -outline-offset-2 outline-sage',
              )}
            >
              <span className="flex items-center justify-between gap-1">
                <span className={cn('grid size-6 place-items-center rounded-full text-[12.5px] font-semibold tabular-nums', isToday && 'bg-sage text-white')}>{day}</span>
                {mark && <span className="rounded-pill bg-gold-soft px-1.5 py-px text-[10.5px] font-bold whitespace-nowrap text-gold-ink max-sm:hidden">{mark}</span>}
              </span>
              {mark && <span aria-hidden className="size-1.5 self-start rounded-full bg-gold sm:hidden" />}

              <span className="hidden flex-col gap-0.5 sm:flex">
                {list.length <= MAX_CHIPS || !list.some((e) => e.groupKey) ? (
                  <>
                    {list.slice(0, MAX_CHIPS).map((e) => (
                      <span
                        key={e.id}
                        title={e.title}
                        style={e.hue !== undefined ? hueStyle(e.hue, e.tone === 'event') : undefined}
                        className={cn('truncate rounded px-1.5 py-0.5 text-[11.5px] leading-tight', e.hue === undefined ? CHIP[e.tone] : cn(STATE[e.tone], e.tone === 'event' && 'font-semibold'))}
                      >
                        {e.tone === 'overdue' && e.hue !== undefined && <b aria-hidden>! </b>}
                        {e.title}
                      </span>
                    ))}
                    {list.length > MAX_CHIPS && <span className="px-1.5 text-[11.5px] font-medium text-muted-foreground">+{list.length - MAX_CHIPS} việc</span>}
                  </>
                ) : (
                  // Ô đông việc: một thẻ cho mỗi khách / đơn kèm số việc, thay cho một dãy thẻ chồng lên nhau
                  (() => {
                    const gs = groupsOf(list)
                    return (
                      <>
                        {gs.slice(0, MAX_CHIPS).map((g) => (
                          <span
                            key={g.key}
                            title={`${g.label}: ${g.count} việc${g.overdue ? `, ${g.overdue} quá hạn` : ''}`}
                            style={g.hue !== undefined ? hueStyle(g.hue) : undefined}
                            className={cn('truncate rounded px-1.5 py-0.5 text-[11.5px] leading-tight font-medium', g.overdue > 0 && 'ring-1 ring-warn')}
                          >
                            {g.overdue > 0 && <b aria-hidden>! </b>}
                            {g.label} · {g.count}
                          </span>
                        ))}
                        {gs.length > MAX_CHIPS && <span className="px-1.5 text-[11.5px] font-medium text-muted-foreground">+{gs.length - MAX_CHIPS} khách khác</span>}
                      </>
                    )
                  })()
                )}
              </span>
              {list.length > 0 && (
                <span aria-hidden className="flex flex-wrap gap-0.5 sm:hidden">
                  {list.slice(0, 4).map((e) => (
                    <i key={e.id} style={e.hue !== undefined ? hueDot(e.hue) : undefined} className={cn('size-1.5 rounded-full', e.hue === undefined && DOT[e.tone])} />
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <ul aria-label="Chú giải" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
        {(
          [
            ['todo', 'Chưa xong'],
            ['overdue', 'Quá hạn'],
            ['done', 'Đã xong'],
            ['event', 'Ngày thực hiện'],
          ] as const
        ).map(([tone, label]) => (
          <li key={tone} className="flex items-center gap-1.5">
            <i className={cn('size-2 rounded-full', DOT[tone])} />
            {label}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Thông tin ngắn cho tiêu đề phần danh sách của ngày được chọn: "Thứ Ba, 17/11/2026". */
export function dayHeading(date: string) {
  const d = new Date(`${date}T00:00:00Z`)
  const names = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
  return `${names[d.getUTCDay()]}, ${date.slice(8)}/${date.slice(5, 7)}/${date.slice(0, 4)}`
}

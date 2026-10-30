import { useMemo, useState, type ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { toISODate, today } from '@/lib/date'
import { CalendarMonth, dayHeading, type CalendarEvent, type CalendarTone } from '@/features/calendar/components/CalendarMonth'
import { monthOf } from '@/features/calendar/monthGrid'
import type { TimelineItem } from '@/types/wedding'

interface TimelineCalendarProps {
  /** Việc đã qua bộ lọc Chưa xong / Đã xong / Tất cả (cùng bộ lọc với hai cách xem kia) */
  items: readonly TimelineItem[]
  /** "YYYY-MM-DD" ngày cưới, đánh dấu trên lịch */
  weddingDate: string
  /** Vẽ một việc trong danh sách của ngày được chọn (dùng lại thẻ việc và các hộp thoại của trang) */
  renderCard: (item: TimelineItem) => ReactNode
}

/**
 * Cách xem LỊCH của timeline: lịch tháng, mỗi việc nằm ở ngày Hạn của nó. Bấm một ngày để xem các việc của ngày đó; hoàn thành, hẹn NCC, sửa
 * đều dùng đúng thẻ việc như cách xem danh sách. Không kéo thả (đổi hạn có luật khoảng ngày, xem docs/TIMELINE.md mục 7.4).
 */
export function TimelineCalendar({ items, weddingDate, renderCard }: TimelineCalendarProps) {
  const now = toISODate(today())
  const [month, setMonth] = useState(monthOf(now))
  const [selected, setSelected] = useState<string | null>(now)

  const dated = useMemo(() => items.filter((i) => i.dueDate), [items])
  const events: CalendarEvent[] = useMemo(
    () =>
      dated.map((i) => {
        const tone: CalendarTone = i.isDone ? 'done' : i.dueDate! < now ? 'overdue' : 'todo'
        return { id: i.id, date: i.dueDate!, title: i.title, tone }
      }),
    [dated, now],
  )
  const overdue = useMemo(() => dated.filter((i) => !i.isDone && i.dueDate! < now).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)), [dated, now])
  const ofDay = selected ? dated.filter((i) => i.dueDate === selected) : []

  const goToday = () => {
    setMonth(monthOf(now))
    setSelected(now)
  }
  // Tháng đang xem không có việc nào (thường sau khi tìm / lọc): chỉ tới việc gần nhất để khỏi thấy lịch trống
  const monthEmpty = dated.length > 0 && !events.some((e) => monthOf(e.date) === month)
  const nearest = monthEmpty ? ([...dated].sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)).find((i) => monthOf(i.dueDate!) >= month) ?? dated[dated.length - 1]) : null
  const goOverdue = () => {
    setMonth(monthOf(overdue[0].dueDate!))
    setSelected(overdue[0].dueDate!)
  }

  return (
    <div className="mt-5">
      {overdue.length > 0 && (
        <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warn bg-warn-soft px-4 py-2.5 text-sm text-warn">
          <span>
            <b className="font-semibold">{overdue.length} việc quá hạn</b>, sớm nhất hạn {overdue[0].dueDate!.split('-').reverse().join('/')}.
          </span>
          <Button variant="outline" size="sm" className="rounded-pill border-warn text-warn" onClick={goOverdue}>
            Xem việc quá hạn
          </Button>
        </div>
      )}

      {nearest && (
        <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-sm">
          <span>Tháng này không có việc nào. Việc gần nhất hạn {nearest.dueDate!.split('-').reverse().join('/')}.</span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-pill"
            onClick={() => {
              setMonth(monthOf(nearest.dueDate!))
              setSelected(nearest.dueDate!)
            }}
          >
            Tới tháng đó
          </Button>
        </div>
      )}

      <CalendarMonth
        month={month}
        onMonthChange={setMonth}
        events={events}
        today={now}
        selected={selected}
        onSelect={setSelected}
        marks={[{ date: weddingDate, label: 'Ngày cưới' }]}
        onToday={goToday}
      />

      <section aria-label="Việc trong ngày" className="mt-5">
        {selected ? (
          <>
            <h3 className="mb-3 flex items-baseline gap-2 font-serif text-xl leading-tight">
              {dayHeading(selected)}
              <span className="font-sans text-[13px] font-medium text-muted-foreground">{ofDay.length} việc</span>
            </h3>
            {selected === weddingDate && <p className="mb-3 rounded-lg bg-gold-soft px-4 py-2.5 text-sm font-medium text-gold-ink">Đây là ngày cưới của bạn.</p>}
            {ofDay.length ? <div className="flex flex-col gap-3.5">{ofDay.map((i) => renderCard(i))}</div> : <EmptyState title="Không có việc nào trong ngày này" />}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Bấm một ngày trên lịch để xem các việc của ngày đó.</p>
        )}
      </section>
    </div>
  )
}

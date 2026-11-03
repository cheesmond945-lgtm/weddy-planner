import { TASK_LABELS } from '@/lib/taskLabels'
import { AlertTriangle, Clock, Info } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { dayHeading } from '@/features/calendar/components/CalendarMonth'
import { clockOf, spanText } from '@/lib/dayTime'
import { cn } from '@/lib/utils'
import type { DaySchedule, DaySlot } from '@/types/wedding'
import { useDaySchedule } from '../hooks'

type Row = { kind: 'slot'; slot: DaySlot; at: string } | { kind: 'main'; at: string }

/** Các dòng theo thứ tự giờ: khung giờ của từng NCC và mốc giờ chính chen vào đúng chỗ; NCC chưa có giờ xuống cuối. */
function rowsOf(d: DaySchedule): Row[] {
  const timed: Row[] = d.slots.filter((s) => s.start).map((s) => ({ kind: 'slot', slot: s, at: s.start! }))
  if (d.mainTime && d.date) timed.push({ kind: 'main', at: `${d.date}T${d.mainTime}` })
  timed.sort((a, b) => a.at.localeCompare(b.at) || (a.kind === 'main' ? 1 : -1))
  return [...timed, ...d.slots.filter((s) => !s.start).map((s): Row => ({ kind: 'slot', slot: s, at: '' }))]
}

/**
 * "Lịch trình ngày cưới" trên timeline của khách (docs/LICH_TRINH_NGAY_CUOI.md): giờ có mặt của từng NCC làm đúng ngày cưới, theo giờ đón khách.
 * NCC đã chốt thì ghi "Đã chốt", chưa thì là giờ dự kiến; cảnh báo khi vào sảnh trước giờ sảnh mở hoặc xong sau giờ đón khách.
 * Chưa có NCC nào làm đúng ngày cưới (đã cọc) thì không hiện.
 */
export function WeddingDaySchedule({ onEditWedding }: { onEditWedding: () => void }) {
  const q = useDaySchedule(true)
  const [open, setOpen] = useState(true)
  const d = q.data
  if (!d?.date || !d.slots.length) return null
  const day = d.date
  const warns = d.slots.reduce((n, s) => n + s.issues.filter((i) => i.level === 'warn').length, 0)

  return (
    <section aria-label="Lịch trình ngày cưới" className="mb-4 rounded-lg border border-line bg-surface px-5 py-4 shadow-card max-sm:px-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2 font-sans text-base font-semibold tracking-normal">
          <Clock className="size-4 text-gold-ink" aria-hidden />
          Lịch trình ngày cưới
        </h2>
        <span className="text-[13px] text-muted-foreground">{dayHeading(day)}</span>
        {warns > 0 && <Badge tone="warn">{warns} cảnh báo</Badge>}
        <span className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="border-line-strong" onClick={onEditWedding}>
            {d.mainTime ? `Đón khách ${d.mainTime} · Sửa` : 'Thêm giờ đón khách'}
          </Button>
          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? 'Thu gọn' : 'Mở'}
          </Button>
        </span>
      </div>

      {open && (
        <>
          {!d.mainTime && (
            <p role="status" className="mt-3 rounded-md bg-gold-100 px-3.5 py-2.5 text-[13px] text-gold-800">
              Nhập giờ đón khách / làm lễ để hệ thống xếp giờ có mặt cho {d.slots.length} nhà cung cấp làm trong ngày cưới.
            </p>
          )}
          {d.venue && (
            <p className="mt-3 text-[13px] text-muted-foreground">
              {d.venue.hallName ? `${d.venue.hallName} (${d.venue.name})` : d.venue.name} cho trang trí, hoa… vào setup từ <b className="font-semibold text-ink">{d.venue.openAt}</b>
              {d.venue.openIsDefault && ' (giờ mặc định)'}
              {d.venue.prevDayBusy === true && ' · hôm trước sảnh có tiệc khác nên không vào sớm hơn được'}
              {d.venue.prevDayBusy === false && ' · hôm trước sảnh trống'}.
            </p>
          )}
          <ol className="mt-3 grid gap-1.5">
            {rowsOf(d).map((r) =>
              r.kind === 'main' ? (
                <li key="main" className="flex items-center gap-3 rounded-md bg-gold-soft px-3 py-2 text-[13.5px] font-semibold text-gold-ink">
                  <span className="w-[132px] shrink-0 tabular-nums max-sm:w-[104px]">{clockOf(r.at)}</span>
                  Đón khách / làm lễ
                </li>
              ) : (
                <li key={r.slot.orderId} className={cn('flex gap-3 rounded-md border px-3 py-2', r.slot.issues.some((i) => i.level === 'warn') ? 'border-warn/50' : 'border-line')}>
                  <span className="w-[132px] shrink-0 pt-px text-[13.5px] font-semibold tabular-nums max-sm:w-[104px]">
                    {r.slot.start && r.slot.end ? spanText(r.slot.start, r.slot.end, day) : <span className="font-normal text-muted-foreground">Chưa có giờ</span>}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-[13.5px] font-medium [overflow-wrap:anywhere]">{r.slot.vendorName}</span>
                      <span className="text-[12.5px] text-muted-foreground">{r.slot.categoryName}</span>
                      {r.slot.start && <Badge tone={r.slot.source === 'CONFIRMED' ? 'done' : 'neutral'}>{r.slot.source === 'CONFIRMED' ? TASK_LABELS.slotConfirmed : TASK_LABELS.slotPlanned}</Badge>}
                    </span>
                    {r.slot.issues.length > 0 && (
                      <ul className="mt-1 grid gap-0.5">
                        {r.slot.issues.map((i) => (
                          <li key={i.code} className={cn('flex items-start gap-1.5 text-[12.5px] font-medium', i.level === 'warn' ? 'text-warn' : 'text-gold-ink')}>
                            {i.level === 'warn' ? <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> : <Info className="mt-px size-3.5 shrink-0" aria-hidden />}
                            {i.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </span>
                </li>
              ),
            )}
          </ol>
          <p className="mt-2.5 text-[12.5px] text-muted-foreground">Giờ dự kiến tính từ giờ đón khách và thời gian mỗi nhà cung cấp cần; nhà cung cấp xác nhận giờ thì hiện "Giờ đã xác nhận" và bạn được báo.</p>
        </>
      )}
    </section>
  )
}

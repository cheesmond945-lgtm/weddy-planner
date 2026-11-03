import { TASK_LABELS } from '@/lib/taskLabels'
import { AlertTriangle, Info } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { Badge } from '@/components/Badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { dayHeading } from '@/features/calendar/components/CalendarMonth'
import { controlClass } from '@/features/vendors/components/FormParts'
import { TimeCombobox } from '@/features/vendors/components/TimeCombobox'
import { formatDate } from '@/lib/date'
import { clockOf, dayOfLocal, spanText } from '@/lib/dayTime'
import { cn } from '@/lib/utils'
import type { DaySlotIssue } from '@/types/wedding'
import { useDaySlot, useSetDaySlot } from '../hooks'

const prevDay = (ymd: string) => new Date(Date.parse(`${ymd}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10)
const HM = /^([01]\d|2[0-3]):[0-5]\d$/

const SOURCE: Record<'CONFIRMED' | 'PACKAGE' | 'DEFAULT', { label: string; tone: 'done' | 'info' | 'neutral' }> = {
  CONFIRMED: { label: TASK_LABELS.slotConfirmed, tone: 'done' },
  PACKAGE: { label: `${TASK_LABELS.slotPlanned} theo gói`, tone: 'info' },
  DEFAULT: { label: `${TASK_LABELS.slotPlanned} theo lĩnh vực`, tone: 'neutral' },
}

export function IssueList({ issues }: { issues: readonly DaySlotIssue[] }) {
  if (!issues.length) return null
  return (
    <ul className="mt-1.5 grid gap-1">
      {issues.map((i) => (
        <li key={i.code} className={cn('flex items-start gap-1.5 text-[12.5px] font-medium', i.level === 'warn' ? 'text-warn' : 'text-gold-ink')}>
          {i.level === 'warn' ? <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden /> : <Info className="mt-px size-3.5 shrink-0" aria-hidden />}
          {i.message}
        </li>
      ))}
    </ul>
  )
}

/** Hộp chốt / đổi giờ có mặt: giờ có mặt (ngày cưới hoặc tối hôm trước) và giờ xong. */
function DaySlotDialog({ target, busy, onClose, onSave }: { target: { date: string; start: string; end: string } | null; busy: boolean; onClose: () => void; onSave: (v: { start: string; end: string }) => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Giờ có mặt ngày cưới</DialogTitle>
          <DialogDescription>{target && `Ngày cưới ${dayHeading(target.date)}. Khách được báo giờ bạn chốt.`}</DialogDescription>
        </DialogHeader>
        {target && <SlotForm key={target.start + target.end} target={target} busy={busy} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}

function SlotForm({ target, busy, onClose, onSave }: { target: { date: string; start: string; end: string }; busy: boolean; onClose: () => void; onSave: (v: { start: string; end: string }) => void }) {
  const before = prevDay(target.date)
  const [startDay, setStartDay] = useState(dayOfLocal(target.start))
  const [startTime, setStartTime] = useState(clockOf(target.start))
  const [endDay, setEndDay] = useState(dayOfLocal(target.end))
  const [endTime, setEndTime] = useState(clockOf(target.end))
  const [error, setError] = useState<string | null>(null)

  const dayOptions = [
    { value: target.date, label: `Ngày cưới (${formatDate(target.date)})` },
    { value: before, label: `Hôm trước (${formatDate(before)})` },
  ]

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!HM.test(startTime) || !HM.test(endTime)) return setError('Nhập giờ dạng HH:mm, ví dụ 05:30.')
    const start = `${startDay}T${startTime}`
    const end = `${endDay}T${endTime}`
    if (end <= start) return setError('Giờ xong phải sau giờ có mặt.')
    onSave({ start, end })
  }

  const row = (label: string, day: string, setDay: (v: string) => void, time: string, setTime: (v: string) => void) => (
    <fieldset className="grid grid-cols-[1fr_120px] items-end gap-2.5">
      <legend className="mb-1.5 text-[13px] font-medium">{label}</legend>
      <select aria-label={`${label}: ngày`} className={controlClass} value={day} onChange={(e) => setDay(e.target.value)}>
        {dayOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <TimeCombobox
        label={`${label}: giờ`}
        value={time}
        onChange={(v) => {
          setTime(v)
          setError(null)
        }}
      />
    </fieldset>
  )

  return (
    <form onSubmit={submit} noValidate className="grid gap-4 [&_label]:sr-only">
      {row('Có mặt', startDay, setStartDay, startTime, setStartTime)}
      {row('Xong việc', endDay, setEndDay, endTime, setEndTime)}
      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? 'Đang lưu…' : TASK_LABELS.confirmSlot}
        </Button>
      </DialogFooter>
    </form>
  )
}

/**
 * "Giờ có mặt ngày cưới" trong chi tiết đơn của NCC (docs/LICH_TRINH_NGAY_CUOI.md): giờ chính của khách, khung giờ của đơn (đã chốt hoặc
 * dự kiến theo gói / lĩnh vực), giờ sảnh cho vào setup, cảnh báo thiếu giờ, và giờ của các đơn vị khác trong ngày (chỉ lĩnh vực).
 * Đơn không làm đúng ngày cưới hoặc chưa cọc: không hiện gì (kể cả khung `frame` bọc ngoài, vd mục có tiêu đề).
 */
export function OrderDaySlotPanel({ orderId, frame = (c) => c }: { orderId: string; frame?: (content: ReactNode) => ReactNode }) {
  const q = useDaySlot(orderId)
  const set = useSetDaySlot(orderId)
  const [editing, setEditing] = useState<{ date: string; start: string; end: string } | null>(null)
  const d = q.data
  if (!d?.applicable) return null

  const s = d.slot
  const src = SOURCE[s.source]
  const hasTimes = !!s.start && !!s.end
  const open = () => {
    const base = hasTimes ? { start: s.start!, end: s.end! } : (d.planned ?? { start: `${d.date}T08:00`, end: `${d.date}T10:00` })
    setEditing({ date: d.date, ...base })
  }

  return frame(
    <div className="grid gap-3 text-[13.5px]">
      <p className="text-muted-foreground">
        Ngày cưới <b className="font-semibold text-ink">{dayHeading(d.date)}</b> ·{' '}
        {d.mainTime ? (
          <>
            khách đón khách / làm lễ lúc <b className="font-semibold text-ink">{d.mainTime}</b>
          </>
        ) : (
          'khách chưa nhập giờ đón khách nên chưa có giờ dự kiến'
        )}
      </p>

      <div className="rounded-md border border-line bg-surface-2/50 px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[17px] font-semibold tabular-nums">{hasTimes ? spanText(s.start!, s.end!, d.date) : 'Chưa có giờ'}</span>
          {hasTimes && <Badge tone={src.tone}>{src.label}</Badge>}
        </div>
        {s.source === 'CONFIRMED' && d.planned && (d.planned.start !== s.start || d.planned.end !== s.end) && (
          <p className="mt-1 text-[12.5px] text-muted-foreground">Dự kiến theo giờ khách hiện tại: {spanText(d.planned.start, d.planned.end, d.date)}</p>
        )}
        <IssueList issues={s.issues} />
        {d.canEdit && (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {s.source !== 'CONFIRMED' && hasTimes && (
              <Button size="sm" disabled={set.isPending} onClick={() => set.mutate({ start: s.start!, end: s.end! })}>
                Xác nhận giờ này
              </Button>
            )}
            <Button size="sm" variant="outline" className="border-line-strong" disabled={set.isPending} onClick={open}>
              {hasTimes ? 'Đổi giờ…' : 'Chọn giờ…'}
            </Button>
            {s.source === 'CONFIRMED' && (
              <Button size="sm" variant="ghost" disabled={set.isPending} onClick={() => set.mutate(null)}>
                {TASK_LABELS.unconfirmSlot}
              </Button>
            )}
          </div>
        )}
      </div>

      {d.venue && !s.isVenue && (
        <p className="text-[12.5px] text-muted-foreground">
          {d.venue.hallName ? `${d.venue.hallName} (${d.venue.name})` : `Sảnh ${d.venue.name}`} cho đơn vị khác vào setup từ <b className="font-semibold text-ink">{d.venue.openAt}</b>
          {d.venue.openIsDefault && ' (giờ mặc định, sảnh chưa khai)'}
          {d.venue.prevDayBusy === true && ' · hôm trước sảnh có tiệc khác'}
          {d.venue.prevDayBusy === false && ' · hôm trước sảnh trống'}.
        </p>
      )}

      {d.others.length > 0 && (
        <div>
          <p className="mb-1 text-[12.5px] font-semibold text-muted-foreground">Các đơn vị khác trong ngày</p>
          <ul className="grid gap-0.5 text-[12.5px]">
            {d.others.map((o, i) => (
              <li key={i} className="flex flex-wrap gap-x-2">
                <span className="w-[120px] font-medium tabular-nums">{o.start && o.end ? spanText(o.start, o.end, d.date) : 'chưa có giờ'}</span>
                <span>
                  {o.categoryName}
                  {o.isVenue && ' (sảnh)'}
                </span>
                <span className="text-muted-foreground">{o.confirmed ? 'đã xác nhận' : 'dự kiến'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <DaySlotDialog target={editing} busy={set.isPending} onClose={() => setEditing(null)} onSave={(v) => set.mutate(v, { onSuccess: () => setEditing(null) })} />
    </div>,
  )
}

import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { controlClass } from '@/features/vendors/components/FormParts'
import { addDays, formatDate, parseDate, toISODate, today } from '@/lib/date'
import { SCHEDULE_MAX_AFTER_EVENT } from '../taskBoard'

export interface TaskDateTarget {
  title: string
  /** Hạn hiện tại "YYYY-MM-DD" */
  dueDate: string
  /** Ngày thực hiện của đơn "YYYY-MM-DD" (giới hạn trên = ngày này + 120) */
  eventDate: string
}

/** "Đổi ngày…": chọn ngày mới cho một việc, từ hôm nay đến ngày thực hiện + 120. Lưu qua PATCH …/schedule { date } (đồng thời chốt ngày). */
export function TaskDateDialog({ target, busy, onClose, onPick }: { target: TaskDateTarget | null; busy?: boolean; onClose: () => void; onPick: (date: string) => void }) {
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Đổi ngày</DialogTitle>
          <DialogDescription>{target?.title}</DialogDescription>
        </DialogHeader>
        {target && <Form key={target.title + target.dueDate} target={target} busy={busy} onClose={onClose} onPick={onPick} />}
      </DialogContent>
    </Dialog>
  )
}

function Form({ target, busy, onClose, onPick }: { target: TaskDateTarget; busy?: boolean; onClose: () => void; onPick: (date: string) => void }) {
  const min = toISODate(today())
  const max = target.eventDate ? toISODate(addDays(parseDate(target.eventDate), SCHEDULE_MAX_AFTER_EVENT)) : undefined
  const [date, setDate] = useState(target.dueDate < min ? min : target.dueDate)
  const bad = !date || date < min || (!!max && date > max)

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!bad) onPick(date)
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-3">
      <label className="grid gap-1.5 text-[13px] font-medium">
        Ngày mới
        <input type="date" className={controlClass} min={min} max={max} value={date} onChange={(e) => setDate(e.target.value)} aria-invalid={bad ? true : undefined} autoFocus />
      </label>
      <p className={bad ? 'text-[13px] text-destructive' : 'text-[13px] text-muted-foreground'}>
        {bad ? `Chọn ngày từ hôm nay${max ? ` đến ${formatDate(max)}` : ''}.` : `Chọn từ hôm nay${max ? ` đến ${formatDate(max)}` : ''} (ngày thực hiện + ${SCHEDULE_MAX_AFTER_EVENT}). Khách được báo ngày đã chốt.`}
      </p>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={bad || busy}>
          {busy ? 'Đang lưu…' : 'Lưu ngày'}
        </Button>
      </DialogFooter>
    </form>
  )
}

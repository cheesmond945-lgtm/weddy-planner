import { CalendarDays } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { controlClass, Field } from '@/features/vendors/components/FormParts'
import { OwnerPicker } from '@/features/vendorPackages/components/TaskDialog'
import { addDays, formatDate, parseDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { OrderTask, TaskOwner } from '@/types/vendorOrder'
import { useOrderTaskEdits } from '../taskActions'
import { SCHEDULE_MAX_AFTER_EVENT } from '../taskBoard'
import { splitTitle } from '../taskTitle'
import { DatePickPopover } from './DatePickPopover'

export const ORDER_TASK_TITLE_MAX = 200
export const ORDER_TASK_NOTE_MAX = 500

interface OrderTaskDialogProps {
  open: boolean
  orderId: string
  /** Ngày thực hiện của đơn "YYYY-MM-DD" (giới hạn ngày của việc: hôm nay đến ngày này + 120) */
  eventDate: string
  /** Đơn có gói: hiện "Thêm vào quy trình của gói cho các đơn sau" (chỉ khi thêm mới) */
  hasPackage?: boolean
  /** Có là sửa việc riêng; không có là thêm mới */
  task?: OrderTask
  onClose: () => void
}

/**
 * Thêm / sửa MỘT việc riêng của đơn đã cọc (dùng lại bố cục và ô "Ai phụ trách" của hộp việc của gói). Ngày chọn bằng lịch dựng sẵn; việc thêm
 * xong được chốt ngày luôn. Lưu là đóng hộp ngay, danh sách đổi ngay (cập nhật lạc quan), lỗi thì báo và trả lại.
 */
export function OrderTaskDialog({ open, orderId, eventDate, hasPackage, task, onClose }: OrderTaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{task ? 'Sửa việc' : 'Thêm việc cho đơn này'}</DialogTitle>
          <DialogDescription>{task ? 'Chỉ đổi việc của đơn này.' : 'Việc này chỉ thuộc đơn này, không đổi gói dịch vụ và các đơn khác. Khách sẽ thấy trên timeline.'}</DialogDescription>
        </DialogHeader>
        {open && <OrderTaskForm key={task?.id ?? 'new'} orderId={orderId} eventDate={eventDate} hasPackage={hasPackage} task={task} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

/** Ngày gợi ý ban đầu: ngày thực hiện của đơn nếu chưa qua, ngược lại hôm nay. */
const defaultDate = (eventDate: string) => {
  const now = toISODate(today())
  return eventDate && eventDate >= now ? eventDate : now
}

function OrderTaskForm({ orderId, eventDate, hasPackage, task, onClose }: Omit<OrderTaskDialogProps, 'open'>) {
  const { add, edit } = useOrderTaskEdits()
  // Tiêu đề lưu dạng "tên — ghi chú": mở Sửa thì tách lại đúng tên và ghi chú, lưu thì ghép lại
  const initial = splitTitle(task?.title ?? '')
  const [title, setTitle] = useState(initial.title)
  const [note, setNote] = useState(initial.note ?? '')
  const [owner, setOwner] = useState<TaskOwner>(task?.owner ?? 'VENDOR')
  const [date, setDate] = useState(() => defaultDate(eventDate))
  const [pickDate, setPickDate] = useState(false)
  const [toPackage, setToPackage] = useState(false)
  const [errors, setErrors] = useState<{ title?: string; note?: string; date?: string }>({})
  const dateBtn = useRef<HTMLButtonElement>(null)

  const maxDate = eventDate ? toISODate(addDays(parseDate(eventDate), SCHEDULE_MAX_AFTER_EVENT)) : undefined

  function submit(e: FormEvent) {
    e.preventDefault()
    e.stopPropagation()
    const er: typeof errors = {}
    if (!title.trim()) er.title = 'Nhập tên việc.'
    else if (title.trim().length > ORDER_TASK_TITLE_MAX) er.title = `Tên việc tối đa ${ORDER_TASK_TITLE_MAX} ký tự.`
    if (note.trim().length > ORDER_TASK_NOTE_MAX) er.note = `Ghi chú tối đa ${ORDER_TASK_NOTE_MAX} ký tự.`
    if (!task && (date < toISODate(today()) || (maxDate && date > maxDate))) er.date = 'Chọn ngày từ hôm nay đến tối đa 120 ngày sau ngày thực hiện.'
    if (Object.keys(er).length) return setErrors(er)
    const fields = { title: title.trim(), note: note.trim() || null, owner }
    // Đóng hộp ngay; danh sách đã đổi (lạc quan), API chạy nền
    if (task) void edit(orderId, task, fields)
    else void add(orderId, { ...fields, date, addToPackage: toPackage })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Tên việc *" error={errors.title} hint={`${title.length}/${ORDER_TASK_TITLE_MAX} ký tự`}>
        <textarea
          rows={2}
          autoFocus
          aria-invalid={errors.title ? true : undefined}
          placeholder="Ví dụ: Gửi bản thử màu hoa cho khách"
          className={cn(controlClass, 'h-auto min-h-[64px] resize-y py-2.5 leading-relaxed')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <OwnerPicker value={owner} onChange={setOwner} />

      {!task && (
        <fieldset className="grid gap-1.5">
          <legend className="mb-1.5 text-[13px] font-medium">Ngày thực hiện *</legend>
          <div>
            <button
              ref={dateBtn}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={pickDate}
              onClick={() => setPickDate((o) => !o)}
              className={cn(controlClass, 'inline-flex w-auto min-w-[180px] items-center gap-2 text-left', errors.date && 'border-destructive')}
            >
              <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
              {formatDate(date)}
            </button>
            {pickDate && (
              <DatePickPopover
                anchor={dateBtn}
                value={date}
                eventDate={eventDate}
                confirmStep={false}
                onClose={() => setPickDate(false)}
                onPick={(d) => {
                  setDate(d)
                  setPickDate(false)
                  setErrors((er) => ({ ...er, date: undefined }))
                }}
              />
            )}
          </div>
          {errors.date ? (
            <span role="alert" data-field-error className="text-[13px] text-destructive">
              {errors.date}
            </span>
          ) : (
            <span className="text-[13px] text-muted-foreground">Việc được chốt ngày này với khách ngay khi thêm.</span>
          )}
        </fieldset>
      )}

      <Field label="Ghi chú cho người làm (không bắt buộc)" error={errors.note} hint={`${note.length}/${ORDER_TASK_NOTE_MAX} ký tự`}>
        <textarea
          rows={2}
          aria-invalid={errors.note ? true : undefined}
          placeholder="Ví dụ: gửi ảnh rõ nét, định dạng JPG hoặc PNG"
          className={cn(controlClass, 'h-auto min-h-[64px] resize-y py-2.5 leading-relaxed')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      {!task && hasPackage && (
        <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px]">
          <input type="checkbox" checked={toPackage} onChange={(e) => setToPackage(e.target.checked)} className="mt-0.5 size-4 accent-[var(--gold)]" />
          <span>
            Thêm vào quy trình của gói cho các đơn sau
            <span className="block text-[12.5px] text-muted-foreground">Chỉ áp cho đơn đặt sau này, các đơn đang chạy không đổi.</span>
          </span>
        </label>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit">{task ? 'Lưu' : 'Thêm việc'}</Button>
      </DialogFooter>
    </form>
  )
}

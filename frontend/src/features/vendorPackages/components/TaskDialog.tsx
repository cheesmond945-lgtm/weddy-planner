import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { controlClass, Field } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import type { PackageTaskOwner } from '@/types/vendorPackage'
import { MAX_AFTER, MAX_BEFORE, MAX_NOTE, MAX_TITLE, newKey, offsetKindOf, validateTask, type OffsetKind, type TaskDraft } from '../packageTasks'

const OWNER_CHOICES: { value: PackageTaskOwner; title: string; hint: string }[] = [
  { value: 'VENDOR', title: 'Nhà cung cấp', hint: 'Bạn làm' },
  { value: 'CUSTOMER', title: 'Khách hàng', hint: 'Khách làm' },
  { value: 'BOTH', title: 'Cả hai', hint: 'Làm cùng nhau' },
]
const KIND_CHOICES: { value: OffsetKind; label: string }[] = [
  { value: 'before', label: 'Trước ngày thực hiện' },
  { value: 'on', label: 'Đúng ngày thực hiện' },
  { value: 'after', label: 'Sau ngày thực hiện' },
]

interface TaskDialogProps {
  open: boolean
  /** Không có là thêm mới */
  task?: TaskDraft
  onClose: () => void
  /** Chỉ cập nhật danh sách trên màn, chưa gọi API */
  onSave: (task: TaskDraft) => void
}

/** Thêm / sửa một công việc của gói. Lưu ở đây chỉ đổi danh sách trên màn; xuống CSDL khi bấm lưu ở thanh dưới. */
export function TaskDialog({ open, task, onClose, onSave }: TaskDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{task ? 'Sửa công việc' : 'Thêm công việc'}</DialogTitle>
          <DialogDescription>Khách sẽ thấy công việc này trong timeline sau khi đặt cọc.</DialogDescription>
        </DialogHeader>
        {open && <TaskForm key={task?.key ?? 'new'} task={task} onClose={onClose} onSave={onSave} />}
      </DialogContent>
    </Dialog>
  )
}

function TaskForm({ task, onClose, onSave }: Omit<TaskDialogProps, 'open'>) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [note, setNote] = useState(task?.note ?? '')
  const [owner, setOwner] = useState<PackageTaskOwner>(task?.owner ?? 'VENDOR')
  const [kind, setKind] = useState<OffsetKind>(task ? offsetKindOf(task.offsetDays) : 'before')
  const [days, setDays] = useState(task && task.offsetDays !== 0 ? String(Math.abs(task.offsetDays)) : '')
  const [errors, setErrors] = useState<{ title?: string; note?: string; days?: string }>({})

  function submit(e: FormEvent) {
    e.preventDefault()
    // Dialog nằm trong form gói theo cây React: không để sự kiện submit nổi lên làm "Gửi duyệt" gói
    e.stopPropagation()
    const r = validateTask({ title, note, kind, days })
    if (r.offsetDays === undefined) return setErrors(r)
    onSave({ key: task?.key ?? newKey(), id: task?.id, title: title.trim(), note: note.trim(), owner, offsetDays: r.offsetDays })
    onClose()
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <Field label="Tên công việc *" error={errors.title} hint={`${title.length}/${MAX_TITLE} ký tự`}>
        <textarea
          rows={2}
          autoFocus
          aria-invalid={errors.title ? true : undefined}
          placeholder="Ví dụ: Gửi phối cảnh 2D sân khấu, cổng chào, lối đi"
          className={cn(controlClass, 'h-auto min-h-[64px] resize-y py-2.5 leading-relaxed')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-[13px] font-medium">Ai phụ trách</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
          {OWNER_CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={owner === c.value}
              onClick={() => setOwner(c.value)}
              className={cn(
                'rounded-sm border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                owner === c.value ? 'border-gold bg-gold-soft' : 'border-line-strong bg-surface hover:bg-surface-2',
              )}
            >
              <span className="block text-[13.5px] font-semibold">{c.title}</span>
              <span className="block text-xs text-muted-foreground">{c.hint}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="grid gap-1.5">
        <legend className="mb-1.5 text-[13px] font-medium">Mốc thời gian *</legend>
        <div className="flex flex-wrap items-center gap-2">
          <div role="radiogroup" className="flex flex-wrap gap-2">
            {KIND_CHOICES.map((c) => (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={kind === c.value}
                onClick={() => {
                  setKind(c.value)
                  setErrors((er) => ({ ...er, days: undefined }))
                }}
                className={cn(
                  'rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                  kind === c.value ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line-strong bg-surface hover:bg-surface-2',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          {kind !== 'on' && (
            <span className="inline-flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={kind === 'before' ? MAX_BEFORE : MAX_AFTER}
                step={1}
                inputMode="numeric"
                aria-label="Số ngày"
                aria-invalid={errors.days ? true : undefined}
                placeholder="21"
                className={cn(controlClass, 'w-24 text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none')}
                value={days}
                onChange={(e) => setDays(e.target.value)}
              />
              <span className="text-[13px] text-muted-foreground">ngày</span>
            </span>
          )}
        </div>
        {errors.days ? (
          <span role="alert" data-field-error className="text-[13px] text-destructive">
            {errors.days}
          </span>
        ) : (
          <span className="text-[13px] text-muted-foreground">Ví dụ: Thử váy lần 1 — trước 21 ngày.</span>
        )}
      </fieldset>

      <Field label="Ghi chú cho người làm (không bắt buộc)" error={errors.note} hint={`${note.length}/${MAX_NOTE} ký tự`}>
        <textarea
          rows={2}
          aria-invalid={errors.note ? true : undefined}
          placeholder="Ví dụ: gửi ảnh rõ nét, định dạng JPG hoặc PNG"
          className={cn(controlClass, 'h-auto min-h-[64px] resize-y py-2.5 leading-relaxed')}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>

      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit">Lưu công việc</Button>
      </DialogFooter>
    </form>
  )
}

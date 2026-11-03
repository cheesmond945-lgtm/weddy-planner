import { useState, type FormEvent } from 'react'
import { FormError, FormField } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toast'
import { addDays, daysBetween, parseDate, toISODate, today } from '@/lib/date'
import type { TimelineItem, Wedding } from '@/types/wedding'
import { useTimelineMutations } from '../hooks'

/** Hạn hợp lệ: từ hôm nay đến trước ngày cưới (dateBounds trong prototype). */
function bounds(wedding: Wedding) {
  return { min: toISODate(today()), max: toISODate(addDays(parseDate(wedding.date), -1)) }
}

const RANGE_ERROR = 'Hạn phải từ hôm nay đến trước ngày tổ chức.'
const NOTE_MAX = 200

/** Ghi chú của việc (tối đa 200 ký tự). */
function NoteField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[13px] font-medium">
      Ghi chú{' '}
      <span className="font-normal text-muted-foreground">
        ({value.length}/{NOTE_MAX})
      </span>
      <textarea
        rows={3}
        maxLength={NOTE_MAX}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ví dụ: gọi trước 2 ngày"
        className="mt-1.5 w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] font-normal"
      />
    </label>
  )
}

/** Sửa mốc thời gian (editRow trong prototype). Việc chung sửa được cả tên; việc tự thêm thì xóa được. */
export function EditMilestoneDialog({ item, wedding, onClose }: { item: TimelineItem | null; wedding: Wedding; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa việc</DialogTitle>
          <DialogDescription className="sr-only">Đổi hạn và ghi chú</DialogDescription>
        </DialogHeader>
        {item && <EditMilestoneForm key={item.id} item={item} wedding={wedding} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EditMilestoneForm({ item, wedding, onClose }: { item: TimelineItem; wedding: Wedding; onClose: () => void }) {
  const { update, remove } = useTimelineMutations()
  const [title, setTitle] = useState(item.title)
  const [dueDate, setDueDate] = useState(item.dueDate ?? '')
  const [note, setNote] = useState(item.note ?? '')
  const [error, setError] = useState<string>()
  const b = bounds(wedding)
  const editableTitle = item.kind === 'TASK'

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!dueDate || dueDate < b.min || dueDate > b.max) return setError(RANGE_ERROR)
    if (editableTitle && !title.trim()) return setError('Tên công việc không được để trống.')
    const noteChanged = note.trim() !== (item.note ?? '')
    update.mutate(
      { id: item.id, patch: { dueDate, ...(editableTitle && { title: title.trim() }), ...(noteChanged && { note: note.trim() || null }) } },
      {
        onSuccess: () => {
          onClose()
          toast('Đã cập nhật việc')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      {editableTitle ? <FormField label="Tên công việc" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus /> : <p className="font-semibold">{item.title}</p>}
      <FormField label="Hạn hoàn thành" type="date" min={b.min} max={b.max} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <NoteField value={note} onChange={setNote} />
      <FormError message={error ?? update.error?.message ?? remove.error?.message} />
      <DialogFooter className="mt-1">
        {item.isCustom && (
          <Button
            type="button"
            variant="outline"
            className="mr-auto"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(item.id, {
                onSuccess: () => {
                  onClose()
                  toast('Đã xóa việc')
                },
              })
            }
          >
            Xóa việc này
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={update.isPending}>
          Lưu
        </Button>
      </DialogFooter>
    </form>
  )
}

/** Thêm việc vào timeline (addTask trong prototype). */
export function AddTaskDialog({ open, wedding, onClose }: { open: boolean; wedding: Wedding; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm việc vào timeline</DialogTitle>
          <DialogDescription className="sr-only">Nhập tên việc và hạn hoàn thành</DialogDescription>
        </DialogHeader>
        {open && <AddTaskForm wedding={wedding} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function AddTaskForm({ wedding, onClose }: { wedding: Wedding; onClose: () => void }) {
  const { add } = useTimelineMutations()
  const b = bounds(wedding)
  // Mặc định giữa hôm nay và ngày cưới
  const middle = toISODate(addDays(today(), Math.floor(daysBetween(today(), parseDate(wedding.date)) / 2)))
  const [title, setTitle] = useState('')
  const [dueDate, setDueDate] = useState(middle)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Vui lòng nhập tên công việc.')
    if (!dueDate || dueDate < b.min || dueDate > b.max) return setError(RANGE_ERROR)
    add.mutate(
      { title: title.trim(), dueDate, ...(note.trim() && { note: note.trim() }) },
      {
        onSuccess: () => {
          onClose()
          toast('Đã thêm việc')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <FormField label="Tên công việc" placeholder="Ví dụ: Đặt xe hoa" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <FormField label="Hạn hoàn thành" type="date" min={b.min} max={b.max} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      <NoteField value={note} onChange={setNote} />
      <FormError message={error ?? add.error?.message} />
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={add.isPending}>
          Thêm việc
        </Button>
      </DialogFooter>
    </form>
  )
}

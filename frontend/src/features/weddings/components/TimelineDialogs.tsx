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


/** Sửa tên và hạn của việc khung hoặc việc tự thêm (editRow trong prototype); xóa bằng nút thùng rác trên thẻ. */
export function EditMilestoneDialog({ item, wedding, onClose }: { item: TimelineItem | null; wedding: Wedding; onClose: () => void }) {
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chỉnh sửa việc</DialogTitle>
          <DialogDescription className="sr-only">Đổi tên và hạn</DialogDescription>
        </DialogHeader>
        {item && <EditMilestoneForm key={item.id} item={item} wedding={wedding} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function EditMilestoneForm({ item, wedding, onClose }: { item: TimelineItem; wedding: Wedding; onClose: () => void }) {
  const { update } = useTimelineMutations()
  const [title, setTitle] = useState(item.title)
  const [dueDate, setDueDate] = useState(item.dueDate ?? '')
  const [error, setError] = useState<string>()
  const b = bounds(wedding)
  // Việc khung và việc tự thêm đổi được tên; việc chi tiết của đơn không mở hộp này (NCC sửa)
  const editableTitle = item.kind !== 'SERVICE_TASK'

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!dueDate || dueDate < b.min || dueDate > b.max) return setError(RANGE_ERROR)
    if (editableTitle && !title.trim()) return setError('Tên công việc không được để trống.')

    update.mutate(
      { id: item.id, patch: { dueDate, ...(editableTitle && { title: title.trim() }) } },
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
      <FormError message={error ?? update.error?.message} />
      <DialogFooter>
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
  const [error, setError] = useState<string>()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!title.trim()) return setError('Vui lòng nhập tên công việc.')
    if (!dueDate || dueDate < b.min || dueDate > b.max) return setError(RANGE_ERROR)
    add.mutate(
      { title: title.trim(), dueDate },
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
      <FormError message={error ?? add.error?.message} />
      <DialogFooter>
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

import { useState, type FormEvent } from 'react'
import { FormError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CHANGE_LABEL } from '@/features/vendorOrders/constants'
import { REVISION_CHANGE_TYPES, type RevisionChangeType } from '@/types/vendorOrder'
import type { Order } from '@/types/order'
import { useRequestRevision } from '../hooks'

/** Yêu cầu chỉnh sửa đơn (chỉ khi Chờ thanh toán cọc): 4 ô chọn tùy chọn, nội dung chi tiết bắt buộc (docs/THE_DON_PHIA_KHACH.md mục 3.2). */
export function ReviseOrderDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{order ? `Yêu cầu chỉnh sửa đơn ${order.orderCode}` : 'Yêu cầu chỉnh sửa đơn'}</DialogTitle>
          <DialogDescription>Cho nhà cung cấp biết bạn muốn chỉnh sửa gì. Nội dung này hiện trong khung chat và cho nhà cung cấp khi họ cập nhật đơn.</DialogDescription>
        </DialogHeader>
        {order && <ReviseForm order={order} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ReviseForm({ order, onClose }: { order: Order; onClose: () => void }) {
  const [changes, setChanges] = useState<RevisionChangeType[]>([])
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const revise = useRequestRevision()

  const toggle = (c: RevisionChangeType) => setChanges((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!note.trim()) return setError('Vui lòng ghi rõ nội dung chi tiết cần chỉnh sửa để nhà cung cấp biết.')
    revise.mutate({ orderId: order.id, changes: REVISION_CHANGE_TYPES.filter((c) => changes.includes(c)), note: note.trim() }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <fieldset>
        <legend className="mb-1.5 block text-[13px] font-medium">Bạn muốn thay đổi gì?</legend>
        <div className="grid grid-cols-2 gap-2.5 max-[420px]:grid-cols-1">
          {REVISION_CHANGE_TYPES.map((c) => (
            <label key={c} className="inline-flex cursor-pointer items-center gap-[7px] text-sm">
              <input type="checkbox" checked={changes.includes(c)} onChange={() => toggle(c)} className="accent-primary" />
              {CHANGE_LABEL[c]}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="revise-note" className="mb-1.5 block text-[13px] font-medium">
          Nội dung chi tiết *
        </label>
        <textarea
          id="revise-note"
          rows={4}
          autoFocus
          value={note}
          onChange={(e) => {
            setNote(e.target.value)
            setError(undefined)
          }}
          placeholder="Ví dụ: Giảm còn 15 bàn, dời sang ngày 20/12..."
          className="w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
        />
      </div>
      <FormError message={error ?? revise.error?.message} />
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy bỏ
        </Button>
        <Button type="submit" disabled={revise.isPending}>
          Gửi yêu cầu
        </Button>
      </DialogFooter>
    </form>
  )
}

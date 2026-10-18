import { useState, type FormEvent } from 'react'
import { FormError } from '@/components/FormField'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Order } from '@/types/order'
import { useRequestRevision } from '../hooks'

const QUICK = ['Đổi ngày thực hiện', 'Đổi mức giá', 'Đổi gói dịch vụ', 'Đổi tiền cọc']

/** Yêu cầu chỉnh sửa đơn (reviseOrder trong prototype). */
export function ReviseOrderDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  return (
    <Dialog open={!!order} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yêu cầu chỉnh sửa đơn</DialogTitle>
          <DialogDescription>
            Cho nhà cung cấp biết bạn muốn chỉnh sửa gì. Nội dung này được gửi trong khung chat và hiện cho nhà cung cấp khi họ sửa đơn.
          </DialogDescription>
        </DialogHeader>
        {order && <ReviseForm order={order} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}

function ReviseForm({ order, onClose }: { order: Order; onClose: () => void }) {
  const [note, setNote] = useState('')
  const [error, setError] = useState<string>()
  const revise = useRequestRevision()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!note.trim()) return setError('Vui lòng ghi rõ nội dung cần chỉnh sửa để nhà cung cấp biết.')
    revise.mutate({ orderId: order.id, note: note.trim() }, { onSuccess: onClose })
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div>
        <label htmlFor="revise-note" className="mb-1.5 block text-[13px] font-medium">
          Nội dung cần chỉnh sửa
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
          placeholder="Ví dụ: Đổi ngày thực hiện sang 20/12, giảm tiền cọc xuống 20%..."
          className="w-full rounded-sm border border-input bg-surface px-3 py-2.5 text-[15px] text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          {QUICK.map((q) => (
            <Button
              key={q}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setNote((t) => `${t}${t ? '\n' : ''}${q}: `)
                document.getElementById('revise-note')?.focus()
              }}
            >
              {q}
            </Button>
          ))}
        </div>
      </div>
      <FormError message={error ?? revise.error?.message} />
      <DialogFooter className="mt-1">
        <Button type="button" variant="outline" onClick={onClose}>
          Hủy
        </Button>
        <Button type="submit" disabled={revise.isPending}>
          Gửi yêu cầu
        </Button>
      </DialogFooter>
    </form>
  )
}

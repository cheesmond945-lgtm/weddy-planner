import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { Order } from '@/types/vendorOrder'
import { changesLabel, openRevision } from '../calc'

interface RejectRevisionDialogProps {
  order: Order
  busy: boolean
  onClose: () => void
  onConfirm: (note: string) => void
}

/**
 * Từ chối yêu cầu chỉnh sửa của khách với đơn đã cọc: đơn giữ nguyên, khách được gửi yêu cầu mới.
 * Lý do tùy chọn, chỉ nằm trong tin hệ thống gửi khách (không lưu vào đơn).
 */
export function RejectRevisionDialog({ order: o, busy, onClose, onConfirm }: RejectRevisionDialogProps) {
  const [note, setNote] = useState('')
  const req = openRevision(o)

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Từ chối yêu cầu chỉnh sửa đơn {o.orderCode}?</DialogTitle>
          <DialogDescription>Đơn giữ nguyên như hiện tại. Hệ thống gửi tin báo từ chối vào cuộc trò chuyện với khách.</DialogDescription>
        </DialogHeader>

        {req && (
          <div className="rounded-md border border-warn/35 bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed">
            <b className="font-semibold text-warn">Khách yêu cầu:</b> {[changesLabel(req), req.requestNote ? `"${req.requestNote}"` : ''].filter(Boolean).join(' · ')}
          </div>
        )}

        <label className="grid gap-1 text-[13px] font-medium">
          Lý do gửi khách (không bắt buộc)
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Ngày đó bên mình đã kín lịch."
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm leading-relaxed font-normal outline-none focus:border-gold"
          />
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Quay lại
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => onConfirm(note.trim())}>
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" />
                Đang gửi…
              </>
            ) : (
              'Từ chối yêu cầu'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

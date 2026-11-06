import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import type { CancelReason, Order } from '@/types/vendorOrder'
import { CANCEL_REASON } from '../constants'

interface CancelOrderDialogProps {
  order: Order
  busy: boolean
  onClose: () => void
  onConfirm: (reason: CancelReason, note: string) => void
}

/**
 * Hủy đơn đã cọc (chỉ trước ngày thực hiện). Không chọn lý do: lý do duy nhất là "Khách yêu cầu hủy"
 * (khách mất cọc); nếu khách đã gửi yêu cầu hủy trên hệ thống thì hiện kèm ngày gửi và lời nhắn của khách. Ghi chú cho khách tùy chọn. Hủy xong đơn bị khóa, không tính hoa hồng.
 */
export function CancelOrderDialog({ order: o, busy, onClose, onConfirm }: CancelOrderDialogProps) {
  const [note, setNote] = useState('')
  const req = o.cancelRequest

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Hủy đơn {o.orderCode}?</DialogTitle>
          <DialogDescription>
            Đơn đã đặt cọc, thực hiện ngày {formatDate(o.eventDate)}. Hủy xong đơn bị khóa và không tính hoa hồng. Hệ thống gửi tin báo hủy vào cuộc trò chuyện với khách.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1 rounded-md border border-warn/40 bg-warn-soft px-3.5 py-3 text-sm">
          <b className="font-semibold">Lý do hủy: {CANCEL_REASON.CUSTOMER_REQUEST.label}</b>
          <span className="text-[12.5px] text-muted-foreground">
            {req ? `Khách gửi yêu cầu ngày ${formatDate(req.requestedDate.slice(0, 10))}. ` : ''}Tiền cọc {formatMoney(o.depositAmount)} không hoàn cho khách.
          </span>
          {req?.note && <span className="mt-1 text-[13px]">Lời nhắn của khách: “{req.note}”</span>}
        </div>

        <label className="grid gap-1.5 text-[13px] font-medium">
          Ghi chú cho khách (không bắt buộc)
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="VD: Khách báo dời lịch sang năm sau."
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm leading-relaxed font-normal outline-none focus:border-gold"
          />
          <span className="text-xs font-normal text-muted-foreground">Ghi chú chỉ hiện trong tin nhắn thông báo hủy đơn, không lưu vào đơn.</span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Quay lại
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => onConfirm('CUSTOMER_REQUEST', note.trim())}>
            {busy ? (
              <>
                <LoaderCircle className="animate-spin" />
                Đang hủy…
              </>
            ) : (
              'Hủy đơn'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

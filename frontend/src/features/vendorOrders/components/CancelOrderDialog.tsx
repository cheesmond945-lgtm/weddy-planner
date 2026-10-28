import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/date'
import { cn } from '@/lib/utils'
import { CANCEL_REASONS, type CancelReason, type Order } from '@/types/vendorOrder'
import { CANCEL_REASON } from '../constants'

interface CancelOrderDialogProps {
  order: Order
  busy: boolean
  onClose: () => void
  onConfirm: (reason: CancelReason, note: string) => void
}

/**
 * Hủy đơn đã cọc (chỉ trước ngày sự kiện). Bắt buộc chọn lý do: khách yêu cầu hủy (khách mất cọc) hoặc NCC không thể
 * thực hiện (NCC hoàn cọc ngoài hệ thống); ghi chú tùy chọn. Hủy xong đơn bị khóa, không tính hoa hồng.
 */
export function CancelOrderDialog({ order: o, busy, onClose, onConfirm }: CancelOrderDialogProps) {
  const [reason, setReason] = useState<CancelReason | null>(null)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Hủy đơn {o.orderCode}?</DialogTitle>
          <DialogDescription>
            Đơn đã đặt cọc, thực hiện ngày {formatDate(o.eventDate)}. Hủy xong đơn bị khóa và không tính hoa hồng. Hệ thống gửi tin báo hủy vào cuộc trò chuyện với khách.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="grid gap-2" aria-invalid={tried && !reason ? true : undefined}>
          <legend className="mb-1 text-[13px] font-medium">Lý do hủy *</legend>
          {CANCEL_REASONS.map((r) => (
            <label key={r} className={cn('flex cursor-pointer items-start gap-2.5 rounded-md border border-line px-3 py-2.5 text-sm', reason === r && 'border-warn/60 bg-warn-soft')}>
              <input type="radio" name="cancel-reason" className="mt-1 accent-[var(--warn)]" checked={reason === r} onChange={() => setReason(r)} />
              <span>
                <b className="block font-semibold">{CANCEL_REASON[r].label}</b>
                <span className="text-[12.5px] text-muted-foreground">{CANCEL_REASON[r].effect}</span>
              </span>
            </label>
          ))}
          {tried && !reason && (
            <span role="alert" className="text-xs text-destructive">
              Chọn lý do hủy đơn.
            </span>
          )}
        </fieldset>

        <label className="grid gap-1 text-[13px] font-medium">
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
          <Button
            variant="destructive"
            disabled={busy}
            onClick={() => {
              setTried(true)
              if (reason) onConfirm(reason, note.trim())
            }}
          >
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

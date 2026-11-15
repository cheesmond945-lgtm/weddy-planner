import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CancelReason, Order } from '@/types/vendorOrder'
import { CANCEL_REASON } from '../constants'

interface CancelOrderDialogProps {
  order: Order
  busy: boolean
  onClose: () => void
  onConfirm: (reason: CancelReason, note: string) => void
}

/**
 * Hủy đơn đã cọc (chỉ trước ngày thực hiện). NCC chọn lý do, mặc định là "Khách yêu cầu hủy":
 * - Khách yêu cầu hủy: khách mất cọc, NCC giữ cọc và vẫn trả hoa hồng trên tiền cọc.
 * - NCC không thể thực hiện: NCC hoàn 100% cọc cho khách, không có hoa hồng.
 * Nếu khách đã gửi yêu cầu hủy trên hệ thống thì hiện kèm ngày gửi và lời nhắn. Ghi chú cho khách tùy chọn. Hủy xong đơn bị khóa.
 */
export function CancelOrderDialog({ order: o, busy, onClose, onConfirm }: CancelOrderDialogProps) {
  const [reason, setReason] = useState<CancelReason>('CUSTOMER_REQUEST')
  const [note, setNote] = useState('')
  const req = o.cancelRequest
  const deposit = formatMoney(o.depositAmount)
  const effect: Record<CancelReason, string> = {
    CUSTOMER_REQUEST: `Khách mất cọc ${deposit}. Bạn giữ tiền cọc nên vẫn phải trả hoa hồng trên tiền cọc.`,
    VENDOR_UNABLE: `Bạn phải hoàn lại 100% tiền cọc ${deposit} cho khách. Không tính hoa hồng. Chỉ chọn khi chính bạn không thể thực hiện, chọn sai lý do là vi phạm điều khoản đối tác.`,
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Hủy đơn {o.orderCode}?</DialogTitle>
          <DialogDescription>
            Đơn đã đặt cọc, thực hiện ngày {formatDate(o.eventDate)}. Hủy xong đơn bị khóa. Hệ thống gửi tin báo hủy vào cuộc trò chuyện với khách.
          </DialogDescription>
        </DialogHeader>

        <fieldset className="grid gap-2" disabled={busy}>
          <legend className="mb-1 text-[13px] font-medium">Lý do hủy</legend>
          {(['CUSTOMER_REQUEST', 'VENDOR_UNABLE'] as const).map((r) => (
            <label
              key={r}
              className={cn('grid cursor-pointer gap-0.5 rounded-md border px-3.5 py-3 text-sm', reason === r ? 'border-gold bg-gold-soft/60' : 'border-line bg-surface')}
            >
              <span className="flex items-center gap-2">
                <input type="radio" name="cancel-reason" checked={reason === r} onChange={() => setReason(r)} />
                <b className="font-semibold">{CANCEL_REASON[r].label}</b>
              </span>
              <span className="pl-6 text-[12.5px] text-muted-foreground">{effect[r]}</span>
            </label>
          ))}
          {reason === 'CUSTOMER_REQUEST' && req && (
            <span className="text-[12.5px] text-muted-foreground">
              Khách gửi yêu cầu ngày {formatDate(req.requestedDate.slice(0, 10))}.{req.note ? ` Lời nhắn của khách: “${req.note}”` : ''}
            </span>
          )}
        </fieldset>

        <label className="grid gap-1.5 text-[13px] font-medium">
          Ghi chú cho khách (không bắt buộc)
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={reason === 'VENDOR_UNABLE' ? 'VD: Studio trùng lịch, xin lỗi khách. Sẽ hoàn cọc trong hôm nay.' : 'VD: Khách báo dời lịch sang năm sau.'}
            className="rounded-md border border-line bg-surface px-3 py-2 text-sm leading-relaxed font-normal outline-none focus:border-gold"
          />
          <span className="text-xs font-normal text-muted-foreground">Ghi chú chỉ hiện trong tin nhắn thông báo hủy đơn, không lưu vào đơn.</span>
        </label>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Quay lại
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => onConfirm(reason, note.trim())}>
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

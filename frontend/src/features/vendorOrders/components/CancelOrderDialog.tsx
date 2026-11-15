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
 * Hủy đơn đã cọc (chỉ trước ngày thực hiện). Lý do tự suy ra, NCC không chọn (để không gán lỗi cho khách mà giữ cọc):
 * - Khách đã gửi yêu cầu hủy: "Khách yêu cầu hủy", khách mất cọc, NCC giữ cọc và trả hoa hồng trên tiền cọc (nút "Đồng ý hủy đơn").
 * - Khách chưa yêu cầu: NCC chủ động hủy là lỗi phía NCC, "NCC không thể thực hiện", NCC hoàn 100% cọc ngoài hệ thống;
 *   hoa hồng trên tiền cọc vẫn tính như phí hủy, để NCC không né hoa hồng bằng cách hủy rồi làm ngoài hệ thống.
 * Ghi chú cho khách tùy chọn. Hủy xong đơn bị khóa.
 */
export function CancelOrderDialog({ order: o, busy, onClose, onConfirm }: CancelOrderDialogProps) {
  const [note, setNote] = useState('')
  const req = o.cancelRequest
  const reason: CancelReason = req ? 'CUSTOMER_REQUEST' : 'VENDOR_UNABLE'
  const deposit = formatMoney(o.depositAmount)

  return (
    <Dialog open onOpenChange={(open) => !open && !busy && onClose()}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{req ? `Đồng ý hủy đơn ${o.orderCode}?` : `Hủy đơn ${o.orderCode}?`}</DialogTitle>
          <DialogDescription>
            Đơn đã đặt cọc, thực hiện ngày {formatDate(o.eventDate)}. Hủy xong đơn bị khóa. Hệ thống gửi tin báo hủy vào cuộc trò chuyện với khách.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1 rounded-md border border-warn/40 bg-warn-soft px-3.5 py-3 text-sm">
          <b className="font-semibold">Lý do hủy: {CANCEL_REASON[reason].label}</b>
          {req ? (
            <span className="text-[12.5px] text-muted-foreground">
              Khách gửi yêu cầu ngày {formatDate(req.requestedDate.slice(0, 10))}. Khách mất cọc {deposit}. Bạn giữ tiền cọc nên vẫn phải trả hoa hồng trên tiền cọc.
            </span>
          ) : (
            <span className="text-[12.5px] text-muted-foreground">
              Khách chưa yêu cầu hủy nên đây là hủy do phía nhà cung cấp. Bạn phải <b className="font-semibold text-ink">hoàn lại 100% tiền cọc {deposit}</b> cho khách (chuyển khoản trực tiếp, ngoài hệ thống). Hoa hồng trên tiền cọc vẫn được tính như phí hủy đơn.
            </span>
          )}
          {req?.note && <span className="mt-1 text-[13px]">Lời nhắn của khách: “{req.note}”</span>}
        </div>

        <label className="grid gap-1.5 text-[13px] font-medium">
          Ghi chú cho khách (không bắt buộc)
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={req ? 'VD: Chúc hai bạn mọi điều tốt đẹp.' : 'VD: Studio trùng lịch, xin lỗi khách. Sẽ hoàn cọc trong hôm nay.'}
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
            ) : req ? (
              'Đồng ý hủy'
            ) : (
              'Hủy đơn'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

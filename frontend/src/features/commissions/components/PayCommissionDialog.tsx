import { useQueryClient } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { commissionsApi } from '@/api/commissions'
import { VietqrPanel } from '@/components/VietqrPanel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { PayInfo } from '@/types/payment'

/** Hộp thoại thanh toán hoa hồng qua VietQR: hiện mã QR, tự kiểm tra với SePay, xong thì làm mới số liệu tài chính. */
export function PayCommissionDialog({ statementId, info, onClose }: { statementId: string; info: PayInfo | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [paid, setPaid] = useState(false)

  function onPaid() {
    setPaid(true)
    void qc.invalidateQueries({ queryKey: ['vendor-commissions'] })
    void qc.invalidateQueries({ queryKey: ['vendor', 'notifications'] })
  }

  return (
    <Dialog open={!!info} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{paid ? 'Thanh toán thành công' : 'Thanh toán hoa hồng qua VietQR'}</DialogTitle>
          <DialogDescription>{paid ? 'WebPlan đã nhận hoa hồng của kỳ này.' : 'Quét mã QR hoặc chuyển khoản theo thông tin bên dưới.'}</DialogDescription>
        </DialogHeader>
        {info &&
          (paid ? (
            <p className="flex items-center gap-2 text-sage">
              <CircleCheck className="size-5" /> Đã ghi nhận thanh toán.
            </p>
          ) : (
            <VietqrPanel info={info} check={() => commissionsApi.check(statementId)} onPaid={onPaid} />
          ))}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {paid ? 'Đóng' : 'Để sau'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

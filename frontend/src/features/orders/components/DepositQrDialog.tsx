import { CircleCheck } from 'lucide-react'
import { useState } from 'react'
import { paymentsApi } from '@/api/orders'
import { VietqrPanel } from '@/components/VietqrPanel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useRefreshPlanning } from '@/features/weddings/hooks'
import { formatMoney } from '@/lib/format'
import type { PayInfo } from '@/types/payment'

/** Hộp thoại thanh toán cọc qua VietQR (giống thanh toán hoa hồng): hiện mã QR, tự kiểm tra, xong thì làm mới kế hoạch và đơn. info null = đang tạo mã. */
export function DepositQrDialog({ orderId, amount, info, open, onClose }: { orderId: string; amount: number; info: PayInfo | undefined; open: boolean; onClose: () => void }) {
  const refresh = useRefreshPlanning()
  const [paid, setPaid] = useState(false)

  function close() {
    setPaid(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{paid ? 'Đặt cọc thành công' : `Thanh toán cọc ${formatMoney(amount)} qua VietQR`}</DialogTitle>
          <DialogDescription>
            {paid ? 'Forever đã ghi nhận cọc, dịch vụ đã chốt và các việc cần làm đã được tạo.' : 'Quét mã QR hoặc chuyển khoản theo thông tin bên dưới.'}
          </DialogDescription>
        </DialogHeader>
        {paid ? (
          <p className="flex items-center gap-2 text-sage">
            <CircleCheck className="size-5" /> Đã ghi nhận thanh toán.
          </p>
        ) : info ? (
          <VietqrPanel
            info={info}
            check={() => paymentsApi.checkDeposit(orderId)}
            onPaid={() => {
              setPaid(true)
              void refresh()
            }}
            demoPay={info.demoMode ? () => paymentsApi.demoConfirm(orderId) : undefined}
          />
        ) : (
          <div className="h-[220px] animate-pulse rounded-md bg-muted" aria-busy="true" aria-label="Đang tạo mã QR" />
        )}
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {paid ? 'Đóng' : 'Để sau'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

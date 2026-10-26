import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { formatMoney } from '@/lib/format'
import type { CommissionStatement } from '@/types/commission'
import { formatPeriod } from '../calc'

interface PayStatementDialogProps {
  statement: CommissionStatement | null
  onClose: () => void
  onConfirm: (s: CommissionStatement) => void
}

/** Xác nhận nộp hoa hồng cả bảng kê qua VNPay. */
export function PayStatementDialog({ statement: s, onClose, onConfirm }: PayStatementDialogProps) {
  return (
    <ConfirmDialog open={!!s} onOpenChange={(open) => !open && onClose()} title="Nộp hoa hồng?" confirmLabel="Nộp tiền" onConfirm={() => s && onConfirm(s)}>
      {s && (
        <p>
          Nộp <b>{formatMoney(s.totalAmount)}</b> hoa hồng kỳ <b>{formatPeriod(s.periodMonth)}</b> qua VNPay?
        </p>
      )}
    </ConfirmDialog>
  )
}

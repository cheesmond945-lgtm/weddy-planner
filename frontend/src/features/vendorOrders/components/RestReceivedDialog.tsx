import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { formatMoney } from '@/lib/format'

/**
 * Xác nhận "đã nhận đủ tiền mặt phần còn lại". Dùng chung cho nút "Đã nhận tiền mặt", ô tick và kéo thẻ "Thanh toán phần còn lại"
 * sang Đã xong (không ghi nhận âm thầm). `amount` thiếu (lịch tháng không có số tiền) thì không nêu số.
 */
export function RestReceivedDialog({ open, amount, onOpenChange, onConfirm }: { open: boolean; amount?: number; onOpenChange: (open: boolean) => void; onConfirm: () => void }) {
  return (
    <ConfirmDialog open={open} onOpenChange={onOpenChange} title="Đã nhận đủ tiền?" confirmLabel="Xác nhận đã nhận" onConfirm={onConfirm}>
      <p>
        Xác nhận đã nhận đủ {amount !== undefined ? <b>{formatMoney(amount)}</b> : 'số tiền còn lại'} từ khách? Khách sẽ nhận thông báo.
      </p>
    </ConfirmDialog>
  )
}

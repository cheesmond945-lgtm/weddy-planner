import type { BadgeTone } from '@/components/Badge'
import type { OrderStatus, RevisionChangeType } from '@/types/vendorOrder'

/** Nhãn và màu trạng thái đơn, theo docs/api/THE_DON_HANG.md mục 3 (khách và NCC thấy giống nhau). */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  Draft: { label: 'Bản nháp', tone: 'neutral' },
  Pending: { label: 'Chờ thanh toán cọc', tone: 'wait' },
  NeedRevision: { label: 'Chờ chỉnh sửa', tone: 'warn' },
  Deposited: { label: 'Đã đặt cọc', tone: 'done' },
  Completed: { label: 'Hoàn thành', tone: 'info' },
  Expired: { label: 'Đã hết hạn', tone: 'neutral' },
  Cancelled: { label: 'Đã hủy', tone: 'warn' },
}

/** Nhãn nội dung khách muốn đổi (OrderRevisionChanges.ChangeType). */
export const CHANGE_LABEL: Record<RevisionChangeType, string> = {
  Item: 'Đổi hạng mục',
  Quantity: 'Đổi số lượng',
  EventDate: 'Đổi ngày thực hiện',
  Other: 'Khác',
}

/** Đơn đã khóa: không sửa, không gửi lại. */
export const isOrderLocked = (s: OrderStatus) => s === 'Completed' || s === 'Expired' || s === 'Cancelled'

/** Làm tròn tiền cọc đến 100.000đ (tạm: gần nhất, chờ nhóm chốt). Số chính thức do backend tính. */
export const DEPOSIT_ROUNDING = 100_000

/** Hạn cọc: 1 ngày sau khi gửi đơn. */
export const DEPOSIT_DUE_HOURS = 24

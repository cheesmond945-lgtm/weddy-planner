import type { BadgeTone } from '@/components/Badge'
import type { CancelReason, OrderStatus, RevisionChangeType } from '@/types/vendorOrder'

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

/** Lý do hủy đơn: nhãn và hệ quả (hoàn cọc xử lý ngoài hệ thống). */
export const CANCEL_REASON: Record<CancelReason, { label: string; effect: string }> = {
  CUSTOMER_REQUEST: { label: 'Khách yêu cầu hủy', effect: 'Khách mất cọc.' },
  VENDOR_UNABLE: { label: 'NCC không thể thực hiện', effect: 'NCC hoàn cọc cho khách ngoài hệ thống.' },
}


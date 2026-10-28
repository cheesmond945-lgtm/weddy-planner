import type { BadgeTone } from '@/components/Badge'
import type { AdjustmentStatus, OrderPaymentMethod, OrderPaymentStatus, ServiceOrder, ServiceOrderStatus } from '@/types/serviceOrder'

/** Nhãn trạng thái đơn theo prototype NCC. */
export const ORDER_STATUS: Record<ServiceOrderStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  AWAITING_CONFIRMATION: { label: 'Chờ khách đặt cọc', tone: 'wait' },
  REVISION_REQUESTED: { label: 'Khách yêu cầu chỉnh sửa', tone: 'warn' },
  CONFIRMED: { label: 'Đã đặt cọc', tone: 'done' },
  CANCELLED: { label: 'Đã hủy', tone: 'warn' },
}

/** Chỉ hủy được khi đơn chưa hủy và chưa có khoản thu nào (chưa nhận cọc). */
export const canCancelOrder = (o: Pick<ServiceOrder, 'status' | 'paidAmount'>) => o.status !== 'CANCELLED' && o.paidAmount === 0

/** Nhãn trạng thái thanh toán theo prototype NCC. */
export const PAYMENT_STATUS: Record<OrderPaymentStatus, { label: string; tone: BadgeTone }> = {
  UNPAID: { label: 'Chưa thu tiền', tone: 'neutral' },
  AWAITING_DEPOSIT: { label: 'Chờ thanh toán cọc', tone: 'wait' },
  DEPOSIT_PAID: { label: 'Đã nhận cọc', tone: 'done' },
  PARTIALLY_PAID: { label: 'Đã thu một phần', tone: 'info' },
  PAID: { label: 'Đã thu đủ', tone: 'done' },
  OVERPAID: { label: 'Thu thừa · cần xử lý hoàn', tone: 'warn' },
}

export const PAYMENT_METHOD_LABEL: Record<OrderPaymentMethod, string> = {
  VIETQR: 'VietQR (trực tuyến)',
  BANK_TRANSFER: 'Chuyển khoản',
  CASH: 'Tiền mặt',
}

/** Phương thức chọn được cho các đợt sau đặt cọc (đợt đặt cọc luôn qua VietQR). */
export const OFFLINE_METHODS: OrderPaymentMethod[] = ['BANK_TRANSFER', 'CASH']

export const ADJUSTMENT_STATUS: Record<AdjustmentStatus, { label: string; tone: BadgeTone }> = {
  AWAITING_CONFIRMATION: { label: 'Chờ khách xác nhận', tone: 'wait' },
  REVISION_REQUESTED: { label: 'Khách yêu cầu sửa phương án', tone: 'warn' },
  ACCEPTED: { label: 'Khách đồng ý', tone: 'done' },
  SUPERSEDED: { label: 'Đã thay thế bởi phương án mới', tone: 'neutral' },
}

/** Đơn vị tính gợi ý (như prototype). */
export const UNIT_OPTIONS = ['Bàn', 'Gói', 'Buổi', 'Người', 'Bộ', 'Suất', 'Hạng mục']

/** Nhãn gộp trên thẻ đơn: "Đã xác nhận · Đã nhận cọc" (như prototype). */
export function orderStatusLabel(o: Pick<ServiceOrder, 'status' | 'paymentStatus'>) {
  if (o.status !== 'CONFIRMED') return ORDER_STATUS[o.status]
  return { label: `Đã xác nhận · ${PAYMENT_STATUS[o.paymentStatus].label}`, tone: PAYMENT_STATUS[o.paymentStatus].tone }
}

/** Tình trạng điều chỉnh của đơn đã xác nhận (để chọn nội dung, nút trên thẻ đơn). */
export function adjustmentStateOf(o: ServiceOrder) {
  const active = o.adjustments.find((a) => a.status === 'AWAITING_CONFIRMATION' || a.status === 'REVISION_REQUESTED')
  if (active) return { kind: active.status, adjustment: active } as const
  if (o.adjustmentRequest) return { kind: 'REQUESTED', adjustment: null } as const
  return null
}

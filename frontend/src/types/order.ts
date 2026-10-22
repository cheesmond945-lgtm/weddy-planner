/*
 * CHỜ ĐỐI CHIẾU docs/database.md và docs/state-diagrams.md (trạng thái đơn, thanh toán).
 * Hợp đồng: docs/api/orders.md, docs/api/payments.md
 */

export type OrderStatus = 'SENT' | 'REVISION_REQUESTED' | 'PAID' | 'CANCELLED'

/** Đơn dịch vụ NCC gửi trong khung chat (7.3). */
export interface Order {
  id: string
  /** Mã hiển thị, ví dụ "#001" */
  code: string
  planItemId: string
  serviceId: string
  conversationId: string
  packageName: string
  /** Ngày thực hiện "YYYY-MM-DD" */
  serviceDate: string
  totalAmount: number
  depositAmount: number
  status: OrderStatus
  /** Nội dung cặp đôi yêu cầu chỉnh sửa (khi REVISION_REQUESTED) */
  revisionNote: string | null
  paidAt: string | null
}

export type PaymentMethod = 'VNPAY_QR' | 'VNPAY_ATM' | 'INTERNATIONAL_CARD'

export interface PaymentCreated {
  paymentId: string
  /** Chuyển trình duyệt tới địa chỉ này (cổng VNPay) */
  paymentUrl: string
}

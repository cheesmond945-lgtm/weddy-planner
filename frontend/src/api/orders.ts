import type { ServiceDetail } from '@/types/catalog'
import type { Order, PaymentCreated, RevisionChangeType } from '@/types/order'
import type { PayCheckResult } from '@/types/payment'
import { http } from './client'

/** Hợp đồng: docs/api/orders.md */
export const ordersApi = {
  /** Mọi đơn NCC đã gửi cho khách (không có bản nháp), mới nhất trước; trang Kế hoạch nhóm theo `category`. */
  list: (): Promise<Order[]> => http.get('/orders'),
  get: (id: string): Promise<Order> => http.get(`/orders/${id}`),
  /** Dịch vụ của đơn, xem được cả khi NCC đang bị ẩn */
  getService: (id: string): Promise<ServiceDetail> => http.get(`/orders/${id}/service`),
  /** Đơn Pending, hoặc Deposited còn trước ngày thực hiện (tiền cọc giữ nguyên). changes: 4 ô chọn tùy chọn; note: nội dung chi tiết, bắt buộc. */
  requestRevision: (id: string, body: { changes: RevisionChangeType[]; note: string }): Promise<Order> =>
    http.post(`/orders/${id}/revision-requests`, body),
}

/** Hợp đồng: docs/api/payments.md */
export const paymentsApi = {
  /** Mã QR VietQR cho tiền cọc (số tiền lấy từ đơn, nội dung EVERLY + mã đơn) */
  createDeposit: (orderId: string): Promise<PaymentCreated> => http.post('/payments', { orderId }),
  /** Backend hỏi SePay đã nhận đủ tiền cọc chưa và ghi nhận nếu đã nhận */
  checkDeposit: (orderId: string): Promise<PayCheckResult> => http.post('/payments/check', { orderId }),
  /** Chỉ dùng khi thử (PAYMENT_DEMO_MODE=true): ghi nhận đã cọc ngay, không cần chuyển tiền */
  demoConfirm: (orderId: string): Promise<PayCheckResult> => http.post('/payments/demo-confirm', { orderId }),
}

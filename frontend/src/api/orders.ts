import type { ServiceDetail } from '@/types/catalog'
import type { Order, PaymentCreated } from '@/types/order'
import type { PayCheckResult } from '@/types/payment'
import { http } from './client'

/** Hợp đồng: docs/api/orders.md */
export const ordersApi = {
  get: (id: string): Promise<Order> => (http.get(`/orders/${id}`)),
  /** Dịch vụ của đơn, xem được cả khi NCC đang bị ẩn */
  getService: (id: string): Promise<ServiceDetail> => http.get(`/orders/${id}/service`),
  requestRevision: (id: string, note: string): Promise<Order> =>
    http.post(`/orders/${id}/revision-requests`, { note }),
}

/** Hợp đồng: docs/api/payments.md */
export const paymentsApi = {
  /** Mã QR VietQR cho tiền cọc (số tiền lấy từ đơn, nội dung EVERLY + mã đơn) */
  createDeposit: (orderId: string): Promise<PaymentCreated> => http.post('/payments', { orderId }),
  /** Backend hỏi SePay đã nhận đủ tiền cọc chưa và ghi nhận nếu đã nhận */
  checkDeposit: (orderId: string): Promise<PayCheckResult> => http.post('/payments/check', { orderId }),
}

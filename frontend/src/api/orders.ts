import type { Order, PaymentCreated, PaymentMethod } from '@/types/order'
import { http } from './client'

/** Hợp đồng: docs/api/orders.md */
export const ordersApi = {
  get: (id: string): Promise<Order> => (http.get(`/orders/${id}`)),
  requestRevision: (id: string, note: string): Promise<Order> =>
    http.post(`/orders/${id}/revision-requests`, { note }),
}

/** Hợp đồng: docs/api/payments.md */
export const paymentsApi = {
  createDeposit: (orderId: string, method: PaymentMethod): Promise<PaymentCreated> =>
    http.post('/payments', { orderId, method }),
  /** VNPay thật: gửi các tham số vnp_* trên URL quay về để backend kiểm chữ ký, số tiền rồi ghi nhận cọc */
  confirmDeposit: (query: Record<string, string>): Promise<{ status: 'PAID' | 'FAILED'; message: string }> =>
    http.post('/payments/vnpay/confirm', query),
}

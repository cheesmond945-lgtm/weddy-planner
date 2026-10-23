import { mockChat } from '@/mocks/chat'
import type { Order, PaymentCreated, PaymentMethod } from '@/types/order'
import { http } from './client'
import { isMock, mockDelay } from './mock'

/** Hợp đồng: docs/api/orders.md */
export const ordersApi = {
  get: (id: string): Promise<Order> => (isMock('orders') ? mockDelay(null, 200).then(() => mockChat.getOrder(id)) : http.get(`/orders/${id}`)),
  requestRevision: (id: string, note: string): Promise<Order> =>
    isMock('orders') ? mockDelay(null, 300).then(() => mockChat.requestRevision(id, note)) : http.post(`/orders/${id}/revision-requests`, { note }),
}

/** Hợp đồng: docs/api/payments.md */
export const paymentsApi = {
  createDeposit: (orderId: string, method: PaymentMethod): Promise<PaymentCreated> =>
    isMock('orders') ? mockDelay(null, 1200).then(() => mockChat.createPayment(orderId, method)) : http.post('/payments', { orderId, method }),
}

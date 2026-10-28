import { mockChat } from '@/mocks/chat'
import type { Order, PaymentCreated, PaymentMethod, RevisionChangeType } from '@/types/order'
import { http } from './client'
import { isMock, mockDelay } from './mock'

/** Hợp đồng: docs/api/orders.md */
export const ordersApi = {
  /** Mọi đơn NCC đã gửi cho khách (không có bản nháp), mới nhất trước; trang Kế hoạch nhóm theo `category`. */
  list: (): Promise<Order[]> => (isMock('orders') ? mockDelay(null, 200).then(() => mockChat.listOrders()) : http.get('/orders')),
  get: (id: string): Promise<Order> => (isMock('orders') ? mockDelay(null, 200).then(() => mockChat.getOrder(id)) : http.get(`/orders/${id}`)),
  /** Đơn Pending, hoặc Deposited còn trước ngày thực hiện (tiền cọc giữ nguyên). changes: 4 ô chọn tùy chọn; note: nội dung chi tiết, bắt buộc. */
  requestRevision: (id: string, body: { changes: RevisionChangeType[]; note: string }): Promise<Order> =>
    isMock('orders') ? mockDelay(null, 300).then(() => mockChat.requestRevision(id, body)) : http.post(`/orders/${id}/revision-requests`, body),
}

/** Hợp đồng: docs/api/payments.md */
export const paymentsApi = {
  createDeposit: (orderId: string, method: PaymentMethod): Promise<PaymentCreated> =>
    isMock('orders') ? mockDelay(null, 1200).then(() => mockChat.createPayment(orderId, method)) : http.post('/payments', { orderId, method }),
}

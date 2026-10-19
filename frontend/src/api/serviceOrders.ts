import { mockVendorChat } from '@/mocks/vendorChat'
import { authStore } from '@/store/auth'
import type { Paginated } from '@/types/api'
import type { OrderContent, OrderListQuery, ProposeAdjustmentBody, RecordPaymentBody, ServiceOrder, ServiceOrderStatus } from '@/types/serviceOrder'
import { ApiError, http, requestRaw } from './client'
import { USE_MOCK, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 300) => mockDelay(null, ms).then(() => fn(mockUserId()))

/** Đơn dịch vụ phía NCC. Hợp đồng: docs/api/orders.md (phần Nhà cung cấp). */
export const serviceOrdersApi = {
  /** Danh sách đơn có lọc, phân trang (trang Quản lý đơn hàng). */
  list: async (query: OrderListQuery): Promise<Paginated<ServiceOrder>> => {
    if (USE_MOCK) return mock((u) => mockVendorChat.listAllOrders(u, query), 250)
    const res = await requestRaw<ServiceOrder[]>('/vendors/me/orders', { query: { ...query } })
    return { data: res.data, meta: res.meta! }
  },

  /** Số đơn theo trạng thái (không theo bộ lọc). */
  counts: (): Promise<Record<ServiceOrderStatus, number>> =>
    USE_MOCK ? mock((u) => mockVendorChat.orderCounts(u), 150) : http.get('/vendors/me/orders/counts'),

  /** Đơn của một hội thoại (gồm cả bản nháp). */
  listByConversation: (conversationId: string): Promise<ServiceOrder[]> =>
    USE_MOCK
      ? mock((u) => mockVendorChat.listOrders(u, conversationId), 200)
      : http.get('/vendors/me/orders', { query: { conversationId } }),

  get: (orderId: string): Promise<ServiceOrder> =>
    USE_MOCK ? mock((u) => mockVendorChat.getOrder(u, orderId)) : http.get(`/vendors/me/orders/${orderId}`),

  /** Tạo đơn trong hội thoại: send = false lưu nháp, true gửi luôn v1 cho khách. */
  create: (body: { conversationId: string; content: OrderContent; send: boolean }): Promise<ServiceOrder> =>
    USE_MOCK ? mock((u) => mockVendorChat.createOrder(u, body), 600) : http.post('/vendors/me/orders', body),

  /** Lưu nháp đơn đã có (bản nháp mới, hoặc bản sửa của đơn đã gửi). */
  saveDraft: (orderId: string, content: OrderContent): Promise<ServiceOrder> =>
    USE_MOCK ? mock((u) => mockVendorChat.saveDraft(u, orderId, content)) : http.put(`/vendors/me/orders/${orderId}/draft`, { content }),

  /** Gửi bản nháp lần đầu (v1) hoặc gửi lại phiên bản mới. baseVersion: phiên bản đang sửa dựa trên. */
  send: (orderId: string, body: { content: OrderContent; baseVersion: number | null }): Promise<ServiceOrder> =>
    USE_MOCK ? mock((u) => mockVendorChat.sendOrder(u, orderId, body), 600) : http.post(`/vendors/me/orders/${orderId}/send`, body),

  /** NCC ghi nhận khoản thu cho đợt sau đặt cọc. Tệp minh chứng upload trước qua vendorsApi.uploadFile('PAYMENT_PROOF'). */
  recordPayment: (orderId: string, body: RecordPaymentBody): Promise<ServiceOrder> =>
    USE_MOCK ? mock((u) => mockVendorChat.recordPayment(u, orderId, body), 500) : http.post(`/vendors/me/orders/${orderId}/payments`, body),

  /** Lập phương án điều chỉnh (revisionOf: sửa lại phương án khách yêu cầu sửa), gửi khách qua chat. */
  proposeAdjustment: (orderId: string, body: ProposeAdjustmentBody): Promise<ServiceOrder> =>
    USE_MOCK
      ? mock((u) => mockVendorChat.proposeAdjustment(u, orderId, body), 600)
      : http.post(`/vendors/me/orders/${orderId}/adjustments`, body),

  /** Hủy đơn khi chưa có khoản thu nào. */
  cancel: (orderId: string, reason: string): Promise<ServiceOrder> =>
    USE_MOCK ? mock((u) => mockVendorChat.cancelOrder(u, orderId, reason), 400) : http.post(`/vendors/me/orders/${orderId}/cancel`, { reason }),
}

import { mockVendorChat } from '@/mocks/vendorChat'
import { authStore } from '@/store/auth'
import type { OrderContent, ServiceOrder } from '@/types/serviceOrder'
import { ApiError, http } from './client'
import { USE_MOCK, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 300) => mockDelay(null, ms).then(() => fn(mockUserId()))

/**
 * Đơn dịch vụ phía NCC. Hợp đồng: docs/api/orders.md (phần Nhà cung cấp).
 * Ghi nhận thanh toán và phương án điều chỉnh làm cùng trang Quản lý đơn hàng.
 */
export const serviceOrdersApi = {
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
}

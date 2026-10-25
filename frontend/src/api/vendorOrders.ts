import { mockVendorOrders } from '@/mocks/vendorOrders'
import { authStore } from '@/store/auth'
import type { Paginated } from '@/types/api'
import type { Order, OrderContent, OrderListQuery, OrderStatus } from '@/types/vendorOrder'
import { ApiError, http, requestRaw } from './client'
import { isMock, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 300) => mockDelay(null, ms).then(() => fn(mockUserId()))

/** Đơn dịch vụ phía NCC. Hợp đồng: docs/api/orders.md (phần Nhà cung cấp). */
export const vendorOrdersApi = {
  /** Danh sách đơn có lọc, phân trang (trang Quản lý đơn hàng). Gồm cả bản nháp. */
  list: async (query: OrderListQuery): Promise<Paginated<Order>> => {
    if (isMock('orders')) return mock((u) => mockVendorOrders.listOrders(u, query), 250)
    const res = await requestRaw<Order[]>('/vendors/me/orders', { query: { ...query } })
    return { data: res.data, meta: res.meta! }
  },

  /** Số đơn theo từng trạng thái (không theo bộ lọc). */
  counts: (): Promise<Record<OrderStatus, number>> =>
    isMock('orders') ? mock((u) => mockVendorOrders.orderCounts(u), 150) : http.get('/vendors/me/orders/counts'),

  /** Đơn của một hội thoại (gồm cả bản nháp), để vẽ thẻ đơn trong chat. */
  listByConversation: async (conversationId: string): Promise<Order[]> => {
    if (isMock('orders')) return mock((u) => mockVendorOrders.listOrders(u, { conversationId, pageSize: 100 }).data, 200)
    const res = await requestRaw<Order[]>('/vendors/me/orders', { query: { conversationId, pageSize: 100 } })
    return res.data
  },

  get: (orderId: string): Promise<Order> =>
    isMock('orders') ? mock((u) => mockVendorOrders.getOrder(u, orderId)) : http.get(`/vendors/me/orders/${orderId}`),

  /** Tạo đơn trong hội thoại: send = false lưu nháp, true gửi luôn. BE tự suy WeddingId từ hội thoại. */
  create: (body: { conversationId: string; content: OrderContent; send: boolean }): Promise<Order> =>
    isMock('orders') ? mock((u) => mockVendorOrders.createOrder(u, body), 600) : http.post('/vendors/me/orders', body),

  /** Lưu bản nháp của đơn Draft. */
  saveDraft: (orderId: string, content: OrderContent): Promise<Order> =>
    isMock('orders') ? mock((u) => mockVendorOrders.saveDraft(u, orderId, content)) : http.put(`/vendors/me/orders/${orderId}/draft`, { content }),

  /** Gửi đơn Draft lần đầu, hoặc "Sửa và gửi lại" đơn Pending / NeedRevision (đặt lại hạn cọc 1 ngày). */
  send: (orderId: string, content: OrderContent): Promise<Order> =>
    isMock('orders') ? mock((u) => mockVendorOrders.sendOrder(u, orderId, content), 600) : http.post(`/vendors/me/orders/${orderId}/send`, { content }),

  /** Sửa đơn đã cọc: hạng mục, ngày, ghi chú. Khóa tỷ lệ cọc và tiền cọc. */
  edit: (orderId: string, content: OrderContent): Promise<Order> =>
    isMock('orders') ? mock((u) => mockVendorOrders.editDeposited(u, orderId, content), 500) : http.patch(`/vendors/me/orders/${orderId}`, { content }),

  /** Đánh dấu hoàn thành (chỉ khi đã qua ngày sự kiện). */
  complete: (orderId: string): Promise<Order> =>
    isMock('orders') ? mock((u) => mockVendorOrders.completeOrder(u, orderId), 400) : http.post(`/vendors/me/orders/${orderId}/complete`),

  /** Xuất hóa đơn cuối (mỗi đơn một lần). */
  issueFinalInvoice: (orderId: string): Promise<Order> =>
    isMock('orders') ? mock((u) => mockVendorOrders.issueFinalInvoice(u, orderId), 400) : http.post(`/vendors/me/orders/${orderId}/final-invoice`),
}

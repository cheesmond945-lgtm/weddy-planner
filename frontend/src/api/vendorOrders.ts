import type { Paginated } from '@/types/api'
import type { CancelReason, Order, OrderContent, OrderListQuery, OrderStatus } from '@/types/vendorOrder'
import { http, requestRaw } from './client'

/** Đơn dịch vụ phía NCC. Hợp đồng: docs/api/orders.md (phần Nhà cung cấp). */
export const vendorOrdersApi = {
  /** Danh sách đơn có lọc, phân trang (trang Quản lý đơn hàng). Gồm cả bản nháp. */
  list: async (query: OrderListQuery): Promise<Paginated<Order>> => {
    const res = await requestRaw<Order[]>('/vendors/me/orders', { query: { ...query } })
    return { data: res.data, meta: res.meta! }
  },

  /** Số đơn theo từng trạng thái (không theo bộ lọc). */
  counts: (): Promise<Record<OrderStatus, number>> =>
    http.get('/vendors/me/orders/counts'),

  /** Đơn của một hội thoại (gồm cả bản nháp), để vẽ thẻ đơn trong chat. */
  listByConversation: async (conversationId: string): Promise<Order[]> => {
    const res = await requestRaw<Order[]>('/vendors/me/orders', { query: { conversationId, pageSize: 100 } })
    return res.data
  },

  get: (orderId: string): Promise<Order> =>
    http.get(`/vendors/me/orders/${orderId}`),

  /** Tạo đơn trong hội thoại: send = false lưu nháp, true gửi luôn. BE tự suy WeddingId từ hội thoại. */
  create: (body: { conversationId: string; content: OrderContent; send: boolean }): Promise<Order> =>
    http.post('/vendors/me/orders', body),

  /** Lưu bản nháp của đơn Draft. */
  saveDraft: (orderId: string, content: OrderContent): Promise<Order> =>
    http.put(`/vendors/me/orders/${orderId}/draft`, { content }),

  /** Gửi đơn Draft lần đầu, hoặc "Cập nhật đơn" đơn Pending / NeedRevision (đặt lại hạn cọc 1 ngày). */
  send: (orderId: string, content: OrderContent): Promise<Order> =>
    http.post(`/vendors/me/orders/${orderId}/send`, { content }),

  /** Sửa đơn đã cọc: hạng mục, ngày, ghi chú. Khóa tỷ lệ cọc và tiền cọc. */
  edit: (orderId: string, content: OrderContent, changeNote: string): Promise<Order> =>
    http.patch(`/vendors/me/orders/${orderId}`, { content, changeNote }),

  /** NCC hủy đơn đã cọc, chỉ khi hôm nay còn trước ngày sự kiện. reason: CUSTOMER_REQUEST (khách mất cọc) hoặc VENDOR_UNABLE (NCC hoàn cọc ngoài hệ thống). */
  cancel: (orderId: string, body: { reason: CancelReason; note?: string }): Promise<Order> =>
    http.post(`/vendors/me/orders/${orderId}/cancel`, body),

  /** Từ chối yêu cầu chỉnh sửa của khách với đơn đã cọc (đơn giữ nguyên). Dữ liệu giả không có yêu cầu sau cọc nên không hỗ trợ. */
  rejectRevision: (orderId: string, note?: string): Promise<Order> =>
    http.post(`/vendors/me/orders/${orderId}/revision-requests/reject`, { note }),

  /** Hoàn tất đơn (chỉ khi đã qua ngày sự kiện). */
  complete: (orderId: string): Promise<Order> =>
    http.post(`/vendors/me/orders/${orderId}/complete`),

  /** Xuất hóa đơn (mỗi đơn một lần). */
  issueFinalInvoice: (orderId: string): Promise<Order> =>
    http.post(`/vendors/me/orders/${orderId}/final-invoice`),
}

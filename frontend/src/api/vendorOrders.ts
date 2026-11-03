import type { Paginated } from '@/types/api'
import type { AddTaskResult, BoardTask, CalendarItem, CancelReason, Order, NewOrderTaskInput, OrderContent, OrderDaySlot, OrderListQuery, OrderProgress, OrderStatus, OrderTasks, RestResult, TaskItemResult, TaskOwner, TaskStatus } from '@/types/vendorOrder'
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

  /** "Tiến độ đơn": việc chi tiết gắn với đơn và tóm tắt. */
  tasks: (orderId: string): Promise<OrderTasks> =>
    http.get(`/vendors/me/orders/${orderId}/tasks`),

  /** Đổi trạng thái một việc của đơn (Todo | Waiting | Done), cho mọi việc kể cả việc của khách. Trả đúng việc đã cập nhật. */
  setTaskStatus: (orderId: string, taskId: string, status: TaskStatus): Promise<TaskItemResult> =>
    http.patch(`/vendors/me/orders/${orderId}/tasks/${taskId}`, { status }),

  /** Thêm việc RIÊNG cho đơn đã cọc (đã chốt ngày luôn); addToPackage thêm luôn vào quy trình của gói (chỉ áp cho đơn sau). */
  addOrderTask: (orderId: string, body: NewOrderTaskInput): Promise<AddTaskResult> => http.post(`/vendors/me/orders/${orderId}/tasks`, body),

  /** Sửa việc riêng của đơn: tên, ghi chú, người phụ trách. */
  updateOrderTask: (orderId: string, taskId: string, body: { title?: string; note?: string | null; owner?: TaskOwner }): Promise<TaskItemResult> =>
    http.patch(`/vendors/me/orders/${orderId}/tasks/${taskId}`, body),

  /** "Bỏ việc khỏi đơn": việc của gói hoặc việc riêng, chưa xong. Gói và các đơn khác giữ nguyên. */
  removeOrderTask: (orderId: string, taskId: string): Promise<{ id: string }> => http.delete(`/vendors/me/orders/${orderId}/tasks/${taskId}`),

  /** "Chốt ngày này" (không gửi date) hoặc "Đổi ngày" (date: YYYY-MM-DD, đổi và chốt luôn). Trả đúng việc đã cập nhật. */
  confirmTaskDate: (orderId: string, taskId: string, date?: string, opts?: { undo?: boolean; confirmed?: boolean }): Promise<TaskItemResult> =>
    http.patch(`/vendors/me/orders/${orderId}/tasks/${taskId}/schedule`, { ...(date && { date }), ...(opts?.undo && { undo: true }), ...(opts?.confirmed !== undefined && { confirmed: opts.confirmed }) }),

  /** "Bỏ chốt": xóa xác nhận ngày, giữ nguyên ngày. Trả đúng việc đã cập nhật. */
  unconfirmTaskDate: (orderId: string, taskId: string): Promise<TaskItemResult> =>
    http.delete(`/vendors/me/orders/${orderId}/tasks/${taskId}/schedule`),

  /** Giờ có mặt ngày cưới của đơn (docs/LICH_TRINH_NGAY_CUOI.md) */
  daySlot: (orderId: string): Promise<OrderDaySlot> => http.get(`/vendors/me/orders/${orderId}/day-slot`),
  /** Chốt giờ có mặt: start, end giờ VN "YYYY-MM-DDTHH:mm" (có thể từ tối hôm trước); khách được báo */
  confirmDaySlot: (orderId: string, body: { start: string; end: string }): Promise<OrderDaySlot> => http.put(`/vendors/me/orders/${orderId}/day-slot`, body),
  /** Bỏ chốt giờ có mặt: về giờ dự kiến */
  clearDaySlot: (orderId: string): Promise<OrderDaySlot> => http.delete(`/vendors/me/orders/${orderId}/day-slot`),

  /** Lịch làm việc trong khoảng [from, to] (YYYY-MM-DD, tối đa 100 ngày): ngày thực hiện của đơn và việc chi tiết của đơn đã cọc. */
  calendar: async (from: string, to: string): Promise<CalendarItem[]> => {
    const res = await http.get<{ items: CalendarItem[] }>('/vendors/me/orders/calendar', { query: { from, to } })
    return res.items
  },

  /** Bảng việc (kanban): mọi việc chi tiết của các đơn đang thực hiện, kèm mã đơn, tên khách, ngày thực hiện. */
  board: async (): Promise<BoardTask[]> => {
    const res = await http.get<{ items: BoardTask[] }>('/vendors/me/orders/tasks')
    return res.items
  },

  /** Tiến độ của các đơn đang thực hiện: { [orderId]: OrderProgress } (nhãn "Trễ tiến độ" ở danh sách đơn). */
  progress: (): Promise<Record<string, OrderProgress>> =>
    http.get('/vendors/me/orders/progress'),

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
  /** restReceived: true = đồng thời ghi nhận đã nhận đủ tiền mặt phần còn lại (chưa ghi nhận mà không gửi thì 409 REST_PAYMENT_NOT_RECORDED) */
  complete: (orderId: string, restReceived?: boolean): Promise<Order> =>
    http.post(`/vendors/me/orders/${orderId}/complete`, restReceived ? { restReceived: true } : {}),

  /** Ghi nhận đã nhận đủ tiền mặt phần còn lại (đợt 2); khách nhận thông báo */
  recordRestPayment: (orderId: string): Promise<RestResult> => http.post(`/vendors/me/orders/${orderId}/rest-payment`),

  /** Bỏ ghi nhận đợt 2 */
  clearRestPayment: (orderId: string): Promise<RestResult> => http.delete(`/vendors/me/orders/${orderId}/rest-payment`),

  /** Xuất hóa đơn (mỗi đơn một lần). */
  issueFinalInvoice: (orderId: string): Promise<Order> =>
    http.post(`/vendors/me/orders/${orderId}/final-invoice`),
}

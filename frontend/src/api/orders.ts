import type { ServiceDetail } from '@/types/catalog'
import type { Order, PaymentCreated, RevisionChangeType } from '@/types/order'
import type { GuestChangeQuote } from '@/types/vendorOrder'
import type { PayCheckResult, PayInfo } from '@/types/payment'
import { http } from './client'

/** Hợp đồng: docs/api/orders.md */
export const ordersApi = {
  /** Mọi đơn NCC đã gửi cho khách (không có bản nháp), mới nhất trước; trang Kế hoạch nhóm theo `category`. */
  list: (): Promise<Order[]> => http.get('/orders'),
  get: (id: string): Promise<Order> => http.get(`/orders/${id}`),
  /** Dịch vụ của đơn, xem được cả khi NCC đang bị ẩn */
  getService: (id: string): Promise<ServiceDetail> => http.get(`/orders/${id}/service`),
  /** Đơn đã cọc còn yêu cầu đổi gói (Đổi hạng mục) được không: lock là lý do khóa (NCC đã chuẩn bị nhiều / sắp tới ngày), null nếu được */
  packageChangeLock: (id: string): Promise<{ lock: string | null }> => http.get(`/orders/${id}/package-change-lock`),
  /** Đơn Pending, hoặc Deposited còn trước ngày thực hiện (tiền cọc giữ nguyên). changes: 4 ô chọn tùy chọn; note: nội dung chi tiết, bắt buộc. */
  requestRevision: (id: string, body: { changes: RevisionChangeType[]; note: string }): Promise<Order> =>
    http.post(`/orders/${id}/revision-requests`, body),

  /** Đổi số khách (đơn tiệc đã cọc, trước ngày tổ chức 7 ngày): xem trước số bàn, giá trị mới, cọc bổ sung */
  quoteGuestChange: (id: string, guestCount: number): Promise<GuestChangeQuote> => http.get(`/orders/${id}/guest-changes/quote`, { query: { guestCount } }),
  /** Gửi yêu cầu đổi số khách, chờ NCC xác nhận */
  requestGuestChange: (id: string, body: { guestCount: number; note?: string }): Promise<Order> => http.post(`/orders/${id}/guest-changes`, body),
  /** Mã QR nộp cọc bổ sung (NCC đã đồng ý, giá trị đơn tăng) */
  payGuestChange: (id: string): Promise<PayInfo & { adjustmentId: string; demoMode: boolean }> => http.post(`/orders/${id}/guest-changes/pay`),
  checkGuestChangePay: (id: string): Promise<PayCheckResult> => http.post(`/orders/${id}/guest-changes/pay/check`),
  demoGuestChangePay: (id: string): Promise<PayCheckResult> => http.post(`/orders/${id}/guest-changes/pay/demo-confirm`),
  /** Khách yêu cầu hủy đơn đã cọc (tiền cọc không hoàn), chờ NCC xác nhận */
  requestCancel: (id: string, note?: string): Promise<Order> => http.post(`/orders/${id}/cancel-requests`, { note }),
  withdrawCancel: (id: string): Promise<Order> => http.delete(`/orders/${id}/cancel-requests`),
}

/** Hợp đồng: docs/api/payments.md */
export const paymentsApi = {
  /** Mã QR VietQR cho tiền cọc (số tiền lấy từ đơn, nội dung FOREVER + mã đơn) */
  createDeposit: (orderId: string): Promise<PaymentCreated> => http.post('/payments', { orderId }),
  /** Backend hỏi SePay đã nhận đủ tiền cọc chưa và ghi nhận nếu đã nhận */
  checkDeposit: (orderId: string): Promise<PayCheckResult> => http.post('/payments/check', { orderId }),
  /** Chỉ dùng khi thử (PAYMENT_DEMO_MODE=true): ghi nhận đã cọc ngay, không cần chuyển tiền */
  demoConfirm: (orderId: string): Promise<PayCheckResult> => http.post('/payments/demo-confirm', { orderId }),
}

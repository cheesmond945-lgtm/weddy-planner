import type { Paginated } from '@/types/api'
import type { OrderReviewItem, OwnReview, ReviewSummary, ServiceReview, VendorOrderReview } from '@/types/review'
import { http, requestRaw } from './client'

export interface ReviewInput {
  rating: number
  content: string
  tags: string[]
}

/** Đánh giá công khai của một dịch vụ (serviceId = id nhà cung cấp), không cần đăng nhập; khách viết / sửa; NCC đọc và phản hồi. */
export const reviewsApi = {
  list: async (serviceId: string, page: number, pageSize = 5): Promise<Paginated<ServiceReview>> => {
    const res = await requestRaw<ServiceReview[]>(`/services/${serviceId}/reviews`, { query: { page, pageSize } })
    return { data: res.data, meta: res.meta! }
  },
  summary: (serviceId: string): Promise<ReviewSummary> => http.get(`/services/${serviceId}/reviews/summary`),

  /** Khách: các dòng của đơn kèm đánh giá hiện có, dòng nào đánh giá được (đơn Hoàn thành) */
  itemsOfOrder: (orderId: string): Promise<OrderReviewItem[]> => http.get(`/orders/${orderId}/reviews`),
  create: (orderItemId: string, body: ReviewInput): Promise<OwnReview> => http.post(`/order-items/${orderItemId}/review`, body),
  /** Sửa trong 30 ngày kể từ lúc viết */
  update: (orderItemId: string, body: ReviewInput): Promise<OwnReview> => http.put(`/order-items/${orderItemId}/review`, body),

  /** NCC: đánh giá của khách theo đơn */
  vendorItemsOfOrder: (orderId: string): Promise<VendorOrderReview[]> => http.get(`/vendors/me/orders/${orderId}/reviews`),
  /** NCC phản hồi một lần dưới đánh giá */
  reply: (reviewId: string, content: string): Promise<OwnReview> => http.put(`/vendors/me/reviews/${reviewId}/reply`, { content }),
}

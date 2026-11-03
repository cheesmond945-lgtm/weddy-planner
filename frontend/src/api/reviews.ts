import type { Paginated } from '@/types/api'
import type { ReviewSummary, ServiceReview } from '@/types/review'
import { http, requestRaw } from './client'

/** Đánh giá công khai của một dịch vụ (serviceId = id nhà cung cấp), không cần đăng nhập. */
export const reviewsApi = {
  list: async (serviceId: string, page: number, pageSize = 5): Promise<Paginated<ServiceReview>> => {
    const res = await requestRaw<ServiceReview[]>(`/services/${serviceId}/reviews`, { query: { page, pageSize } })
    return { data: res.data, meta: res.meta! }
  },
  summary: (serviceId: string): Promise<ReviewSummary> => http.get(`/services/${serviceId}/reviews/summary`),
}

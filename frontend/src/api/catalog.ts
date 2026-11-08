import type { Paginated } from '@/types/api'
import type { Category, ServiceDetail, ServiceListQuery, ServiceSearchResult, ServiceSummary } from '@/types/catalog'
import { http, requestRaw } from './client'

/** Hợp đồng: docs/api/catalog.md */
export const catalogApi = {
  listCategories: (): Promise<Category[]> =>
    http.get('/categories'),

  /** Chỉ id và tên lĩnh vực (nhẹ, không phụ thuộc danh mục NCC): dùng cho ô chọn lĩnh vực ở màn Admin */
  listCategoryOptions: (): Promise<{ id: string; name: string }[]> =>
    http.get('/catalog/categories'),

  /** Chi phí thấp nhất từng hạng mục cho số khách (kiểm tra ngân sách tối thiểu ở form thông tin đám cưới) */
  categoryMinCosts: (guests: number): Promise<{ slug: string; minCost: number }[]> =>
    http.get(`/categories/min-costs?guests=${guests}`),

  listLocations: (): Promise<string[]> =>
    http.get('/services/locations'),

  /** Khu vực (phường/xã chính thức) có trong dữ liệu NCC đang hiển thị */
  listAreas: (): Promise<string[]> =>
    http.get('/services/areas'),

  listServices: async (query: ServiceListQuery, signal?: AbortSignal): Promise<Paginated<ServiceSummary>> => {
    const res = await requestRaw<ServiceSummary[]>('/services', { query: { ...query }, signal })
    return { data: res.data, meta: res.meta! }
  },

  /** Tìm kiếm 2 tầng: ai = true mới cho backend gọi AI (sau khi lần đầu nhận mode NEEDS_AI) */
  searchServices: (query: ServiceListQuery & { ai?: boolean }, signal?: AbortSignal): Promise<ServiceSearchResult> =>
    http.get('/services/search', { query: { ...query, ai: query.ai ? 1 : undefined }, signal }),

  getService: (id: string): Promise<ServiceDetail> =>
    http.get(`/services/${id}`),
}

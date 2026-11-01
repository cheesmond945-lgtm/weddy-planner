import type { Paginated } from '@/types/api'
import type { Category, ServiceDetail, ServiceListQuery, ServiceSummary } from '@/types/catalog'
import { http, requestRaw } from './client'

/** Hợp đồng: docs/api/catalog.md */
export const catalogApi = {
  listCategories: (): Promise<Category[]> =>
    http.get('/categories'),

  listLocations: (): Promise<string[]> =>
    http.get('/services/locations'),

  listServices: async (query: ServiceListQuery): Promise<Paginated<ServiceSummary>> => {
    const res = await requestRaw<ServiceSummary[]>('/services', { query: { ...query } })
    return { data: res.data, meta: res.meta! }
  },

  getService: (id: string): Promise<ServiceDetail> =>
    http.get(`/services/${id}`),
}

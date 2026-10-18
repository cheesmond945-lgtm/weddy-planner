import { mockCatalog } from '@/mocks/catalog'
import type { Paginated } from '@/types/api'
import type { Category, ServiceDetail, ServiceListQuery, ServiceSummary } from '@/types/catalog'
import { http, requestRaw } from './client'
import { USE_MOCK, mockDelay } from './mock'

/** Hợp đồng: docs/api/catalog.md */
export const catalogApi = {
  listCategories: (): Promise<Category[]> =>
    USE_MOCK ? mockDelay(null).then(() => mockCatalog.listCategories()) : http.get('/categories'),

  listLocations: (): Promise<string[]> =>
    USE_MOCK ? mockDelay(null).then(() => mockCatalog.listLocations()) : http.get('/services/locations'),

  listServices: async (query: ServiceListQuery): Promise<Paginated<ServiceSummary>> => {
    if (USE_MOCK) return mockDelay(null).then(() => mockCatalog.listServices(query))
    const res = await requestRaw<ServiceSummary[]>('/services', { query: { ...query } })
    return { data: res.data, meta: res.meta! }
  },

  getService: (id: string): Promise<ServiceDetail> =>
    USE_MOCK ? mockDelay(null).then(() => mockCatalog.getService(id)) : http.get(`/services/${id}`),
}

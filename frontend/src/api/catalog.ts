import { mockCatalog } from '@/mocks/catalog'
import type { Paginated } from '@/types/api'
import type { Category, ServiceDetail, ServiceListQuery, ServiceSummary } from '@/types/catalog'
import { http, requestRaw } from './client'
import { isMock, mockDelay } from './mock'

/** Hợp đồng: docs/api/catalog.md */
export const catalogApi = {
  listCategories: (): Promise<Category[]> =>
    isMock('catalog') ? mockDelay(null).then(() => mockCatalog.listCategories()) : http.get('/categories'),

  listLocations: (): Promise<string[]> =>
    isMock('catalog') ? mockDelay(null).then(() => mockCatalog.listLocations()) : http.get('/services/locations'),

  listServices: async (query: ServiceListQuery): Promise<Paginated<ServiceSummary>> => {
    if (isMock('catalog')) return mockDelay(null).then(() => mockCatalog.listServices(query))
    const res = await requestRaw<ServiceSummary[]>('/services', { query: { ...query } })
    return { data: res.data, meta: res.meta! }
  },

  getService: (id: string): Promise<ServiceDetail> =>
    isMock('catalog') ? mockDelay(null).then(() => mockCatalog.getService(id)) : http.get(`/services/${id}`),
}

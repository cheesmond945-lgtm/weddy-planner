import type { ServiceSummary } from '@/types/catalog'
import { http } from './client'

/** Hợp đồng: docs/api/favorites.md */
export const favoritesApi = {
  list: (): Promise<ServiceSummary[]> =>
    http.get('/favorites'),

  add: (serviceId: string): Promise<null> =>
    http.put(`/favorites/${serviceId}`),

  remove: (serviceId: string): Promise<null> =>
    http.delete(`/favorites/${serviceId}`),
}

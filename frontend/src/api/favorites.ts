import { mockFavorites } from '@/mocks/favorites'
import { authStore } from '@/store/auth'
import type { ServiceSummary } from '@/types/catalog'
import { ApiError, http } from './client'
import { USE_MOCK, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

/** Hợp đồng: docs/api/favorites.md */
export const favoritesApi = {
  list: (): Promise<ServiceSummary[]> =>
    USE_MOCK ? mockDelay(null, 200).then(() => mockFavorites.list(mockUserId())) : http.get('/favorites'),

  add: (serviceId: string): Promise<null> =>
    USE_MOCK ? mockDelay(null, 200).then(() => (mockFavorites.add(mockUserId(), serviceId), null)) : http.put(`/favorites/${serviceId}`),

  remove: (serviceId: string): Promise<null> =>
    USE_MOCK ? mockDelay(null, 200).then(() => (mockFavorites.remove(mockUserId(), serviceId), null)) : http.delete(`/favorites/${serviceId}`),
}

import { mockNotifications } from '@/mocks/notifications'
import { authStore } from '@/store/auth'
import type { AppNotification } from '@/types/notification'
import { ApiError, http } from './client'
import { isMock, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 150) => mockDelay(null, ms).then(() => fn(mockUserId()))

/** Thông báo của người đang đăng nhập, mọi vai trò. Hợp đồng: docs/api/notifications.md. Nhóm cờ mock: notifications. */
export const notificationsApi = {
  /** Mới nhất trước. */
  list: (limit = 30): Promise<AppNotification[]> =>
    isMock('notifications') ? mock((u) => mockNotifications.list(u, limit)) : http.get(`/notifications?limit=${limit}`),

  unreadCount: async (): Promise<number> =>
    isMock('notifications') ? mock((u) => mockNotifications.unreadCount(u), 80) : (await http.get<{ count: number }>('/notifications/unread-count')).count,

  markRead: (id: string): Promise<null> =>
    isMock('notifications') ? mock((u) => mockNotifications.markRead(u, id), 50) : http.post(`/notifications/${id}/read`),

  markAllRead: (): Promise<{ updated: number }> =>
    isMock('notifications') ? mock((u) => mockNotifications.markAllRead(u), 80) : http.post('/notifications/read-all'),
}

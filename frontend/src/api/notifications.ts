import type { VendorNotificationList } from '@/types/vendor'
import { http } from './client'

/** Thông báo của cặp đôi đang đăng nhập (cùng dạng với thông báo của NCC). */
export const notificationsApi = {
  list: (): Promise<VendorNotificationList> => http.get('/notifications', { query: { limit: 20 } }),
  read: (id: string): Promise<null> => http.post(`/notifications/${id}/read`),
  readAll: (): Promise<null> => http.post('/notifications/read-all'),
}

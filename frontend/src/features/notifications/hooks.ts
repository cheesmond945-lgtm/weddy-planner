import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { useAuth } from '@/store/auth'
import { notificationKeys } from './keys'

// Hỏi lại định kỳ; React Query tự dừng khi tab bị ẩn (refetchIntervalInBackground mặc định tắt)
const POLL_MS = 15_000

/** Số thông báo chưa đọc (chấm đỏ trên chuông). */
export function useNotificationUnread() {
  const { user } = useAuth()
  const { data } = useQuery({ queryKey: notificationKeys.unread(user?.id), queryFn: notificationsApi.unreadCount, enabled: !!user, refetchInterval: POLL_MS })
  return data ?? 0
}

/** Danh sách thông báo, mới nhất trước; chỉ tải khi mở menu chuông. */
export function useNotificationList(enabled: boolean) {
  const { user } = useAuth()
  return useQuery({ queryKey: notificationKeys.list(user?.id), queryFn: () => notificationsApi.list(30), enabled: !!user && enabled, refetchInterval: POLL_MS })
}

function useRefreshNotifications() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: notificationKeys.all(user?.id) })
}

export function useMarkNotificationRead() {
  const refresh = useRefreshNotifications()
  return useMutation({ mutationFn: notificationsApi.markRead, onSuccess: () => void refresh() })
}

export function useMarkAllNotificationsRead() {
  const refresh = useRefreshNotifications()
  return useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: () => void refresh() })
}

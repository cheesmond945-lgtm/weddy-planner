import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { useLivePoll } from '@/lib/realtime'
import { useAuth } from '@/store/auth'
import { notificationKeys } from './keys'

// Có realtime thì thông báo mới được đẩy tới; mất kết nối thì hỏi lại định kỳ (React Query tự dừng khi tab bị ẩn)
const POLL_MS = 15_000

/** Số thông báo chưa đọc (chấm đỏ trên chuông). */
export function useNotificationUnread() {
  const { user } = useAuth()
  const poll = useLivePoll(POLL_MS)
  const { data } = useQuery({ queryKey: notificationKeys.unread(user?.id), queryFn: notificationsApi.unreadCount, enabled: !!user, refetchInterval: poll })
  return data ?? 0
}

/** Danh sách thông báo, mới nhất trước; chỉ tải khi mở menu chuông. */
export function useNotificationList(enabled: boolean) {
  const { user } = useAuth()
  const poll = useLivePoll(POLL_MS)
  return useQuery({ queryKey: notificationKeys.list(user?.id), queryFn: () => notificationsApi.list(30), enabled: !!user && enabled, refetchInterval: poll })
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

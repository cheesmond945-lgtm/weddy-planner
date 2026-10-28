import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'

const keys = { all: ['admin', 'notifications'] as const }

/** Danh sách thông báo của Admin, tự tải lại mỗi 30 giây để chuông luôn cập nhật. */
export function useAdminNotifications() {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: keys.all, queryFn: adminApi.listNotifications, enabled, refetchInterval: 30_000 })
}

export function useReadNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => adminApi.readNotification(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useReadAllNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => adminApi.readAllNotifications(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
    onError: (e) => toast(e.message),
  })
}

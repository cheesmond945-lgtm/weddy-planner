import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from '@/api/notifications'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'

const keys = { all: ['couple', 'notifications'] as const }

/** Danh sách thông báo của cặp đôi, tự tải lại mỗi 30 giây để chuông luôn cập nhật. */
export function useCoupleNotifications() {
  const enabled = useAuth().user?.role === 'COUPLE'
  return useQuery({ queryKey: keys.all, queryFn: notificationsApi.list, enabled, refetchInterval: 30_000 })
}

export function useReadCoupleNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => notificationsApi.read(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useReadAllCoupleNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
    onError: (e) => toast(e.message),
  })
}

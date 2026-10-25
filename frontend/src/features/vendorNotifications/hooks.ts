import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorsApi } from '@/api/vendors'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'

const keys = { all: ['vendor', 'notifications'] as const }

/** Danh sách thông báo của NCC, tự tải lại mỗi 30 giây để chuông luôn cập nhật. */
export function useVendorNotifications() {
  const enabled = useAuth().user?.role === 'VENDOR'
  return useQuery({ queryKey: keys.all, queryFn: vendorsApi.listNotifications, enabled, refetchInterval: 30_000 })
}

export function useReadVendorNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => vendorsApi.readNotification(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useReadAllVendorNotifications() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => vendorsApi.readAllNotifications(),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.all }),
    onError: (e) => toast(e.message),
  })
}

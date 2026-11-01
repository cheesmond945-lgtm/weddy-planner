import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { useAuth } from '@/store/auth'

export const adminKeys = {
  counts: ['admin', 'counts'] as const,
  dashboard: ['admin', 'dashboard'] as const,
}

function useIsAdmin() {
  return useAuth().user?.role === 'ADMIN'
}

/** Số mục cần xử lý, hiện cạnh menu và chuông thông báo. */
export function useAdminCounts() {
  const enabled = useIsAdmin()
  return useQuery({ queryKey: adminKeys.counts, queryFn: adminApi.counts, enabled, refetchInterval: 30_000 })
}

export function useAdminDashboard() {
  const enabled = useIsAdmin()
  return useQuery({ queryKey: adminKeys.dashboard, queryFn: adminApi.dashboard, enabled, refetchOnMount: 'always' })
}

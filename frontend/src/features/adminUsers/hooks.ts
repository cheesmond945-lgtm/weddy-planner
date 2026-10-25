import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { toast } from '@/components/ui/toast'
import { useRefreshAdminSummary } from '@/features/adminShared/hooks'
import { useAuth } from '@/store/auth'
import type { AdminUser, AdminUserQuery, SaveUserBody } from '@/types/admin'

const keys = { list: (q: AdminUserQuery) => ['admin', 'users', q] as const, all: ['admin', 'users'] as const }

export function useAdminUsers(query: AdminUserQuery) {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: keys.list(query), queryFn: () => adminApi.listUsers(query), enabled, placeholderData: keepPreviousData, refetchOnMount: 'always' })
}

/** Sau khi đổi tài khoản: tải lại danh sách, số liệu tổng quan và yêu cầu tư vấn (có thể đã tạo tài khoản từ yêu cầu). */
function useSync() {
  const qc = useQueryClient()
  const refresh = useRefreshAdminSummary()
  return () => {
    void qc.invalidateQueries({ queryKey: keys.all })
    void qc.invalidateQueries({ queryKey: ['admin', 'consultations'] })
    refresh()
  }
}

export function useSaveUser(id: string | null) {
  const sync = useSync()
  return useMutation({
    mutationFn: (body: SaveUserBody): Promise<AdminUser> => (id ? adminApi.updateUser(id, body) : adminApi.createUser(body)),
    onSuccess: (u) => {
      sync()
      toast(id ? `Đã cập nhật tài khoản ${u.username}.` : u.emailSent ? `Đã tạo tài khoản ${u.username} và gửi thông tin đăng nhập qua email.` : `Đã tạo tài khoản ${u.username}.`)
    },
  })
}

export function useLockUser() {
  const sync = useSync()
  return useMutation({
    mutationFn: ({ id, lock }: { id: string; lock: boolean }) => (lock ? adminApi.lockUser(id) : adminApi.unlockUser(id)),
    onSuccess: (u) => {
      sync()
      toast(u.status === 'LOCKED' ? `Đã khóa tài khoản ${u.username}.` : `Đã mở khóa tài khoản ${u.username}.`)
    },
    onError: (e) => toast(e.message),
  })
}

export function useDeleteUser() {
  const sync = useSync()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteUser(id),
    onSuccess: () => {
      sync()
      toast('Đã xóa tài khoản.')
    },
    onError: (e) => toast(e.message),
  })
}

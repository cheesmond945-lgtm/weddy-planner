import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { toast } from '@/components/ui/toast'
import { useRefreshAdminSummary } from '@/features/adminShared/hooks'
import { useAuth } from '@/store/auth'
import type { AdminPackage, AdminPackageQuery } from '@/types/admin'

const keys = { list: (q: AdminPackageQuery) => ['admin', 'packages', q] as const, all: ['admin', 'packages'] as const }

/** Gói dịch vụ theo trang (lọc theo từ khóa, lĩnh vực, trạng thái, thời gian nộp), kèm số gói mỗi trạng thái. */
export function useAdminPackages(query: AdminPackageQuery) {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: keys.list(query), queryFn: () => adminApi.listPackages(query), enabled, placeholderData: keepPreviousData, refetchOnMount: 'always' })
}

/** Duyệt gói hoặc yêu cầu chỉnh sửa (kèm nội dung). */
export function useReviewPackage() {
  const qc = useQueryClient()
  const refresh = useRefreshAdminSummary()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }): Promise<AdminPackage> => (note === undefined ? adminApi.approvePackage(id) : adminApi.requestPackageRevision(id, note)),
    onSuccess: (p, { note }) => {
      void qc.invalidateQueries({ queryKey: keys.all })
      refresh()
      toast(note === undefined ? `Đã duyệt gói ${p.name}. Gói được hiển thị công khai.` : `Đã gửi yêu cầu chỉnh sửa gói ${p.name}.`)
    },
  })
}

/** Chi tiết một gói (luôn tải mới khi mở). */
export function useAdminPackage(id: string) {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: ['admin', 'package', id] as const, queryFn: () => adminApi.getPackage(id), enabled, staleTime: 0, gcTime: 0 })
}

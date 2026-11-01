import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { toast } from '@/components/ui/toast'
import { useRefreshAdminSummary } from '@/features/adminShared/hooks'
import { useAuth } from '@/store/auth'
import type { AdminVendor, AdminVendorQuery } from '@/types/admin'

const keys = { list: (q: AdminVendorQuery) => ['admin', 'vendors', q] as const, all: ['admin', 'vendors'] as const }

/** Hồ sơ đã gửi theo trang (lọc theo từ khóa, lĩnh vực, trạng thái, thứ tự nộp), kèm số hồ sơ mỗi trạng thái. */
export function useAdminVendors(query: AdminVendorQuery) {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: keys.list(query), queryFn: () => adminApi.listVendors(query), enabled, placeholderData: keepPreviousData, refetchOnMount: 'always' })
}

/** Chi tiết một hồ sơ kèm giấy tờ, ảnh cơ sở (link xem tạm thời, nên luôn tải mới khi mở). */
export function useAdminVendor(id: string) {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: ['admin', 'vendor', id] as const, queryFn: () => adminApi.getVendor(id), enabled, staleTime: 0, gcTime: 0 })
}

/** Duyệt hồ sơ hoặc yêu cầu bổ sung (kèm nội dung). */
export function useReviewVendor() {
  const qc = useQueryClient()
  const refresh = useRefreshAdminSummary()
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }): Promise<AdminVendor> => (note === undefined ? adminApi.approveVendor(id) : adminApi.requestVendorRevision(id, note)),
    onSuccess: (v, { note }) => {
      void qc.invalidateQueries({ queryKey: keys.all })
      refresh()
      toast(note === undefined ? `Đã duyệt hồ sơ ${v.businessName}.` : `Đã gửi yêu cầu bổ sung cho ${v.businessName}.`)
    },
  })
}

/** Admin ẩn hồ sơ đã duyệt (kéo theo mọi gói) hoặc hiện lại. */
export function useToggleVendorHidden() {
  const qc = useQueryClient()
  const refresh = useRefreshAdminSummary()
  return useMutation({
    mutationFn: ({ id, hide }: { id: string; hide: boolean }): Promise<AdminVendor> => (hide ? adminApi.hideVendor(id) : adminApi.unhideVendor(id)),
    onSuccess: (v, { hide }) => {
      void qc.invalidateQueries({ queryKey: keys.all })
      void qc.invalidateQueries({ queryKey: ['admin', 'vendor', v.id] })
      refresh()
      toast(hide ? `Đã ẩn hồ sơ ${v.businessName} và các gói dịch vụ.` : `Đã hiện lại hồ sơ ${v.businessName}.`)
    },
  })
}

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { toast } from '@/components/ui/toast'
import { useRefreshAdminSummary } from '@/features/adminShared/hooks'
import { useAuth } from '@/store/auth'
import type { ConsultationQuery, UpdateConsultationBody } from '@/types/admin'

const keys = { list: (q: ConsultationQuery) => ['admin', 'consultations', q] as const, all: ['admin', 'consultations'] as const }

export function useConsultations(query: ConsultationQuery) {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: keys.list(query), queryFn: () => adminApi.listConsultations(query), enabled, placeholderData: keepPreviousData, refetchOnMount: 'always' })
}

/** Xóa yêu cầu (spam, sai thông tin) để nhà cung cấp gửi lại. */
export function useDeleteConsultation() {
  const qc = useQueryClient()
  const refresh = useRefreshAdminSummary()
  return useMutation({
    mutationFn: (id: string) => adminApi.deleteConsultation(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all })
      refresh()
      toast('Đã xóa yêu cầu tư vấn.')
    },
    onError: (e) => toast(e.message),
  })
}

/** Đánh dấu đã liên hệ, đánh giá nhà cung cấp, ghi chú. */
export function useUpdateConsultation() {
  const qc = useQueryClient()
  const refresh = useRefreshAdminSummary()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateConsultationBody }) => adminApi.updateConsultation(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.all })
      refresh()
    },
    onError: (e) => toast(e.message),
  })
}

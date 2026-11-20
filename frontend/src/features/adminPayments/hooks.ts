import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
import { toast } from '@/components/ui/toast'
import { useRefreshAdminSummary } from '@/features/adminShared/hooks'
import { useAuth } from '@/store/auth'
import type { AdminStatementQuery } from '@/types/admin'

const keys = { list: (q: AdminStatementQuery) => ['admin', 'statements', q] as const, all: ['admin', 'statements'] as const }

export function useAdminStatements(query: AdminStatementQuery) {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: keys.list(query), queryFn: () => adminApi.listStatements(query), enabled, placeholderData: keepPreviousData, refetchOnMount: 'always' })
}

/** Chi tiết một bảng kê (nhà cung cấp, kỳ, từng đơn tính hoa hồng). */
export function useAdminStatement(id: string) {
  const enabled = useAuth().user?.role === 'ADMIN'
  return useQuery({ queryKey: ['admin', 'statement', id] as const, queryFn: () => adminApi.getStatement(id), enabled, staleTime: 0 })
}

/** Ghi nhận đã thanh toán (NCC chuyển khoản ngoài VietQR), có thể mở khóa tài khoản và hiện lại hồ sơ NCC luôn. */
export function useRecordStatementPayment() {
  const qc = useQueryClient()
  const refresh = useRefreshAdminSummary()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; transactionCode: string; paidAt: string; unlock: boolean; unhide: boolean }) => adminApi.recordStatementPayment(id, body),
    onSuccess: (s, { unlock, unhide }) => {
      qc.setQueryData(['admin', 'statement', s.id], s)
      void qc.invalidateQueries({ queryKey: keys.all })
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      if (unhide) void qc.invalidateQueries({ queryKey: ['admin', 'vendors'] })
      refresh()
      toast(`Đã ghi nhận thanh toán bảng kê ${s.code}${unlock ? ' và mở khóa tài khoản nhà cung cấp' : ''}${unhide ? ' và hiện lại hồ sơ nhà cung cấp' : ''}.`)
    },
  })
}

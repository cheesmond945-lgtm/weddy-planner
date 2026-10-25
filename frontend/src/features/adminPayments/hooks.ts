import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/admin'
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

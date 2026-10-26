import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commissionsApi } from '@/api/commissions'
import { toast } from '@/components/ui/toast'
import { formatMoney } from '@/lib/format'
import { useAuth } from '@/store/auth'
import type { CommissionStatement } from '@/types/commission'
import { formatPeriod } from './calc'

const keys = {
  all: (uid: string | undefined) => ['vendor-commissions', uid] as const,
  lines: (uid: string | undefined, id: string) => ['vendor-commissions', uid, 'lines', id] as const,
}

function useVendorId() {
  const { user } = useAuth()
  return user?.role === 'VENDOR' ? user.id : undefined
}

/**
 * Tỷ lệ hiện tại và các bảng kê, mới nhất trước. Bảng kê cộng dồn khi đơn hoàn tất (ở Tin nhắn, Quản lý đơn hàng),
 * nên mở trang là tải lại.
 */
export function useCommissions() {
  const uid = useVendorId()
  return useQuery({ queryKey: keys.all(uid), queryFn: commissionsApi.list, enabled: !!uid, refetchOnMount: 'always' })
}

/** Hoa hồng từng đơn của một bảng kê (bảng kê 0 đơn thì không cần tải). */
export function useCommissionLines(statementId: string | null, enabled = true) {
  const uid = useVendorId()
  return useQuery({ queryKey: keys.lines(uid, statementId ?? ''), queryFn: () => commissionsApi.lines(statementId!), enabled: !!uid && !!statementId && enabled })
}

/** Nộp hoa hồng cả bảng kê. Dữ liệu thật: chuyển sang VNPay; dữ liệu giả: nộp xong ngay. */
export function usePayStatement() {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (s: CommissionStatement) => commissionsApi.pay(s.id).then((r) => ({ ...r, source: s })),
    onSuccess: ({ paymentUrl, statement, source }) => {
      if (paymentUrl) {
        window.location.href = paymentUrl
        return
      }
      void qc.invalidateQueries({ queryKey: keys.all(uid) })
      toast(`Đã nộp ${formatMoney((statement ?? source).totalAmount)} hoa hồng kỳ ${formatPeriod(source.periodMonth)}.`)
    },
    onError: (e) => toast(e.message),
  })
}

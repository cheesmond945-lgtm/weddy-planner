import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { commissionsApi } from '@/api/commissions'
import { toast } from '@/components/ui/toast'
import { formatMoney } from '@/lib/format'
import { useAuth } from '@/store/auth'
import type { CommissionStatement, SubmitCommissionPaymentBody } from '@/types/commission'

const keys = {
  all: (uid: string | undefined) => ['vendor-commissions', uid] as const,
  detail: (uid: string | undefined, id: string) => ['vendor-commissions', uid, id] as const,
}

function useVendorId() {
  const { user } = useAuth()
  return user?.role === 'VENDOR' ? user.id : undefined
}

// Bảng kê tính từ khoản thu của đơn (đổi ở Tin nhắn, Quản lý đơn hàng): mở trang là tải lại
const fresh = { refetchOnMount: 'always' as const }

/** Danh sách bảng kê, mới nhất trước (kỳ hiện tại đang tạm tính ở đầu). */
export function useCommissionStatements() {
  const uid = useVendorId()
  return useQuery({ queryKey: keys.all(uid), queryFn: commissionsApi.list, enabled: !!uid, ...fresh })
}

export function useCommissionStatement(id: string | null) {
  const uid = useVendorId()
  return useQuery({ queryKey: keys.detail(uid, id ?? ''), queryFn: () => commissionsApi.get(id!), enabled: !!uid && !!id, ...fresh })
}

function useSync() {
  const uid = useVendorId()
  const qc = useQueryClient()
  return (s: CommissionStatement) => {
    qc.setQueryData(keys.detail(uid, s.id), s)
    void qc.invalidateQueries({ queryKey: keys.all(uid), exact: true })
  }
}

export function useSubmitCommissionPayment(id: string) {
  const sync = useSync()
  return useMutation({
    mutationFn: (body: SubmitCommissionPaymentBody) => commissionsApi.submitPayment(id, body),
    onSuccess: (s, body) => {
      sync(s)
      toast(`Đã gửi minh chứng ${formatMoney(body.amount)} cho kỳ ${s.code}. Chờ WebPlan xác nhận.`)
    },
  })
}

/** Bấm "Thanh toán": lấy mã QR VietQR để hiện trong hộp thoại. */
export function usePayCommission() {
  return useMutation({
    mutationFn: (id: string) => commissionsApi.pay(id),
    onError: (e) => toast(e.message),
  })
}

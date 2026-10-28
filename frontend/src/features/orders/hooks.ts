import { useMutation, useQuery } from '@tanstack/react-query'
import { ordersApi, paymentsApi } from '@/api/orders'
import { toast } from '@/components/ui/toast'
import { planningKeys, useRefreshPlanning } from '@/features/weddings/hooks'
import { useLivePoll } from '@/lib/realtime'
import { useAuth } from '@/store/auth'
import type { PaymentMethod, RevisionChangeType } from '@/types/order'

/** Khóa cache danh sách đơn của khách trên trang Kế hoạch (đơn lẻ dùng planningKeys.order). */
export const coupleOrderKeys = {
  all: (uid?: string) => ['orders', uid] as const,
}

export function useOrder(id: string, options?: { poll?: boolean }) {
  const { user } = useAuth()
  const poll = useLivePoll(5000)
  return useQuery({
    queryKey: planningKeys.order(user?.id, id),
    queryFn: () => ordersApi.get(id),
    enabled: !!id && user?.role === 'COUPLE',
    refetchInterval: options?.poll ? poll : false,
  })
}

/** Mọi đơn NCC đã gửi cho khách (trang Kế hoạch của tôi, theo hạng mục). Đơn mới, đơn đổi trạng thái hiện ngay nhờ realtime. */
export function useMyOrders() {
  const { user } = useAuth()
  const poll = useLivePoll(30_000)
  return useQuery({
    queryKey: coupleOrderKeys.all(user?.id),
    queryFn: ordersApi.list,
    enabled: user?.role === 'COUPLE',
    refetchInterval: poll,
  })
}

export function useRequestRevision() {
  const refresh = useRefreshPlanning()
  return useMutation({
    mutationFn: ({ orderId, changes, note }: { orderId: string; changes: RevisionChangeType[]; note: string }) => ordersApi.requestRevision(orderId, { changes, note }),
    onSuccess: () => {
      toast('Đã gửi yêu cầu chỉnh sửa cho nhà cung cấp')
      void refresh()
    },
    onError: (e) => toast(e.message),
  })
}

export function useCreateDeposit() {
  return useMutation({
    mutationFn: ({ orderId, method }: { orderId: string; method: PaymentMethod }) => paymentsApi.createDeposit(orderId, method),
  })
}

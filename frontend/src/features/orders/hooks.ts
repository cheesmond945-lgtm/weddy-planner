import { useMutation, useQuery } from '@tanstack/react-query'
import { ordersApi, paymentsApi } from '@/api/orders'
import { toast } from '@/components/ui/toast'
import { planningKeys, useRefreshPlanning } from '@/features/weddings/hooks'
import { useAuth } from '@/store/auth'

export function useOrder(id: string, options?: { poll?: boolean }) {
  const { user } = useAuth()
  return useQuery({
    queryKey: planningKeys.order(user?.id, id),
    queryFn: () => ordersApi.get(id),
    enabled: !!id && user?.role === 'COUPLE',
    refetchInterval: options?.poll ? 2500 : false,
  })
}

/** Dịch vụ của đơn (trang thanh toán cọc): không phụ thuộc NCC có đang hiển thị trong danh mục hay không. */
export function useOrderService(orderId: string) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['order-service', user?.id, orderId] as const, queryFn: () => ordersApi.getService(orderId), enabled: !!orderId && user?.role === 'COUPLE' })
}

export function useRequestRevision() {
  const refresh = useRefreshPlanning()
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note: string }) => ordersApi.requestRevision(orderId, note),
    onSuccess: () => {
      toast('Đã gửi yêu cầu chỉnh sửa cho nhà cung cấp')
      void refresh()
    },
  })
}

export function useCreateDeposit() {
  return useMutation({
    mutationFn: (orderId: string) => paymentsApi.createDeposit(orderId),
  })
}

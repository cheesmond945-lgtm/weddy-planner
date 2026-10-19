import { useMutation, useQueryClient } from '@tanstack/react-query'
import { serviceOrdersApi } from '@/api/serviceOrders'
import { toast } from '@/components/ui/toast'
import { vendorChatKeys } from '@/features/vendorChat/keys'
import { useAuth } from '@/store/auth'
import type { OrderContent, ServiceOrder } from '@/types/serviceOrder'

/** Sau khi đơn đổi: cập nhật đơn trong cache, tải lại đơn, tin và danh sách hội thoại. */
function useSyncOrder() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return (o: ServiceOrder) => {
    qc.setQueryData(vendorChatKeys.order(user?.id, o.id), o)
    qc.setQueryData<ServiceOrder[]>(vendorChatKeys.orders(user?.id, o.conversationId), (list = []) =>
      list.some((x) => x.id === o.id) ? list.map((x) => (x.id === o.id ? o : x)) : [...list, o],
    )
    void qc.invalidateQueries({ queryKey: vendorChatKeys.messages(user?.id, o.conversationId) })
    void qc.invalidateQueries({ queryKey: vendorChatKeys.conversations(user?.id) })
  }
}

type SaveInput =
  /** Đơn mới trong hội thoại */
  | { orderId: null; conversationId: string; content: OrderContent; send: boolean; baseVersion: null }
  /** Bản nháp hoặc đơn đã gửi */
  | { orderId: string; conversationId: string; content: OrderContent; send: boolean; baseVersion: number | null }

/**
 * Lưu nháp hoặc gửi đơn từ form đơn trong chat.
 * Đơn mới: tạo (nháp hoặc gửi luôn v1). Đơn đã có: lưu bản nháp, hoặc gửi (v1 hay phiên bản mới).
 */
export function useSaveOrder() {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: (i: SaveInput) =>
      i.orderId === null
        ? serviceOrdersApi.create({ conversationId: i.conversationId, content: i.content, send: i.send })
        : i.send
          ? serviceOrdersApi.send(i.orderId, { content: i.content, baseVersion: i.baseVersion })
          : serviceOrdersApi.saveDraft(i.orderId, i.content),
    onSuccess: (o, i) => {
      sync(o)
      const v = o.versions[o.versions.length - 1]?.version
      toast(!i.send ? `Đã lưu nháp ${o.code}, chỉ bạn nhìn thấy, chưa gửi cho khách.` : v === 1 ? `Đã gửi đơn ${o.code} cho khách.` : `Đã gửi lại ${o.code} · v${v} cho khách.`)
    },
  })
}

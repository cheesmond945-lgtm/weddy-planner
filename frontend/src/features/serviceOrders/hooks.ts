import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { serviceOrdersApi } from '@/api/serviceOrders'
import { toast } from '@/components/ui/toast'
import { vendorChatKeys } from '@/features/vendorChat/keys'
import { useAuth } from '@/store/auth'
import { formatMoney } from '@/lib/format'
import type { OrderContent, OrderListQuery, ProposeAdjustmentBody, RecordPaymentBody, ServiceOrder } from '@/types/serviceOrder'

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
    void qc.invalidateQueries({ queryKey: vendorChatKeys.orderLists(user?.id) })
    void qc.invalidateQueries({ queryKey: vendorChatKeys.orderCounts(user?.id) })
  }
}

function useVendorId() {
  const { user } = useAuth()
  return user?.role === 'VENDOR' ? user.id : undefined
}

/** Danh sách đơn (trang Quản lý đơn hàng); giữ trang cũ khi đổi bộ lọc để bảng không nháy. */
export function useOrders(query: OrderListQuery) {
  const uid = useVendorId()
  return useQuery({
    queryKey: [...vendorChatKeys.orderLists(uid), query],
    queryFn: () => serviceOrdersApi.list(query),
    enabled: !!uid,
    placeholderData: keepPreviousData,
  })
}

export function useOrderCounts() {
  const uid = useVendorId()
  return useQuery({ queryKey: vendorChatKeys.orderCounts(uid), queryFn: serviceOrdersApi.counts, enabled: !!uid })
}

/** Một đơn (mở thẳng qua /vendor/orders?order=…). */
export function useOrder(orderId: string | null) {
  const uid = useVendorId()
  return useQuery({
    queryKey: vendorChatKeys.order(uid, orderId ?? ''),
    queryFn: () => serviceOrdersApi.get(orderId!),
    enabled: !!uid && !!orderId,
  })
}

export function useRecordPayment(orderId: string) {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: (body: RecordPaymentBody) => serviceOrdersApi.recordPayment(orderId, body),
    onSuccess: (o, body) => {
      sync(o)
      toast(`Đã ghi nhận ${formatMoney(body.amount)} cho ${o.code}.`)
    },
  })
}

export function useProposeAdjustment(orderId: string) {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: (body: ProposeAdjustmentBody) => serviceOrdersApi.proposeAdjustment(orderId, body),
    onSuccess: (o, body) => {
      sync(o)
      toast(body.revisionOf ? `Đã gửi lại phương án điều chỉnh ${o.code}.` : `Đã gửi phương án điều chỉnh ${o.code} cho khách.`)
    },
  })
}

export function useCancelOrder(orderId: string) {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: (reason: string) => serviceOrdersApi.cancel(orderId, reason),
    onSuccess: (o) => {
      sync(o)
      toast(`Đã hủy đơn ${o.code}.`)
    },
  })
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

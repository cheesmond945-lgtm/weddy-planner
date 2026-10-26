import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorOrdersApi } from '@/api/vendorOrders'
import { toast } from '@/components/ui/toast'
import { vendorKeys } from '@/features/vendorOrders/keys'
import { useAuth } from '@/store/auth'
import type { Order, OrderContent, OrderListQuery } from '@/types/vendorOrder'

// Chưa có websocket: hỏi lại định kỳ khi đang mở khung chat (đơn đổi trạng thái khi khách cọc, hết hạn…)
const POLL_MS = 2500

function useVendorId() {
  const { user } = useAuth()
  return user?.role === 'VENDOR' ? user.id : undefined
}

/** Sau khi đơn đổi: cập nhật đơn trong cache, tải lại tin, hội thoại, danh sách và số đếm. */
export function useSyncOrder() {
  const uid = useVendorId()
  const qc = useQueryClient()
  return (o: Order) => {
    qc.setQueryData(vendorKeys.order(uid, o.id), o)
    qc.setQueryData<Order[]>(vendorKeys.orders(uid, o.conversationId), (list = []) =>
      list.some((x) => x.id === o.id) ? list.map((x) => (x.id === o.id ? o : x)) : [o, ...list],
    )
    void qc.invalidateQueries({ queryKey: vendorKeys.messages(uid, o.conversationId) })
    void qc.invalidateQueries({ queryKey: vendorKeys.conversations(uid) })
    void qc.invalidateQueries({ queryKey: vendorKeys.orderLists(uid) })
    void qc.invalidateQueries({ queryKey: vendorKeys.orderCounts(uid) })
  }
}

/** Đơn của một hội thoại (gồm bản nháp), để vẽ thẻ đơn trong chat. */
export function useConversationOrders(conversationId: string | null) {
  const uid = useVendorId()
  return useQuery({
    queryKey: vendorKeys.orders(uid, conversationId ?? ''),
    queryFn: () => vendorOrdersApi.listByConversation(conversationId!),
    enabled: !!uid && !!conversationId,
    refetchInterval: POLL_MS,
  })
}

/** Danh sách đơn (trang Quản lý đơn hàng); giữ trang cũ khi đổi bộ lọc để bảng không nháy. */
export function useOrders(query: OrderListQuery) {
  const uid = useVendorId()
  return useQuery({
    queryKey: [...vendorKeys.orderLists(uid), query],
    queryFn: () => vendorOrdersApi.list(query),
    enabled: !!uid,
    placeholderData: keepPreviousData,
  })
}

export function useOrderCounts() {
  const uid = useVendorId()
  return useQuery({ queryKey: vendorKeys.orderCounts(uid), queryFn: vendorOrdersApi.counts, enabled: !!uid })
}

/** Một đơn (mở thẳng qua /vendor/orders?order=…). */
export function useOrder(orderId: string | null) {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useQuery({
    queryKey: vendorKeys.order(uid, orderId ?? ''),
    queryFn: () => vendorOrdersApi.get(orderId!),
    enabled: !!uid && !!orderId,
    // Đơn đã có trong danh sách thì mở ngay, bản mới tải ngầm sau
    initialData: () => {
      for (const [, page] of qc.getQueriesData<{ data: Order[] }>({ queryKey: vendorKeys.orderLists(uid) })) {
        const hit = page?.data?.find((o) => o.id === orderId)
        if (hit) return hit
      }
      return undefined
    },
  })
}

export type SaveOrderInput =
  | { kind: 'create'; conversationId: string; content: OrderContent; send: boolean }
  | { kind: 'draft'; orderId: string; content: OrderContent }
  | { kind: 'send'; orderId: string; content: OrderContent; resend: boolean }
  | { kind: 'edit'; orderId: string; content: OrderContent }

/**
 * Lưu nháp, gửi đơn, "Cập nhật đơn" hoặc sửa sau cọc từ form đơn trong chat.
 * create: đơn mới (nháp hoặc gửi luôn). draft: lưu bản nháp. send: gửi bản nháp, hoặc sửa và gửi lại đơn đang chờ cọc / chờ chỉnh sửa.
 * edit: sửa đơn đã cọc.
 */
export function useSaveOrder() {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: (i: SaveOrderInput) => {
      switch (i.kind) {
        case 'create':
          return vendorOrdersApi.create({ conversationId: i.conversationId, content: i.content, send: i.send })
        case 'draft':
          return vendorOrdersApi.saveDraft(i.orderId, i.content)
        case 'send':
          return vendorOrdersApi.send(i.orderId, i.content)
        case 'edit':
          return vendorOrdersApi.edit(i.orderId, i.content)
      }
    },
    onSuccess: (o, i) => {
      sync(o)
      const draft = i.kind === 'draft' || (i.kind === 'create' && !i.send)
      toast(
        draft
          ? `Đã lưu nháp ${o.orderCode}, chỉ bạn nhìn thấy, chưa gửi cho khách.`
          : i.kind === 'edit'
            ? `Đã cập nhật đơn ${o.orderCode}.`
            : i.kind === 'send' && i.resend
              ? `Đã cập nhật đơn ${o.orderCode}, hạn cọc mới là 24 giờ.`
              : `Đã gửi đơn ${o.orderCode} cho khách, hạn cọc 24 giờ.`,
      )
    },
  })
}

/** Hoàn tất đơn. */
export function useCompleteOrder() {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: (orderId: string) => vendorOrdersApi.complete(orderId),
    onSuccess: (o) => {
      sync(o)
      toast(`Đã hoàn tất đơn ${o.orderCode}. Hoa hồng được tính vào bảng kê tháng này.`)
    },
    onError: (e) => toast(e.message),
  })
}

/** Xuất hóa đơn. */
export function useIssueFinalInvoice() {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: (orderId: string) => vendorOrdersApi.issueFinalInvoice(orderId),
    onSuccess: (o) => {
      sync(o)
      toast(`Đã xuất hóa đơn cho đơn ${o.orderCode} và gửi vào cuộc trò chuyện.`)
    },
    onError: (e) => toast(e.message),
  })
}

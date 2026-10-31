import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorOrdersApi } from '@/api/vendorOrders'
import { toast } from '@/components/ui/toast'
import { vendorKeys } from '@/features/vendorOrders/keys'
import { toISODate, today } from '@/lib/date'
import { useLivePoll } from '@/lib/realtime'
import { useAuth } from '@/store/auth'
import type { BoardTask, CancelReason, Order, OrderContent, OrderListQuery } from '@/types/vendorOrder'

// Có realtime thì đơn đổi trạng thái (khách cọc, hết hạn…) được đẩy tới; mất kết nối thì hỏi lại định kỳ khi đang mở khung chat
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
    // Hoàn thành / hủy / sửa ngày thực hiện đổi việc của đơn; hủy / sửa ngày, đổi sảnh đổi lịch bận theo sảnh
    void qc.invalidateQueries({ queryKey: vendorKeys.taskBoard(uid) })
    void qc.invalidateQueries({ queryKey: ['vendor', uid, 'busy'] })
  }
}

/** Đơn của một hội thoại (gồm bản nháp), để vẽ thẻ đơn trong chat. */
export function useConversationOrders(conversationId: string | null) {
  const uid = useVendorId()
  const poll = useLivePoll(POLL_MS)
  return useQuery({
    queryKey: vendorKeys.orders(uid, conversationId ?? ''),
    queryFn: () => vendorOrdersApi.listByConversation(conversationId!),
    enabled: !!uid && !!conversationId,
    refetchInterval: poll,
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
  | { kind: 'edit'; orderId: string; content: OrderContent; changeNote: string }

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
          return vendorOrdersApi.edit(i.orderId, i.content, i.changeNote)
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

/** NCC hủy đơn đã cọc (trước ngày sự kiện), kèm lý do. */
export function useCancelOrder() {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: ({ orderId, reason, note }: { orderId: string; reason: CancelReason; note: string }) => vendorOrdersApi.cancel(orderId, { reason, note: note || undefined }),
    onSuccess: (o) => {
      sync(o)
      toast(`Đã hủy đơn ${o.orderCode}.`)
    },
    onError: (e) => toast(e.message),
  })
}

/** Từ chối yêu cầu chỉnh sửa của khách với đơn đã cọc. */
export function useRejectRevision() {
  const sync = useSyncOrder()
  return useMutation({
    mutationFn: ({ orderId, note }: { orderId: string; note: string }) => vendorOrdersApi.rejectRevision(orderId, note || undefined),
    onSuccess: (o) => {
      sync(o)
      toast(`Đã từ chối yêu cầu chỉnh sửa đơn ${o.orderCode}. Đơn giữ nguyên.`)
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

/** "Tiến độ đơn" của một đơn đã cọc (việc chi tiết gắn với đơn). */
export function useOrderTasks(orderId: string | null, enabled = true) {
  const uid = useVendorId()
  return useQuery({
    queryKey: vendorKeys.orderTasks(uid, orderId ?? ''),
    queryFn: () => vendorOrdersApi.tasks(orderId!),
    enabled: !!uid && !!orderId && enabled,
  })
}

/** NCC tick / bỏ tick việc của mình; khách thấy ngay vì dùng chung bảng việc. */
export function useSetOrderTask(orderId: string) {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { taskId: string; isDone: boolean }) => vendorOrdersApi.setTaskDone(orderId, v.taskId, v.isDone),
    onSuccess: (data) => {
      qc.setQueryData(vendorKeys.orderTasks(uid, orderId), data)
      void qc.invalidateQueries({ queryKey: vendorKeys.orderProgress(uid) })
      void qc.invalidateQueries({ queryKey: vendorKeys.calendar(uid) })
      void qc.invalidateQueries({ queryKey: vendorKeys.taskBoard(uid) })
    },
    onError: (e: unknown) => toast(e instanceof Error ? e.message : 'Không cập nhật được việc.'),
  })
}

/** Tiến độ tóm tắt của mọi đơn đang thực hiện ({ [orderId]: OrderProgress }), để hiện nhãn "Trễ tiến độ". */
export function useOrderProgress() {
  const uid = useVendorId()
  return useQuery({ queryKey: vendorKeys.orderProgress(uid), queryFn: vendorOrdersApi.progress, enabled: !!uid, staleTime: 60_000 })
}

/** Bảng việc (kanban): mọi việc của các đơn đang thực hiện. */
export function useTaskBoard() {
  const uid = useVendorId()
  return useQuery({ queryKey: vendorKeys.taskBoard(uid), queryFn: vendorOrdersApi.board, enabled: !!uid })
}

/** Kéo thả trên Bảng việc: thẻ đổi cột ngay (cập nhật lạc quan), lỗi thì trả thẻ về chỗ cũ kèm thông báo. */
export function useMoveBoardTask() {
  const uid = useVendorId()
  const qc = useQueryClient()
  const key = vendorKeys.taskBoard(uid)
  return useMutation({
    mutationFn: (v: { orderId: string; taskId: string; isDone: boolean }) => vendorOrdersApi.setTaskDone(v.orderId, v.taskId, v.isDone),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<BoardTask[]>(key)
      const now = toISODate(today())
      qc.setQueryData<BoardTask[]>(key, (list) =>
        list?.map((t) => (t.id === v.taskId ? { ...t, isDone: v.isDone, completedDate: v.isDone ? new Date().toISOString() : null, overdue: !v.isDone && !!t.dueDate && t.dueDate < now } : t)),
      )
      return { prev }
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
      toast(e instanceof Error ? e.message : 'Không cập nhật được việc.')
    },
    onSuccess: (data, v) => qc.setQueryData(vendorKeys.orderTasks(uid, v.orderId), data),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: key })
      void qc.invalidateQueries({ queryKey: vendorKeys.orderProgress(uid) })
      void qc.invalidateQueries({ queryKey: vendorKeys.calendar(uid) })
    },
  })
}

/** Lịch làm việc trong khoảng ngày của lưới tháng đang xem. */
export function useVendorCalendar(from: string, to: string) {
  const uid = useVendorId()
  return useQuery({
    queryKey: vendorKeys.calendar(uid, from, to),
    queryFn: () => vendorOrdersApi.calendar(from, to),
    enabled: !!uid,
    placeholderData: keepPreviousData,
  })
}

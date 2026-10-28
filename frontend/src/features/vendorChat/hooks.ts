import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vendorConversationsApi } from '@/api/vendorConversations'
import { toast } from '@/components/ui/toast'
import { vendorKeys } from '@/features/vendorOrders/keys'
import { advanceClock, resetClock } from '@/lib/clock'
import { useLivePoll } from '@/lib/realtime'
import { useAuth } from '@/store/auth'
import type { CustomerSimulation, VendorMessage } from '@/types/vendorConversation'

// Có realtime (lib/realtime.ts) thì dữ liệu được đẩy tới; mất kết nối thì hỏi lại định kỳ khi đang mở trang Tin nhắn, như phía cặp đôi (5 giây)
const POLL_MS = 5000

function useVendorId() {
  const { user } = useAuth()
  return user?.role === 'VENDOR' ? user.id : undefined
}

/** pollMs: chu kỳ hỏi lại khi chưa có realtime (trang Tin nhắn 5 giây). */
export function useVendorConversations(pollMs = POLL_MS) {
  const uid = useVendorId()
  const poll = useLivePoll(pollMs)
  return useQuery({ queryKey: vendorKeys.conversations(uid), queryFn: vendorConversationsApi.list, enabled: !!uid, refetchInterval: poll })
}

/** Tổng số tin chưa đọc bằng endpoint riêng (nhẹ hơn tải cả danh sách), hỏi lại 15 giây; React Query dừng khi tab bị ẩn. */
export function useUnreadQuery() {
  const uid = useVendorId()
  const poll = useLivePoll(15_000)
  return useQuery({ queryKey: vendorKeys.unread(uid), queryFn: vendorConversationsApi.unreadCount, enabled: !!uid, refetchInterval: poll })
}

/** Tổng số tin chưa đọc (mục "Tin nhắn" trên sidebar, tiêu đề tab). */
export function useUnreadCount() {
  return useUnreadQuery().data ?? 0
}

export function useVendorMessages(conversationId: string | null) {
  const uid = useVendorId()
  const poll = useLivePoll(POLL_MS)
  return useQuery({
    queryKey: vendorKeys.messages(uid, conversationId ?? ''),
    queryFn: () => vendorConversationsApi.listMessages(conversationId!),
    enabled: !!uid && !!conversationId,
    refetchInterval: poll,
  })
}

/** Đánh dấu đã đọc khi mở hội thoại hoặc khi có tin mới lúc đang mở. */
export function useMarkRead() {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vendorConversationsApi.markRead,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: vendorKeys.conversations(uid) })
      void qc.invalidateQueries({ queryKey: vendorKeys.unread(uid) })
    },
  })
}

export function useSendVendorMessage(conversationId: string) {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => vendorConversationsApi.send(conversationId, text),
    onSuccess: (msg) => {
      qc.setQueryData<VendorMessage[]>(vendorKeys.messages(uid, conversationId), (list = []) => [...list, msg])
      void qc.invalidateQueries({ queryKey: vendorKeys.conversations(uid) })
    },
    onError: (e) => toast(e.message),
  })
}

/** Tin mẫu nhờ khách điền thông tin đám cưới (nút "Nhắc khách"). */
export const WEDDING_REMINDER =
  'Chào anh/chị, để lên đơn dịch vụ cho nhà mình, anh/chị vui lòng điền thông tin đám cưới (ngày cưới, ngân sách, số khách…) ở mục Kế hoạch của tôi giúp bên em nhé. Em cảm ơn!'

/** "Nhắc khách": gửi tin mẫu nhờ khách điền thông tin đám cưới. Chỉ gửi một lần cho mỗi hội thoại. */
export function useWeddingReminder(conversationId: string) {
  const { data: messages } = useVendorMessages(conversationId)
  const send = useSendVendorMessage(conversationId)
  const reminded = !!messages?.some((m) => m.sender === 'VENDOR' && m.type === 'Text' && m.content === WEDDING_REMINDER)
  return {
    reminded,
    isPending: send.isPending,
    remind: () => send.mutate(WEDDING_REMINDER, { onSuccess: () => toast('Đã nhắc khách điền thông tin đám cưới.') }),
  }
}

/** CHỈ KHI DÙNG DỮ LIỆU GIẢ: giả lập khách, xong tải lại hội thoại, tin, đơn. */
export function useSimulateCustomer(conversationId: string) {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (sim: CustomerSimulation) => vendorConversationsApi.simulate(conversationId, sim),
    onSuccess: () => void qc.invalidateQueries({ queryKey: vendorKeys.all(uid) }),
    onError: (e) => toast(e.message),
  })
}

/** CHỈ KHI DÙNG DỮ LIỆU GIẢ: tua đồng hồ (giờ) để thử đơn hết hạn cọc, tự hoàn thành. hours = 0: về giờ thật. */
export function useAdvanceTime() {
  const uid = useVendorId()
  const qc = useQueryClient()
  return (hours: number) => {
    if (hours === 0) resetClock()
    else advanceClock(hours)
    void qc.invalidateQueries({ queryKey: vendorKeys.all(uid) })
    // Hoa hồng đổi theo đồng hồ: đơn tự hoàn tất, kỳ chuyển Chưa nộp / Quá hạn
    void qc.invalidateQueries({ queryKey: ['vendor-commissions'] })
  }
}

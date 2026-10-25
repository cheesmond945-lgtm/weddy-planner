import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { serviceOrdersApi } from '@/api/serviceOrders'
import { vendorChatApi } from '@/api/vendorChat'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { CustomerSimulation, VendorMessage } from '@/types/vendorChat'
import { vendorChatKeys } from './keys'

// Chưa có websocket (docs/api/chat.md): hỏi lại định kỳ khi đang mở trang Tin nhắn, như phía cặp đôi
const POLL_MS = 2500

function useVendorId() {
  const { user } = useAuth()
  return user?.role === 'VENDOR' ? user.id : undefined
}

/** pollMs: trang Tin nhắn hỏi lại mỗi 2,5 giây; sidebar (số chưa đọc) thưa hơn. */
export function useVendorConversations(pollMs = POLL_MS) {
  const uid = useVendorId()
  return useQuery({ queryKey: vendorChatKeys.conversations(uid), queryFn: vendorChatApi.listConversations, enabled: !!uid, refetchInterval: pollMs })
}

/** Tổng số tin chưa đọc (mục "Tin nhắn" trên sidebar). */
export function useUnreadCount() {
  const { data } = useVendorConversations(15_000)
  return data?.reduce((s, c) => s + c.unreadCount, 0) ?? 0
}

export function useVendorMessages(conversationId: string | null) {
  const uid = useVendorId()
  return useQuery({
    queryKey: vendorChatKeys.messages(uid, conversationId ?? ''),
    queryFn: () => vendorChatApi.listMessages(conversationId!),
    enabled: !!uid && !!conversationId,
    refetchInterval: POLL_MS,
  })
}

/** Đơn của hội thoại (gồm bản nháp), để vẽ thẻ đơn và dải "bản nháp chưa gửi". */
export function useConversationOrders(conversationId: string | null) {
  const uid = useVendorId()
  return useQuery({
    queryKey: vendorChatKeys.orders(uid, conversationId ?? ''),
    queryFn: () => serviceOrdersApi.listByConversation(conversationId!),
    enabled: !!uid && !!conversationId,
    refetchInterval: POLL_MS,
  })
}

/** Đánh dấu đã đọc khi mở hội thoại hoặc khi có tin mới lúc đang mở. */
export function useMarkRead() {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: vendorChatApi.markRead,
    onSuccess: () => void qc.invalidateQueries({ queryKey: vendorChatKeys.conversations(uid) }),
  })
}

export function useSendVendorMessage(conversationId: string) {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => vendorChatApi.send(conversationId, text),
    onSuccess: (msg) => {
      qc.setQueryData<VendorMessage[]>(vendorChatKeys.messages(uid, conversationId), (list = []) => [...list, msg])
      void qc.invalidateQueries({ queryKey: vendorChatKeys.conversations(uid) })
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
  const reminded = !!messages?.some((m) => m.sender === 'VENDOR' && m.type === 'TEXT' && m.text === WEDDING_REMINDER)
  return {
    reminded,
    isPending: send.isPending,
    remind: () => send.mutate(WEDDING_REMINDER, { onSuccess: () => toast('Đã nhắc khách điền thông tin đám cưới.') }),
  }
}

/** CHỈ KHI DÙNG MOCK: giả lập khách, xong tải lại hội thoại, tin, đơn. */
export function useSimulateCustomer(conversationId: string) {
  const uid = useVendorId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (action: CustomerSimulation) => vendorChatApi.simulate(conversationId, action),
    onSuccess: () => void qc.invalidateQueries({ queryKey: vendorChatKeys.all(uid) }),
    onError: (e) => toast(e.message),
  })
}

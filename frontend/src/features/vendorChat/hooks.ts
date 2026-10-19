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

export function useVendorConversations() {
  const uid = useVendorId()
  return useQuery({ queryKey: vendorChatKeys.conversations(uid), queryFn: vendorChatApi.listConversations, enabled: !!uid, refetchInterval: POLL_MS })
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

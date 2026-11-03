import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { chatApi } from '@/api/chat'
import { toast } from '@/components/ui/toast'
import { planningKeys } from '@/features/weddings/hooks'
import { useLivePoll } from '@/lib/realtime'
import { useAuth } from '@/store/auth'
import type { Message } from '@/types/chat'

// Có realtime (lib/realtime.ts) thì dữ liệu được đẩy tới; mất kết nối thì hỏi lại định kỳ khi đang mở khung chat (5 giây, như phía NCC)
const POLL_MS = 5000

function useCoupleId() {
  const { user } = useAuth()
  return user?.role === 'COUPLE' ? user.id : undefined
}

export function useConversations(options?: { poll?: boolean }) {
  const uid = useCoupleId()
  const poll = useLivePoll(POLL_MS)
  return useQuery({
    queryKey: planningKeys.conversations(uid),
    queryFn: chatApi.listConversations,
    enabled: !!uid,
    refetchInterval: options?.poll ? poll : false,
  })
}

export function useMessages(conversationId: string) {
  const uid = useCoupleId()
  const poll = useLivePoll(POLL_MS)
  return useQuery({
    queryKey: planningKeys.messages(uid, conversationId),
    queryFn: () => chatApi.listMessages(conversationId),
    enabled: !!uid && !!conversationId,
    refetchInterval: poll,
  })
}

export function useSendMessage(conversationId: string) {
  const uid = useCoupleId()
  const qc = useQueryClient()
  const key = planningKeys.messages(uid, conversationId)
  return useMutation({
    mutationFn: (text: string) => chatApi.send(conversationId, text),
    onSuccess: (msg) => {
      qc.setQueryData<Message[]>(key, (list = []) => [...list, msg])
      void qc.invalidateQueries({ queryKey: planningKeys.conversations(uid) })
      // NCC thường trả lời sau khoảng 1 giây: hỏi lại sớm hơn chu kỳ thường
      setTimeout(() => void qc.invalidateQueries({ queryKey: key }), 1200)
    },
    onError: (e) => toast(e.message),
  })
}

// Badge tin chưa đọc trên nút chat nổi và menu tài khoản: hỏi lại thưa hơn khung chat
const UNREAD_POLL_MS = 30_000

/** Tổng số tin NCC gửi mà khách chưa đọc (badge trên nút chat / mục Tin nhắn). */
export function useUnreadMessages() {
  const uid = useCoupleId()
  const poll = useLivePoll(UNREAD_POLL_MS)
  const { data } = useQuery({
    queryKey: planningKeys.conversations(uid),
    queryFn: chatApi.listConversations,
    enabled: !!uid,
    refetchInterval: poll,
  })
  return data?.reduce((sum, c) => sum + (c.unreadCount ?? 0), 0) ?? 0
}

/** Đánh dấu đã đọc khi khách đang xem hội thoại và có tin mới của NCC. */
export function useMarkReadOnView(conversationId: string, messages: Message[]) {
  const uid = useCoupleId()
  const qc = useQueryClient()
  const last = messages.at(-1)
  const lastVendorId = last && last.sender !== 'COUPLE' ? last.id : null
  useEffect(() => {
    if (!uid || !conversationId || !lastVendorId) return
    void chatApi.markRead(conversationId).then(() => qc.invalidateQueries({ queryKey: planningKeys.conversations(uid) }))
  }, [uid, qc, conversationId, lastVendorId])
}

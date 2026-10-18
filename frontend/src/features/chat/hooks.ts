import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '@/api/chat'
import { toast } from '@/components/ui/toast'
import { planningKeys } from '@/features/weddings/hooks'
import { useAuth } from '@/store/auth'
import type { Message } from '@/types/chat'

// Chưa có thư viện websocket trong danh sách được dùng: hỏi lại định kỳ khi đang mở khung chat
const POLL_MS = 2500

function useCoupleId() {
  const { user } = useAuth()
  return user?.role === 'COUPLE' ? user.id : undefined
}

export function useConversations(options?: { poll?: boolean }) {
  const uid = useCoupleId()
  return useQuery({
    queryKey: planningKeys.conversations(uid),
    queryFn: chatApi.listConversations,
    enabled: !!uid,
    refetchInterval: options?.poll ? POLL_MS : false,
  })
}

export function useMessages(conversationId: string) {
  const uid = useCoupleId()
  return useQuery({
    queryKey: planningKeys.messages(uid, conversationId),
    queryFn: () => chatApi.listMessages(conversationId),
    enabled: !!uid && !!conversationId,
    refetchInterval: POLL_MS,
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

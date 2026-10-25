import type { Conversation, Message } from '@/types/chat'
import { http } from './client'

/** Hợp đồng: docs/api/chat.md */
export const chatApi = {
  listConversations: (): Promise<Conversation[]> => (http.get('/conversations')),
  start: (serviceId: string, replace = false): Promise<Conversation> =>
    http.post('/conversations', { serviceId, replace }),
  listMessages: (conversationId: string): Promise<Message[]> =>
    http.get(`/conversations/${conversationId}/messages`),
  send: (conversationId: string, text: string): Promise<Message> =>
    http.post(`/conversations/${conversationId}/messages`, { text }),
}

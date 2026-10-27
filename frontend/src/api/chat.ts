import { mockChat } from '@/mocks/chat'
import type { Conversation, Message } from '@/types/chat'
import { http } from './client'
import { isMock, mockDelay } from './mock'

const mock = <T>(fn: () => T) => mockDelay(null, 200).then(fn)

/** Hợp đồng: docs/api/chat.md */
export const chatApi = {
  listConversations: (): Promise<Conversation[]> => (isMock('chat') ? mock(mockChat.listConversations) : http.get('/conversations')),
  start: (serviceId: string, replace = false): Promise<Conversation> =>
    isMock('chat') ? mock(() => mockChat.startConversation(serviceId, replace)) : http.post('/conversations', { serviceId, replace }),
  listMessages: (conversationId: string): Promise<Message[]> =>
    isMock('chat') ? mock(() => mockChat.listMessages(conversationId)) : http.get(`/conversations/${conversationId}/messages`),
  send: (conversationId: string, text: string): Promise<Message> =>
    isMock('chat') ? mock(() => mockChat.sendMessage(conversationId, text)) : http.post(`/conversations/${conversationId}/messages`, { text }),
  /** Khách đã xem hội thoại: các tin của NCC thành đã đọc (badge số tin chưa đọc giảm theo). */
  markRead: (conversationId: string): Promise<null> =>
    isMock('chat') ? mock(() => mockChat.markRead(conversationId)) : http.post(`/conversations/${conversationId}/read`),
}

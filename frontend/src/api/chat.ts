import { mockChat } from '@/mocks/chat'
import type { Conversation, Message } from '@/types/chat'
import { http } from './client'
import { USE_MOCK, mockDelay } from './mock'

const mock = <T>(fn: () => T) => mockDelay(null, 200).then(fn)

/** Hợp đồng: docs/api/chat.md */
export const chatApi = {
  listConversations: (): Promise<Conversation[]> => (USE_MOCK ? mock(mockChat.listConversations) : http.get('/conversations')),
  start: (serviceId: string, replace = false): Promise<Conversation> =>
    USE_MOCK ? mock(() => mockChat.startConversation(serviceId, replace)) : http.post('/conversations', { serviceId, replace }),
  listMessages: (conversationId: string): Promise<Message[]> =>
    USE_MOCK ? mock(() => mockChat.listMessages(conversationId)) : http.get(`/conversations/${conversationId}/messages`),
  send: (conversationId: string, text: string): Promise<Message> =>
    USE_MOCK ? mock(() => mockChat.sendMessage(conversationId, text)) : http.post(`/conversations/${conversationId}/messages`, { text }),
}

import type { VendorConversation, VendorMessage } from '@/types/vendorChat'
import { http } from './client'

/** Hợp đồng: docs/api/chat.md (phần Nhà cung cấp). */
export const vendorChatApi = {
  listConversations: (): Promise<VendorConversation[]> =>
    http.get('/vendors/me/conversations'),

  listMessages: (conversationId: string): Promise<VendorMessage[]> =>
    http.get(`/vendors/me/conversations/${conversationId}/messages`),

  markRead: (conversationId: string): Promise<null> =>
    http.post(`/vendors/me/conversations/${conversationId}/read`),

  send: (conversationId: string, text: string): Promise<VendorMessage> =>
    http.post(`/vendors/me/conversations/${conversationId}/messages`, { text }),

}

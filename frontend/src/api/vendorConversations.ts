import type { VendorConversation, VendorMessage } from '@/types/vendorConversation'
import { http } from './client'

/** Hội thoại và tin nhắn phía NCC. Hợp đồng: docs/api/chat.md (phần Nhà cung cấp). */
export const vendorConversationsApi = {
  list: (): Promise<VendorConversation[]> => http.get('/vendors/me/conversations'),

  /** Tổng số tin của khách chưa đọc ở mọi hội thoại (huy hiệu menu Tin nhắn, tiêu đề tab). */
  unreadCount: async (): Promise<number> => (await http.get<{ count: number }>('/vendors/me/conversations/unread-count')).count,

  listMessages: (conversationId: string): Promise<VendorMessage[]> => http.get(`/vendors/me/conversations/${conversationId}/messages`),

  markRead: (conversationId: string): Promise<null> => http.post(`/vendors/me/conversations/${conversationId}/read`),

  send: (conversationId: string, text: string): Promise<VendorMessage> => http.post(`/vendors/me/conversations/${conversationId}/messages`, { text }),
}

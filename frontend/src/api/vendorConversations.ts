import type { VendorConversation, VendorMessage } from '@/types/vendorConversation'
import { attachmentForm, type AttachmentInput } from './chat'
import { http } from './client'

/** Hội thoại và tin nhắn phía NCC. Hợp đồng: docs/api/chat.md (phần Nhà cung cấp). */
export const vendorConversationsApi = {
  list: (): Promise<VendorConversation[]> => http.get('/vendors/me/conversations'),

  /** Tổng số tin của khách chưa đọc ở mọi hội thoại (huy hiệu menu Tin nhắn, tiêu đề tab). */
  unreadCount: async (): Promise<number> => (await http.get<{ count: number }>('/vendors/me/conversations/unread-count')).count,

  listMessages: (conversationId: string): Promise<VendorMessage[]> => http.get(`/vendors/me/conversations/${conversationId}/messages`),

  markRead: (conversationId: string): Promise<null> => http.post(`/vendors/me/conversations/${conversationId}/read`),

  /** `replyToId`: tin được trả lời (cùng hội thoại) */
  send: (conversationId: string, text: string, replyToId?: string | null): Promise<VendorMessage> =>
    http.post(`/vendors/me/conversations/${conversationId}/messages`, { text, ...(replyToId && { replyToId }) }),

  /** Gửi ảnh / tệp / ghi âm */
  sendAttachment: (conversationId: string, input: AttachmentInput): Promise<VendorMessage> =>
    http.post(`/vendors/me/conversations/${conversationId}/attachments`, attachmentForm(input)),

  /** Thu hồi tin của chính mình với mọi người */
  recall: (conversationId: string, messageId: string): Promise<VendorMessage> => http.delete(`/vendors/me/conversations/${conversationId}/messages/${messageId}`),

  /** Thả / đổi cảm xúc; emoji null là gỡ cảm xúc của mình */
  react: (conversationId: string, messageId: string, emoji: string | null): Promise<VendorMessage> =>
    http.put(`/vendors/me/conversations/${conversationId}/messages/${messageId}/reaction`, { emoji }),
}

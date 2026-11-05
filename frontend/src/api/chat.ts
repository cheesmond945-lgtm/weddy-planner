import type { Conversation, Message } from '@/types/chat'
import { http } from './client'

/** Tệp gửi trong chat: `name` bắt buộc với ghi âm (Blob không có tên); `durationSec` cho ghi âm */
export interface AttachmentInput {
  file: Blob
  name: string
  replyToId?: string | null
  durationSec?: number
}

/** Body multipart cho POST …/attachments (dùng chung cặp đôi và NCC) */
export function attachmentForm({ file, name, replyToId, durationSec }: AttachmentInput) {
  const form = new FormData()
  form.append('file', file, name)
  if (replyToId) form.append('replyToId', replyToId)
  if (durationSec) form.append('durationSec', String(durationSec))
  return form
}

/** Hợp đồng: docs/api/chat.md */
export const chatApi = {
  listConversations: (): Promise<Conversation[]> => (http.get('/conversations')),
  start: (serviceId: string, replace = false): Promise<Conversation> =>
    http.post('/conversations', { serviceId, replace }),
  listMessages: (conversationId: string): Promise<Message[]> =>
    http.get(`/conversations/${conversationId}/messages`),
  /** `replyToId`: tin được trả lời (cùng hội thoại) */
  send: (conversationId: string, text: string, replyToId?: string | null): Promise<Message> =>
    http.post(`/conversations/${conversationId}/messages`, { text, ...(replyToId && { replyToId }) }),
  /** Gửi ảnh / tệp / ghi âm */
  sendAttachment: (conversationId: string, input: AttachmentInput): Promise<Message> => http.post(`/conversations/${conversationId}/attachments`, attachmentForm(input)),
  /** Thu hồi tin của chính mình với mọi người */
  recall: (conversationId: string, messageId: string): Promise<Message> => http.delete(`/conversations/${conversationId}/messages/${messageId}`),
  /** Thả / đổi cảm xúc; emoji null là gỡ cảm xúc của mình */
  react: (conversationId: string, messageId: string, emoji: string | null): Promise<Message> =>
    http.put(`/conversations/${conversationId}/messages/${messageId}/reaction`, { emoji }),
  /** Khách đã xem hội thoại: các tin của NCC thành đã đọc (badge số tin chưa đọc giảm theo). */
  markRead: (conversationId: string): Promise<null> => http.post(`/conversations/${conversationId}/read`),
}

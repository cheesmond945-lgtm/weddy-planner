/*
 * CHỜ ĐỐI CHIẾU docs/database.md. Hợp đồng: docs/api/chat.md
 */
import type { ServiceSummary } from './catalog'
import type { PlanItemStatus } from './wedding'

export type MessageSender = 'COUPLE' | 'VENDOR' | 'SYSTEM'
export type MessageType = 'TEXT' | 'ORDER'

export interface Message {
  id: string
  conversationId: string
  sender: MessageSender
  type: MessageType
  /** Nội dung chữ; với ORDER là câu mô tả ngắn */
  text: string
  /** Với ORDER: id đơn dịch vụ */
  orderId: string | null
  createdAt: string
}

export interface Conversation {
  id: string
  service: ServiceSummary
  /** Trạng thái dịch vụ trong kế hoạch; CONFIRMED thì hiện nhãn "Đã cọc" trong danh sách hội thoại */
  planStatus: PlanItemStatus | null
  lastMessage: Pick<Message, 'type' | 'text' | 'createdAt'> | null
}

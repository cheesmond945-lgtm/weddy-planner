/*
 * Tin nhắn dùng chung cho cặp đôi và NCC, theo docs/database.md 4.18 (Messages). Hợp đồng: docs/api/chat.md
 */
import type { ServiceSummary } from './catalog'
import type { OrderStatus } from './vendorOrder'
import type { PlanItemStatus } from './wedding'

/** SYSTEM: Messages.SenderId rỗng (tin hệ thống). */
export type MessageSender = 'COUPLE' | 'VENDOR' | 'SYSTEM'
/** Messages.Type */
export type MessageType = 'Text' | 'Order' | 'DepositReceipt' | 'FinalInvoice'

export interface Message {
  id: string
  conversationId: string
  sender: MessageSender
  type: MessageType
  /** Với Order, DepositReceipt, FinalInvoice: id đơn dịch vụ */
  orderId: string | null
  /** Nội dung chữ; với Order là câu mô tả ngắn */
  content: string
  isRead: boolean
  sentDate: string
  /** Chỉ BE thật trả, với tin có orderId: mã và trạng thái đơn, để vẽ ô đơn gọn khi chưa đọc được đơn đầy đủ */
  order?: { orderCode: string; status: OrderStatus } | null
}

export interface Conversation {
  id: string
  service: ServiceSummary
  /** Trạng thái dịch vụ trong kế hoạch; CONFIRMED thì hiện nhãn "Đã cọc" trong danh sách hội thoại */
  planStatus: PlanItemStatus | null
  /** Số tin NCC gửi mà khách chưa đọc */
  unreadCount: number
  lastMessage: Pick<Message, 'sender' | 'type' | 'content' | 'sentDate'> | null
}

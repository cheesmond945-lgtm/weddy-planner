/*
 * Tin nhắn dùng chung cho cặp đôi và NCC, theo docs/database.md 4.18 (Messages). Hợp đồng: docs/api/chat.md
 */
import type { ServiceSummary } from './catalog'
import type { OrderStatus } from './vendorOrder'
import type { PlanItemStatus } from './wedding'

/** SYSTEM: Messages.SenderId rỗng (tin hệ thống). */
export type MessageSender = 'COUPLE' | 'VENDOR' | 'SYSTEM'
/** Messages.Type */
export type MessageType = 'Text' | 'Order' | 'DepositReceipt' | 'FinalInvoice' | 'Image' | 'File' | 'Audio'

/** Tệp của tin Image / File / Audio. `url` là link xem tạm (ký 1 giờ), null khi không ký được */
export interface MessageAttachment {
  url: string | null
  name: string
  mime: string
  size: number
  /** Ghi âm: độ dài (giây) */
  duration: number | null
}

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
  /** Tin được trả lời (đoạn trích) */
  replyTo?: MessageReplyRef | null
  /** Cảm xúc đã gộp theo emoji */
  reactions?: MessageReaction[]
  /** Tin NCC do hệ thống trả lời tự động */
  isAuto?: boolean
  /** Tin Image / File / Audio */
  attachment?: MessageAttachment | null
  /** Người gửi đã thu hồi tin (không còn nội dung / tệp / cảm xúc) */
  recalled?: boolean
}

/** Đoạn trích của tin được trả lời */
export interface MessageReplyRef {
  id: string
  sender: MessageSender
  content: string
}

/** Một emoji đã thả vào tin: số người thả, người xem có thả không */
export interface MessageReaction {
  emoji: string
  count: number
  mine: boolean
}

export interface Conversation {
  id: string
  service: ServiceSummary
  /** Trạng thái dịch vụ trong kế hoạch */
  planStatus: PlanItemStatus | null
  /** Đơn đã gửi mới nhất với NCC này (bỏ bản nháp), cho nhãn trạng thái đơn trong danh sách hội thoại */
  latestOrder?: { id: string; orderCode: string; status: OrderStatus; depositDueDate: string | null } | null
  /** Số tin NCC gửi mà khách chưa đọc */
  unreadCount: number
  lastMessage: Pick<Message, 'sender' | 'type' | 'content' | 'sentDate'> | null
}

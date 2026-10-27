/*
 * Hội thoại và tin nhắn phía NCC, đúng theo docs/database.md (Conversations, Messages) và hợp đồng
 * docs/api/chat.md (phần NCC). Messages.Type chỉ có Text, Order, DepositReceipt, FinalInvoice.
 *
 * Kiểu chat phía cặp đôi ở types/chat.ts giữ nguyên.
 */
import type { OrderStatus, RevisionChangeType } from './vendorOrder'

/** Messages.Type */
export const MESSAGE_TYPES = ['Text', 'Order', 'DepositReceipt', 'FinalInvoice'] as const
export type MessageType = (typeof MESSAGE_TYPES)[number]

/** SYSTEM: Messages.SenderId rỗng (tin hệ thống). */
export type MessageSender = 'COUPLE' | 'VENDOR' | 'SYSTEM'

export interface VendorMessage {
  id: string
  conversationId: string
  sender: MessageSender
  type: MessageType
  /** Có với tin Order, DepositReceipt, FinalInvoice */
  orderId: string | null
  content: string
  isRead: boolean
  sentDate: string
  /** Chỉ BE thật trả, với tin có orderId: mã và trạng thái đơn, để vẽ ô đơn gọn khi chưa đọc được đơn đầy đủ */
  order?: { orderCode: string; status: OrderStatus } | null
}

export interface VendorConversation {
  id: string
  /**
   * name: "Chú rể & Cô dâu" (Weddings), chưa có thông tin đám cưới thì Users.FullName (điền sẵn vào đơn).
   * phone: Users.PhoneNumber, rỗng nếu khách chưa nhập (điền sẵn vào đơn).
   * online: chỉ có khi BE trả trạng thái trực tuyến thật; không có thì giao diện không hiện chấm xanh.
   */
  customer: { name: string; phone: string; online?: boolean }
  unreadCount: number
  lastMessage: { sender: MessageSender; type: MessageType; content: string; orderCode: string | null; sentDate: string } | null
  /** Đơn đã gửi mới nhất (mọi trạng thái trừ Draft) */
  latestOrder: { id: string; orderCode: string; status: OrderStatus } | null
  /** Có đơn Draft */
  hasDraftOrder: boolean
  /** Cần NCC xử lý: đơn Draft, NeedRevision, Deposited có yêu cầu sửa sau cọc, hoặc Deposited đã qua EventDate */
  needsAction: boolean
  /** Mã các đơn của hội thoại, để tìm theo mã đơn */
  orderCodes: string[]
}

/** CHỈ DÙNG KHI DÙNG DỮ LIỆU GIẢ: giả lập việc khách làm (BE thật không có). */
export type CustomerSimulation =
  | { action: 'MESSAGE' }
  | { action: 'PAY_DEPOSIT' }
  | { action: 'REQUEST_REVISION'; changes: RevisionChangeType[]; note: string }

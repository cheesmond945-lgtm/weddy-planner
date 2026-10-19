/*
 * Tin nhắn phía NCC. Hợp đồng: docs/api/chat.md (phần Nhà cung cấp).
 * CHỜ ĐỐI CHIẾU docs/database.md: cùng bảng tin nhắn với phía cặp đôi (types/chat.ts), thêm các loại tin về đơn.
 */
import type { Message } from './chat'
import type { OrderPaymentStatus, ServiceOrderStatus } from './serviceOrder'

/**
 * Loại tin. TEXT, ORDER có ở phía cặp đôi; các loại còn lại là sự kiện của đơn (theo prototype NCC).
 * Nhãn và cách hiển thị ở features/vendorChat.
 */
export const CHAT_MESSAGE_TYPES = [
  'TEXT',
  'ORDER',
  'ORDER_RESENT',
  'ORDER_REVISION_REQUESTED',
  'ORDER_CONFIRMED',
  'PAYMENT_RECORDED',
  'ADJUSTMENT_PROPOSED',
  'ADJUSTMENT_REQUESTED',
  'ADJUSTMENT_REVISION_REQUESTED',
  'ADJUSTMENT_ACCEPTED',
] as const
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number]

export interface VendorMessage extends Omit<Message, 'type'> {
  type: ChatMessageType
  /** Phiên bản đơn (ORDER, ORDER_RESENT, ORDER_REVISION_REQUESTED, ORDER_CONFIRMED, ADJUSTMENT_ACCEPTED) */
  orderVersion: number | null
  /** ADJUSTMENT_PROPOSED, ADJUSTMENT_REVISION_REQUESTED */
  adjustmentId: string | null
  /** ORDER_RESENT: các thay đổi so với phiên bản trước */
  changes: string[] | null
}

/** Đơn mới nhất của hội thoại, hiện dưới tên khách trong danh sách. */
export interface ConversationOrderSummary {
  id: string
  code: string
  status: ServiceOrderStatus
  paymentStatus: OrderPaymentStatus
}

export interface VendorConversation {
  id: string
  customer: { name: string; phone: string }
  /** Gói khách đang quan tâm (mở chat từ trang gói) */
  interestPackage: { id: string; name: string; price: number | null; maxPrice: number | null } | null
  unreadCount: number
  lastMessage: Pick<VendorMessage, 'sender' | 'type' | 'text' | 'orderVersion' | 'createdAt'> & { orderCode: string | null } | null
  /** Đơn đã gửi mới nhất */
  latestOrder: ConversationOrderSummary | null
  /** Có bản nháp đơn chưa gửi */
  hasDraftOrder: boolean
  /** Cần NCC xử lý: khách yêu cầu sửa đơn, yêu cầu điều chỉnh, sửa phương án, hoặc có bản nháp */
  needsAction: boolean
  /** Mã các đơn trong hội thoại, để tìm theo mã đơn */
  orderCodes: string[]
}

/** CHỈ DÙNG KHI VITE_USE_MOCK=true: giả lập việc khách làm trên đơn mới nhất của hội thoại (BE không có). */
export type CustomerSimulation =
  | 'MESSAGE'
  | 'CONFIRM_ORDER'
  | 'REQUEST_REVISION'
  | 'PAY_DEPOSIT'
  | 'REQUEST_ADJUSTMENT'
  | 'ACCEPT_ADJUSTMENT'
  | 'REVISE_ADJUSTMENT'

/*
 * Thông báo của người dùng đang đăng nhập (bảng Notifications), dùng chung mọi vai trò. Hợp đồng: docs/api/notifications.md
 * Type thường gặp phía NCC: NewMessage, OrderSent, OrderRevisionRequested, OrderDeposited, OrderExpired, OrderCompleted, OrderCancelled.
 */
export interface AppNotification {
  id: string
  type: string
  title: string
  content: string
  /** Conversation (referenceId = id hội thoại) hoặc Order (referenceId = id đơn) */
  referenceType: string | null
  referenceId: string | null
  isRead: boolean
  readDate: string | null
  createdDate: string
}

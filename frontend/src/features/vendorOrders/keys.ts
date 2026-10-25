/** Khóa cache React Query của hội thoại, tin nhắn, đơn phía NCC (dùng chung giữa features/vendorChat và features/vendorOrders). */
export const vendorKeys = {
  all: (userId: string | undefined) => ['vendor', userId] as const,
  conversations: (userId: string | undefined) => ['vendor', userId, 'conversations'] as const,
  messages: (userId: string | undefined, conversationId: string) => ['vendor', userId, 'messages', conversationId] as const,
  /** Đơn của một hội thoại (vẽ thẻ đơn) */
  orders: (userId: string | undefined, conversationId: string) => ['vendor', userId, 'orders', conversationId] as const,
  order: (userId: string | undefined, orderId: string) => ['vendor', userId, 'order', orderId] as const,
  /** Danh sách đơn trang Quản lý đơn hàng (mọi bộ lọc) */
  orderLists: (userId: string | undefined) => ['vendor', userId, 'order-list'] as const,
  orderCounts: (userId: string | undefined) => ['vendor', userId, 'order-counts'] as const,
}

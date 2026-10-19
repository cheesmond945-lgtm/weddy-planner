/** Khóa cache React Query của tin nhắn và đơn phía NCC (dùng chung giữa features/vendorChat và features/serviceOrders). */
export const vendorChatKeys = {
  all: (userId: string | undefined) => ['vendor-chat', userId] as const,
  conversations: (userId: string | undefined) => ['vendor-chat', userId, 'conversations'] as const,
  messages: (userId: string | undefined, conversationId: string) => ['vendor-chat', userId, 'messages', conversationId] as const,
  orders: (userId: string | undefined, conversationId: string) => ['vendor-chat', userId, 'orders', conversationId] as const,
  order: (userId: string | undefined, orderId: string) => ['vendor-chat', userId, 'order', orderId] as const,
}

import { mockVendorOrders } from '@/mocks/vendorOrders'
import { authStore } from '@/store/auth'
import type { CustomerSimulation, VendorConversation, VendorMessage } from '@/types/vendorConversation'
import { ApiError, http } from './client'
import { isMock, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 200) => mockDelay(null, ms).then(() => fn(mockUserId()))

/** Hội thoại và tin nhắn phía NCC. Hợp đồng: docs/api/chat.md (phần Nhà cung cấp). */
export const vendorConversationsApi = {
  list: (): Promise<VendorConversation[]> =>
    isMock('vendorChat') ? mock((u) => mockVendorOrders.listConversations(u)) : http.get('/vendors/me/conversations'),

  listMessages: (conversationId: string): Promise<VendorMessage[]> =>
    isMock('vendorChat') ? mock((u) => mockVendorOrders.listMessages(u, conversationId)) : http.get(`/vendors/me/conversations/${conversationId}/messages`),

  markRead: (conversationId: string): Promise<null> =>
    isMock('vendorChat') ? mock((u) => (mockVendorOrders.markRead(u, conversationId), null), 0) : http.post(`/vendors/me/conversations/${conversationId}/read`),

  send: (conversationId: string, text: string): Promise<VendorMessage> =>
    isMock('vendorChat')
      ? mock((u) => mockVendorOrders.sendMessage(u, conversationId, text))
      : http.post(`/vendors/me/conversations/${conversationId}/messages`, { text }),

  /** CHỈ CÓ Ở DỮ LIỆU GIẢ: giả lập khách (đặt cọc, yêu cầu chỉnh sửa, hủy sau cọc, nhắn tin). BE thật không có endpoint này. */
  simulate: (conversationId: string, sim: CustomerSimulation): Promise<null> => {
    if (!isMock('orders')) return Promise.reject(new ApiError(400, 'BAD_REQUEST', 'Chỉ dùng được với dữ liệu giả.'))
    return mock((u) => (mockVendorOrders.simulate(u, conversationId, sim), null), 400)
  },
}

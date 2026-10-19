import { mockVendorChat } from '@/mocks/vendorChat'
import { authStore } from '@/store/auth'
import type { CustomerSimulation, VendorConversation, VendorMessage } from '@/types/vendorChat'
import { ApiError, http } from './client'
import { USE_MOCK, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 200) => mockDelay(null, ms).then(() => fn(mockUserId()))

/** Hợp đồng: docs/api/chat.md (phần Nhà cung cấp). */
export const vendorChatApi = {
  listConversations: (): Promise<VendorConversation[]> =>
    USE_MOCK ? mock((u) => mockVendorChat.listConversations(u)) : http.get('/vendors/me/conversations'),

  listMessages: (conversationId: string): Promise<VendorMessage[]> =>
    USE_MOCK ? mock((u) => mockVendorChat.listMessages(u, conversationId)) : http.get(`/vendors/me/conversations/${conversationId}/messages`),

  markRead: (conversationId: string): Promise<null> =>
    USE_MOCK
      ? mock((u) => (mockVendorChat.markRead(u, conversationId), null), 0)
      : http.post(`/vendors/me/conversations/${conversationId}/read`),

  send: (conversationId: string, text: string): Promise<VendorMessage> =>
    USE_MOCK
      ? mock((u) => mockVendorChat.sendMessage(u, conversationId, text))
      : http.post(`/vendors/me/conversations/${conversationId}/messages`, { text }),

  /** CHỈ CÓ KHI VITE_USE_MOCK=true: giả lập khách (BE không có endpoint này). */
  simulate: (conversationId: string, action: CustomerSimulation): Promise<null> => {
    if (!USE_MOCK) return Promise.reject(new ApiError(400, 'BAD_REQUEST', 'Chỉ dùng được với dữ liệu giả.'))
    return mock((u) => (mockVendorChat.simulate(u, conversationId, action), null), 400)
  },
}

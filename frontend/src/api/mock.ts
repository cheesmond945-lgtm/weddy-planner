import { env } from '@/lib/env'

/** true khi VITE_USE_MOCK=true: các hàm trong src/api trả dữ liệu từ src/mocks thay vì gọi BE. */
export const USE_MOCK = env.useMock

/** Dữ liệu giả cho một nhóm API: bật khi VITE_USE_MOCK=true và nhóm đó chưa nằm trong VITE_REAL_APIS. */
export const isMock = (group: string) => USE_MOCK && !env.realApis.includes(group)

/**
 * Tin nhắn đã nối backend thật nhưng API đơn hàng vẫn là dữ liệu giả (giai đoạn 1 của chat thật):
 * thẻ đơn đầy đủ, nút "Tạo đơn" và "Giả lập khách" không dùng được vì đơn giả không khớp hội thoại thật.
 * chatGroup: 'chat' (phía khách) hoặc 'vendorChat' (phía NCC).
 */
export const orderCardsStubbed = (chatGroup: 'chat' | 'vendorChat') => !isMock(chatGroup) && isMock('orders')

/** Giả lập độ trễ mạng cho dữ liệu giả. */
export function mockDelay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

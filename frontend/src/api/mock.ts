import { env } from '@/lib/env'

/** true khi VITE_USE_MOCK=true: các hàm trong src/api trả dữ liệu từ src/mocks thay vì gọi BE. */
export const USE_MOCK = env.useMock

/** Giả lập độ trễ mạng cho dữ liệu giả. */
export function mockDelay<T>(value: T, ms = 300): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms))
}

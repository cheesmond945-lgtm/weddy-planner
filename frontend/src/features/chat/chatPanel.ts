import { useSyncExternalStore } from 'react'
import type { Conversation } from '@/types/chat'

/**
 * Cách nút "Nhắn tin với NCC" liên hệ nhà cung cấp, đổi bằng biến VITE_CHAT_MODE:
 * - internal (mặc định, phương án A): chat trong WebPlan, hội thoại lưu ở BE, NCC nhận thông báo và trả lời ở trang NCC.
 * - zalo (phương án B, tạm thời): mở Zalo của NCC theo số điện thoại; Zalo không nhận nội dung soạn sẵn qua link
 *   nên tin soạn sẵn được chép vào bộ nhớ tạm để khách dán.
 */
export const CHAT_MODE: 'internal' | 'zalo' = import.meta.env.VITE_CHAT_MODE === 'zalo' ? 'zalo' : 'internal'

/** Tham số trên URL để mở lại khung chat sau khi đăng nhập: ?chat=<id dịch vụ> */
export const CHAT_PARAM = 'chat'

export interface ChatPanelState {
  conversation: Conversation
  /** Tin soạn sẵn trong ô nhập (khách sửa được trước khi gửi) */
  draft: string
  /** Gói của NCC đang có trong kế hoạch, dùng cho chip "Hỏi giá chốt" */
  packageName: string | null
  /** Giờ làm việc của NCC ("08:00 - 21:00"), ngoài giờ thì báo NCC sẽ trả lời sớm nhất có thể */
  workingHours?: string
}

let state: ChatPanelState | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

export const chatPanel = {
  open(next: ChatPanelState) {
    state = next
    emit()
  },
  close() {
    state = null
    emit()
  },
}

/** Khung chat đang mở (null nếu đang đóng). Đặt một ChatPanel trong CoupleLayout. */
export function useChatPanel() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}

/** Có đang trong giờ làm việc không. Không đọc được giờ thì coi như đang làm việc. */
export function isWithinHours(workingHours: string | undefined, now = new Date()) {
  const m = workingHours?.match(/(\d{1,2})(?:[:h](\d{2}))?\s*[-–]\s*(\d{1,2})(?:[:h](\d{2}))?/)
  if (!m) return true
  const start = Number(m[1]) * 60 + Number(m[2] ?? 0)
  const end = Number(m[3]) * 60 + Number(m[4] ?? 0)
  const cur = now.getHours() * 60 + now.getMinutes()
  return start <= end ? cur >= start && cur < end : cur >= start || cur < end
}

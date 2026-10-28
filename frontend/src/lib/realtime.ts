import { useSyncExternalStore } from 'react'
import { io, type Socket } from 'socket.io-client'
import { env } from '@/lib/env'

/*
 * Kết nối realtime (Socket.IO) tới backend, một kết nối cho mỗi phiên đăng nhập.
 * Backend chỉ báo "có thay đổi" (hội thoại nào, đơn nào); FE tự tải lại qua REST (xem app/RealtimeBridge.tsx).
 * Khi đang kết nối, các hook hỏi lại định kỳ giãn ra (livePoll) vì dữ liệu mới đã được đẩy tới; mất kết nối thì hỏi lại như cũ.
 */

export interface RealtimeHandlers {
  message?: (e: { conversationId: string; orderId: string | null; type: string }) => void
  read?: (e: { conversationId: string }) => void
  notification?: (e: { type: string; referenceType: string | null; referenceId: string | null }) => void
}

let socket: Socket | null = null
let connected = false
const listeners = new Set<() => void>()
const setConnected = (v: boolean) => {
  if (connected === v) return
  connected = v
  listeners.forEach((l) => l())
}

/** Địa chỉ gốc của backend: VITE_API_URL bỏ tiền tố /api. */
const origin = () => new URL(env.apiUrl).origin

export function connectRealtime(token: string, handlers: RealtimeHandlers) {
  disconnectRealtime()
  const s = io(origin(), { auth: { token }, transports: ['websocket', 'polling'], reconnectionDelayMax: 10_000 })
  s.on('connect', () => setConnected(true))
  s.on('disconnect', () => setConnected(false))
  s.on('unauthorized', () => s.disconnect())
  for (const [event, fn] of Object.entries(handlers)) if (fn) s.on(event, fn)
  socket = s
}

export function disconnectRealtime() {
  socket?.removeAllListeners()
  socket?.disconnect()
  socket = null
  setConnected(false)
}

export function useRealtimeConnected() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => connected,
  )
}

/** Chu kỳ hỏi lại: `ms` khi chưa có realtime; đang kết nối thì chỉ hỏi lại thưa (dự phòng lỡ sự kiện). */
export function useLivePoll(ms: number): number {
  return useRealtimeConnected() ? Math.max(ms, 60_000) : ms
}

/*
 * Đồng hồ cho phía NCC. Dữ liệu thật: giờ hiện tại. Dữ liệu giả: giờ hiện tại cộng độ lệch do nút
 * "Giả lập thời gian" đặt (để thử đơn hết hạn cọc, tự hoàn thành sau EventDate + 7 ngày).
 * Mọi chỗ cần "bây giờ" trong phần NCC (hạn cọc, đơn đã qua ngày sự kiện, hoa hồng) dùng now() ở đây, không dùng new Date().
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { isMock } from '@/api/mock'

const KEY = 'weddy.mock.clockOffset'
const EVENT = 'weddy-clock'
const HOUR = 3_600_000

function offsetMs() {
  if (!isMock('orders')) return 0
  try {
    return Number(localStorage.getItem(KEY) ?? 0) || 0
  } catch {
    return 0
  }
}

/** Bây giờ (đã cộng độ lệch giả lập khi dùng dữ liệu giả). */
export const now = () => new Date(Date.now() + offsetMs())

/** Tua đồng hồ giả lập thêm một khoảng (giờ). Chỉ có tác dụng với dữ liệu giả. */
export function advanceClock(hours: number) {
  try {
    localStorage.setItem(KEY, String(offsetMs() + hours * HOUR))
  } catch {
    // bỏ qua
  }
  window.dispatchEvent(new Event(EVENT))
}

export function resetClock() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // bỏ qua
  }
  window.dispatchEvent(new Event(EVENT))
}

/** Cho màn hình đang mở dựng lại khi tua đồng hồ giả lập (trạng thái phụ thuộc ngày hiện tại, ví dụ Quá hạn). Trả về độ lệch hiện tại (ms). */
export function useClock() {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb)
      return () => window.removeEventListener(EVENT, cb)
    },
    offsetMs,
  )
}

/**
 * "Bây giờ" cho màn hình đang mở: dựng lại mỗi 30 giây và khi tua đồng hồ giả lập, dùng cho đếm ngược hạn cọc và các trạng thái
 * phụ thuộc ngày hôm nay (quá hạn, đã qua ngày sự kiện). Trả về Date theo đồng hồ giả lập.
 */
export function useNow(intervalMs = 30_000) {
  const offset = useClock()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  // offset và tick chỉ để React dựng lại; giá trị trả về luôn tính mới
  void offset
  void tick
  return now()
}

/** Đã tua đồng hồ giả lập bao nhiêu giờ. */
export const clockOffsetHours = () => Math.round(offsetMs() / HOUR)

const VN = 'Asia/Ho_Chi_Minh'

/** Ngày hiện tại theo giờ Việt Nam, "YYYY-MM-DD". */
export const todayVN = (d: Date = now()) => new Intl.DateTimeFormat('en-CA', { timeZone: VN, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

/** "2026-12-06" + n ngày. */
export function addDaysYmd(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

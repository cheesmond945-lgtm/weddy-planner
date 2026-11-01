/*
 * Đồng hồ cho phía NCC. Mọi chỗ cần "bây giờ" trong phần NCC (hạn cọc, đơn đã qua ngày sự kiện, hoa hồng)
 * dùng now() ở đây, không dùng new Date().
 */
import { useEffect, useState } from 'react'

/** Bây giờ. */
export const now = () => new Date()

/**
 * "Bây giờ" cho màn hình đang mở: dựng lại mỗi 30 giây, dùng cho đếm ngược hạn cọc và các trạng thái
 * phụ thuộc ngày hôm nay (quá hạn, đã qua ngày sự kiện).
 */
export function useNow(intervalMs = 30_000) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now()
}

const VN = 'Asia/Ho_Chi_Minh'

/** Ngày hiện tại theo giờ Việt Nam, "YYYY-MM-DD". */
export const todayVN = (d: Date = now()) => new Intl.DateTimeFormat('en-CA', { timeZone: VN, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)

/** "2026-12-06" + n ngày. */
export function addDaysYmd(ymd: string, n: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

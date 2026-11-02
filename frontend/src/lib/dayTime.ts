/*
 * Giờ trong lịch trình ngày cưới (docs/LICH_TRINH_NGAY_CUOI.md): API trả giờ VN dạng "YYYY-MM-DDTHH:mm", có thể là tối hôm trước ngày cưới.
 */

/** "2026-10-20T05:30" -> "05:30" */
export const clockOf = (local: string) => local.slice(11, 16)

/** "2026-10-20T05:30" -> "2026-10-20" */
export const dayOfLocal = (local: string) => local.slice(0, 10)

/** Khung giờ "05:00–10:00"; có mặt từ hôm trước ngày cưới thì "22:00 hôm trước–10:00" */
export function spanText(start: string, end: string, weddingDay: string): string {
  const before = (s: string) => (dayOfLocal(s) < weddingDay ? ' hôm trước' : '')
  return `${clockOf(start)}${before(start)}–${clockOf(end)}${before(end)}`
}

/** 90 -> "1 giờ 30 phút", 0 -> "0 phút" */
export function durationText(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return [h ? `${h} giờ` : '', m ? `${m} phút` : ''].filter(Boolean).join(' ') || '0 phút'
}

/** Các mốc chọn thời lượng, bước 30 phút: [from, to] (phút) */
export const durationSteps = (from: number, to: number) => Array.from({ length: Math.floor((to - from) / 30) + 1 }, (_, i) => from + i * 30)

/** Giờ chính "HH:mm" trừ đi số phút -> "HH:mm" (vòng qua nửa đêm) */
export function minusMinutes(hm: string, min: number): string {
  const [h, m] = hm.split(':').map(Number)
  const t = (((h * 60 + m - min) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

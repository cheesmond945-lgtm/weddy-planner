/*
 * Giờ, thời lượng cho thẻ "Thời gian trong ngày cưới" của gói (NCC). Phần lịch trình ngày cưới của khách / chi tiết đơn đã bỏ.
 */

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

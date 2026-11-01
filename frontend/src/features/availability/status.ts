import type { DayStatus } from '@/types/availability'

/*
 * Lịch khả dụng theo gói (Trung tâm tiệc cưới): nhãn, màu, lưới tháng, tin soạn sẵn gửi NCC.
 * Hàm thuần, có test ở status.test.ts. Quy tắc tính trạng thái nằm ở backend (availability-rules.ts).
 */

/** Chỉ Trung tâm tiệc cưới có lịch theo gói */
export const VENUE_SLUG = 'nha-hang'

export const DAY_STATUSES: DayStatus[] = ['AVAILABLE', 'HELD', 'BOOKED', 'UNKNOWN']

/** Nhãn, chấm màu và nền ô lịch: trống xanh lá, giữ chỗ cam, kín đỏ, chưa cập nhật xám. Lớp viết đủ chữ để Tailwind quét được. */
export const STATUS_VIEW: Record<DayStatus, { label: string; short: string; dot: string; chip: string; cell: string; pill: string }> = {
  AVAILABLE: { label: 'Còn trống', short: 'Trống', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 ring-emerald-200', cell: 'bg-emerald-50 text-emerald-800 ring-emerald-200', pill: 'border-emerald-500 bg-emerald-50 text-emerald-800' },
  HELD: { label: 'Giữ chỗ', short: 'Giữ chỗ', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 ring-amber-200', cell: 'bg-amber-50 text-amber-800 ring-amber-200', pill: 'border-amber-500 bg-amber-50 text-amber-800' },
  BOOKED: { label: 'Đã kín', short: 'Kín', dot: 'bg-red-500', chip: 'bg-red-50 text-red-700 ring-red-200', cell: 'bg-red-50 text-red-800 ring-red-200', pill: 'border-red-500 bg-red-50 text-red-800' },
  UNKNOWN: { label: 'Chưa cập nhật', short: 'Chưa rõ', dot: 'bg-stone-400', chip: 'bg-stone-100 text-stone-600 ring-stone-200', cell: 'bg-stone-100 text-stone-500 ring-stone-200', pill: 'border-stone-400 bg-stone-100 text-stone-600' },
}

export const DISCLAIMER = 'Lịch mang tính tham khảo, vui lòng xác nhận với nhà cung cấp trước khi đặt cọc.'

const pad = (n: number) => String(n).padStart(2, '0')

/** "2026-11-28" -> "2026-11" */
export const monthOf = (date: string) => date.slice(0, 7)

/** Cộng/trừ tháng: ("2026-12", 1) -> "2027-01" */
export function shiftMonth(month: string, n: number) {
  const [y, m] = month.split('-').map(Number)
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`
}

/** "2026-11" -> "Tháng 11/2026" */
export const monthLabel = (month: string) => `Tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`

export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const WEEKDAY_NAMES = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy']

/** Thứ của ngày: "2026-11-28" -> "Thứ bảy" */
export function weekdayName(date: string) {
  const [y, m, d] = date.split('-').map(Number)
  return WEEKDAY_NAMES[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
}

/** Lưới tháng bắt đầu từ thứ hai: ô trống (null) ở đầu cho đủ tuần, rồi các ngày "YYYY-MM-DD". */
export function monthGrid(month: string): (string | null)[] {
  const [y, m] = month.split('-').map(Number)
  const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay()
  const lead = (first + 6) % 7
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let d = 1; d <= count; d++) cells.push(`${month}-${pad(d)}`)
  return cells
}

/** Ô lịch kiểu "Lịch làm việc": đủ tuần (thứ hai đến chủ nhật), gồm cả ngày của tháng trước / sau (inMonth = false). */
export function calendarCells(month: string): { date: string; inMonth: boolean }[] {
  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const total = Math.ceil((lead + count) / 7) * 7
  return Array.from({ length: total }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1, 1 - lead + i))
    const iso = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
    return { date: iso, inMonth: iso.startsWith(month) }
  })
}

const vnDate = (s: string) => `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}`

/** Tin soạn sẵn khi khách bấm "Liên hệ nhà cung cấp" từ chi tiết gói: có ngày tổ chức và gói đang xem để NCC xác nhận. */
export function availabilityRequestText(input: { vendorName: string; packageName: string; date: string | null; status: DayStatus | null; guestCount?: number | null }) {
  const when = input.date ? `ngày ${vnDate(input.date)} (${weekdayName(input.date).toLowerCase()})` : 'ngày tổ chức (mình chưa chốt ngày)'
  const guests = input.guestCount ? `, khoảng ${input.guestCount.toLocaleString('vi-VN')} khách` : ''
  const shown = input.date && input.status ? ` Lịch trên WebPlan đang hiển thị: ${STATUS_VIEW[input.status].label}.` : ''
  return `Chào ${input.vendorName}, mình muốn đặt tiệc cưới gói "${input.packageName}" vào ${when}${guests}.${shown} Nhờ bạn xác nhận giúp mình gói này ngày đó còn nhận tiệc không ạ.`
}

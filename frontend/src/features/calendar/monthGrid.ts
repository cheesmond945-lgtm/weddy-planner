/*
 * Lưới tháng cho chế độ xem Lịch (timeline của khách, lịch làm việc của NCC). Hàm thuần, không phụ thuộc thư viện ngày;
 * tính theo UTC để không lệch múi giờ. Ngày là "YYYY-MM-DD", tháng là "YYYY-MM". Tuần bắt đầu từ thứ Hai.
 */

export interface GridDay {
  /** "YYYY-MM-DD" */
  date: string
  /** Thuộc tháng đang xem (các ngày đệm đầu và cuối lưới thì false) */
  inMonth: boolean
}

export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const

const pad = (n: number) => String(n).padStart(2, '0')
const DAY = 86_400_000
const ymd = (ms: number) => {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
}

export const monthOf = (date: string) => date.slice(0, 7)

/** "2026-11" -> { year: 2026, month: 11 } */
export function parseMonth(key: string) {
  const [y, m] = key.split('-').map(Number)
  return { year: y, month: m }
}

/** Dời `delta` tháng (âm là lùi). */
export function shiftMonth(key: string, delta: number): string {
  const { year, month } = parseMonth(key)
  const idx = year * 12 + (month - 1) + delta
  return `${Math.floor(idx / 12)}-${pad((idx % 12) + 1)}`
}

export const monthTitle = (key: string) => {
  const { year, month } = parseMonth(key)
  return `Tháng ${month}/${year}`
}

/** Các ngày của lưới tháng: đủ tuần từ thứ Hai đầu tiên đến Chủ nhật cuối cùng (4 đến 6 hàng). */
export function monthGrid(key: string): GridDay[] {
  const { year, month } = parseMonth(key)
  const first = Date.UTC(year, month - 1, 1)
  const last = Date.UTC(year, month, 0)
  const lead = (new Date(first).getUTCDay() + 6) % 7 // số ngày đệm trước mùng 1 (thứ Hai = 0)
  const trail = 6 - ((new Date(last).getUTCDay() + 6) % 7)
  const out: GridDay[] = []
  for (let t = first - lead * DAY; t <= last + trail * DAY; t += DAY) {
    const date = ymd(t)
    out.push({ date, inMonth: monthOf(date) === key })
  }
  return out
}

/** Ngày đầu và ngày cuối của lưới (khoảng cần tải dữ liệu cho tháng này). */
export function gridRange(key: string) {
  const days = monthGrid(key)
  return { from: days[0].date, to: days[days.length - 1].date }
}

/** Gom sự kiện theo ngày, giữ thứ tự ban đầu trong từng ngày. */
export function groupByDate<T extends { date: string }>(events: readonly T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const e of events) {
    const list = map.get(e.date)
    if (list) list.push(e)
    else map.set(e.date, [e])
  }
  return map
}

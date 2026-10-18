/*
 * Ngày không có giờ ("YYYY-MM-DD") theo docs/api/README.md, xử lý theo giờ địa phương.
 * Các hàm hiển thị giống prototype: fD = dd/MM/yyyy, sD = dd/MM.
 */
const DAY = 86_400_000

/** "2026-12-20" -> Date lúc 00:00 giờ địa phương */
export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Date -> "2026-12-20" */
export function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function today() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function addDays(d: Date, n: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Số ngày từ a đến b */
export function daysBetween(a: Date, b: Date) {
  return Math.round((b.getTime() - a.getTime()) / DAY)
}

/** "2026-12-20" -> "20/12/2026" */
export function formatDate(s: string) {
  const d = parseDate(s)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

/** "2026-12-20" -> "20/12" */
export function formatShortDate(s: string) {
  return formatDate(s).slice(0, 5)
}

/** ISO thời điểm -> "14:32" hoặc "Hôm qua" / "dd/MM" như danh sách hội thoại */
export function formatMessageTime(iso: string) {
  const d = new Date(iso)
  const days = daysBetween(new Date(d.getFullYear(), d.getMonth(), d.getDate()), today())
  if (days === 0) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (days === 1) return 'Hôm qua'
  return formatShortDate(toISODate(d))
}

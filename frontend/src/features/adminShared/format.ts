const p = (n: number) => String(n).padStart(2, '0')

/** ISO -> "14:32 24/03/2026". */
export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** ISO -> "24/03/2026". */
export function formatDay(iso: string | null | undefined) {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** Thời gian đã chờ tính từ một mốc: "4 giờ", "3 ngày". */
export function waitingOf(iso: string) {
  const hours = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000))
  return hours < 24 ? { label: `${hours} giờ`, urgent: false } : { label: `${Math.floor(hours / 24)} ngày`, urgent: hours >= 48 }
}

/** "2026-10" -> "10/2026". */
export function formatPeriod(period: string) {
  const [y, m] = period.split('-')
  return `${m}/${y}`
}

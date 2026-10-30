import type { TimelineItem } from '@/types/wedding'

/*
 * Tìm kiếm và lọc việc của timeline (cách xem THEO THỜI GIAN và LỊCH). Hàm thuần: không đụng giao diện, không đọc đồng hồ
 * (hôm nay do nơi gọi truyền vào, "YYYY-MM-DD").
 */

/** all: mọi việc; mine: việc khách tự làm hoặc cùng làm (bỏ việc chỉ NCC làm); vendor: việc chỉ NCC làm. */
export type OwnerFilter = 'all' | 'mine' | 'vendor'

export interface TimelineFilters {
  /** Từ khóa tìm: nhiều từ cách nhau bởi dấu cách, việc phải chứa đủ các từ */
  q: string
  /** '' (mọi tháng), 'overdue' (chưa xong, quá hạn), 'soon' (chưa xong, hạn trong vài ngày tới) hoặc 'YYYY-MM' */
  month: string
  owner: OwnerFilter
}

export const NO_FILTERS: TimelineFilters = { q: '', month: '', owner: 'all' }

export const hasFilters = (f: TimelineFilters) => !!(f.q.trim() || f.month || f.owner !== 'all')

/** Bỏ dấu tiếng Việt, đ thành d, chữ thường: "Đặt cọc" khớp "dat coc". */
export const foldText = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()

const dmy = (s: string) => s.split('-').reverse().join('/')

/** Các từ để tìm của một việc: tên việc, dịch vụ, tên NCC, hạng mục, mã đơn và ngày hạn (dd/mm/yyyy), đã bỏ dấu. */
function wordsOf(i: TimelineItem): string[] {
  const due = i.dueDate ?? ''
  const text = foldText([i.title, i.serviceName, i.category?.name, i.orderCode, due ? dmy(due) : ''].filter(Boolean).join(' '))
  return text.split(/[^a-z0-9/]+/).filter(Boolean)
}

/** Tách "tháng N" khỏi từ khóa (tìm theo tháng của hạn, mọi năm); phần còn lại là các từ. */
function parseQuery(q: string) {
  let month: number | null = null
  const rest = foldText(q).replace(/thang\s*(\d{1,2})\b/, (_, m: string) => {
    month = Number(m)
    return ' '
  })
  return { month, terms: rest.split(/\s+/).filter(Boolean) }
}

/**
 * Mỗi từ khóa phải là ĐẦU của một từ trong việc (không khớp giữa chữ: "hang" không khớp "thang"); đủ mọi từ, thứ tự tùy ý.
 * "tháng 12" khớp việc có hạn trong tháng 12; "12/11" khớp ngày hạn 12/11.
 */
export function matchesQuery(i: TimelineItem, q: string): boolean {
  const { month, terms } = parseQuery(q)
  if (month !== null && (!i.dueDate || Number(i.dueDate.slice(5, 7)) !== month)) return false
  if (!terms.length) return true
  const words = wordsOf(i)
  return terms.every((t) => words.some((w) => w.startsWith(t)))
}

export function matchesOwner(i: TimelineItem, owner: OwnerFilter): boolean {
  if (owner === 'all') return true
  const vendorOnly = i.kind === 'SERVICE_TASK' && i.owner === 'VENDOR'
  return owner === 'vendor' ? vendorOnly : !vendorOnly
}

export const isOverdue = (i: TimelineItem, today: string) => !i.isDone && !!i.dueDate && i.dueDate < today

/** Nhắc "sắp đến hạn" khi còn từng này ngày (gồm đúng hôm nay); cùng giá trị với backend (task-owner.ts DUE_SOON_DAYS). */
export const DUE_SOON_DAYS = 2
const dayOf = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000)
/** Chưa xong và hạn từ hôm nay đến hôm nay + DUE_SOON_DAYS. */
export const isDueSoon = (i: TimelineItem, today: string) => !i.isDone && !!i.dueDate && i.dueDate >= today && dayOf(i.dueDate) - dayOf(today) <= DUE_SOON_DAYS

export function matchesMonth(i: TimelineItem, month: string, today: string): boolean {
  if (!month) return true
  if (month === 'overdue') return isOverdue(i, today)
  if (month === 'soon') return isDueSoon(i, today)
  return !!i.dueDate && i.dueDate.slice(0, 7) === month
}

/** Áp từ khóa, chủ việc và tháng. */
export function filterTimeline(items: readonly TimelineItem[], f: TimelineFilters, today: string): TimelineItem[] {
  return items.filter((i) => matchesQuery(i, f.q) && matchesOwner(i, f.owner) && matchesMonth(i, f.month, today))
}

export interface MonthOption {
  /** 'overdue' hoặc 'YYYY-MM' */
  value: string
  label: string
  count: number
}

/**
 * Các lựa chọn tháng kèm số việc: "Quá hạn" và "Sắp đến hạn" trước (nếu có), rồi các tháng có việc theo thứ tự thời gian.
 * `items` nên là danh sách đã qua các bộ lọc khác (trừ tháng) để số đếm khớp những gì sẽ thấy.
 */
export function monthOptions(items: readonly TimelineItem[], today: string): MonthOption[] {
  const months = new Map<string, number>()
  let overdue = 0
  let soon = 0
  for (const i of items) {
    if (!i.dueDate) continue
    if (isOverdue(i, today)) overdue++
    if (isDueSoon(i, today)) soon++
    const m = i.dueDate.slice(0, 7)
    months.set(m, (months.get(m) ?? 0) + 1)
  }
  const out: MonthOption[] = []
  if (overdue) out.push({ value: 'overdue', label: 'Quá hạn', count: overdue })
  if (soon) out.push({ value: 'soon', label: 'Sắp đến hạn', count: soon })
  for (const [m, count] of [...months].sort(([a], [b]) => a.localeCompare(b))) out.push({ value: m, label: `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`, count })
  return out
}

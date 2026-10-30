import type { TimelineItem } from '@/types/wedding'

export type ViewMode = 'time' | 'service' | 'calendar'

export interface TimeGroup {
  /** "overdue" hoặc "YYYY-MM" */
  key: string
  title: string
  items: TimelineItem[]
}

/**
 * Cách xem THEO THỜI GIAN: danh sách phẳng của mọi việc, sắp theo Hạn tăng dần (cùng hạn giữ thứ tự backend = thứ tự mẫu),
 * chia nhóm theo tháng. Việc quá hạn (chưa xong, hạn trước hôm nay) gom vào nhóm "Quá hạn" trên cùng.
 * `today` là "YYYY-MM-DD".
 */
export function groupByTime(items: readonly TimelineItem[], today: string): TimeGroup[] {
  const sorted = [...items].filter((i) => i.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)) // sort ổn định: cùng hạn giữ thứ tự cũ
  const overdue = sorted.filter((i) => !i.isDone && i.dueDate! < today)
  const rest = sorted.filter((i) => i.isDone || i.dueDate! >= today)
  const groups: TimeGroup[] = []
  if (overdue.length) groups.push({ key: 'overdue', title: 'Quá hạn', items: overdue })
  for (const i of rest) {
    const key = i.dueDate!.slice(0, 7)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(i)
    else groups.push({ key, title: `Tháng ${Number(key.slice(5))}/${key.slice(0, 4)}`, items: [i] })
  }
  return groups
}

/** Số dịch vụ (hạng mục) có mặt trong danh sách việc. */
export const countServices = (items: readonly TimelineItem[]) => new Set(items.map((i) => i.category?.slug).filter(Boolean)).size

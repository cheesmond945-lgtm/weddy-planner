import type { TimelineItem } from '@/types/wedding'

/** Cách xem: danh sách theo thời gian (có tiêu đề tháng) hoặc lịch tháng (bật bằng nút lịch cạnh ô tìm kiếm). */
export type ViewMode = 'time' | 'calendar'

/**
 * Đọc cách xem đã lưu trong trình duyệt. Giá trị cũ 'service' / 'time' (và mọi giá trị lạ hoặc rỗng) về danh sách,
 * 'calendar' giữ chế độ lịch, nên người dùng cũ không gặp lỗi.
 */
export const parseView = (v: string | null | undefined): ViewMode => (v === 'calendar' ? 'calendar' : 'time')

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
  const overdue = sorted.filter((i) => !i.isDone && !i.isRestPayment && i.dueDate! < today)
  const rest = sorted.filter((i) => !overdue.includes(i))
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

/** Quy trình của một đơn đã cọc, hiện ở dòng tóm tắt khi đang lọc một dịch vụ. */
export interface OrderProgress {
  orderCode: string
  vendorName: string | null
  packageName: string | null
  serviceId: string | null
  done: number
  total: number
}

/**
 * Tóm tắt tiến độ theo từng đơn của các việc chi tiết (SERVICE_TASK) của một dịch vụ: mỗi đơn một dòng, đơn nhiều việc đứng trước.
 * Việc không có mã đơn bị bỏ qua.
 */
export function orderProgress(kids: readonly TimelineItem[]): OrderProgress[] {
  const map = new Map<string, TimelineItem[]>()
  for (const k of kids) if (k.kind === 'SERVICE_TASK' && k.orderCode) map.set(k.orderCode, [...(map.get(k.orderCode) ?? []), k])
  return [...map.entries()]
    .map(([orderCode, list]) => ({
      orderCode,
      vendorName: list[0].serviceName ?? null,
      packageName: list.find((k) => k.packageName)?.packageName ?? null,
      serviceId: list.find((k) => k.serviceId)?.serviceId ?? null,
      done: list.filter((k) => k.isDone).length,
      total: list.length,
    }))
    .sort((a, b) => b.total - a.total)
}

/** Ngày thực hiện của đơn khi nó sau ngày cưới (đơn cũ hoặc khách đã đổi ngày cưới); không lệch thì null. Dùng cho thẻ Mốc chốt. */
export function dateConflictOf(kids: readonly TimelineItem[]): string | null {
  return kids.find((k) => k.dateConflict && k.orderEventDate)?.orderEventDate ?? null
}

/*
 * Cập nhật lạc quan cho việc chi tiết của đơn: tính trạng thái mới của MỘT việc ngay khi NCC bấm (trước khi API trả lời), cùng tiến độ đơn
 * tính tại chỗ từ danh sách việc. Hàm thuần, dùng chung cho Bảng việc, Lịch, Theo đơn và chi tiết đơn.
 */
import type { CalendarItem, OrderProgress, OrderTask, TaskStatus } from '@/types/vendorOrder'

/** Phần của một việc thay đổi khi NCC tick, kéo cột, chốt / đổi ngày. */
export interface TaskState {
  status: TaskStatus
  isDone: boolean
  completedDate: string | null
  dueDate: string
  dateStatus: 'PLANNED' | 'CONFIRMED'
  confirmedAt: string | null
  overdue: boolean
  needsRecheck: boolean
}

export type TaskChange =
  | { kind: 'status'; status: TaskStatus }
  /** "Chốt ngày này": giữ ngày hiện tại */
  | { kind: 'confirm' }
  | { kind: 'unconfirm' }
  /** Đổi sang ngày khác và chốt luôn */
  | { kind: 'date'; date: string }

export const stateOf = (t: Pick<OrderTask, 'status' | 'isDone' | 'completedDate' | 'dueDate' | 'dateStatus' | 'confirmedAt' | 'overdue' | 'needsRecheck'>): TaskState => ({
  status: t.status,
  isDone: t.isDone,
  completedDate: t.completedDate,
  dueDate: t.dueDate,
  dateStatus: t.dateStatus,
  confirmedAt: t.confirmedAt,
  overdue: t.overdue,
  needsRecheck: t.needsRecheck,
})

/** Trạng thái mới của việc sau một thao tác. `today` "YYYY-MM-DD", `nowIso` thời điểm bấm. */
export function patchState(prev: TaskState, change: TaskChange, today: string, nowIso: string): TaskState {
  switch (change.kind) {
    case 'status': {
      const isDone = change.status === 'Done'
      return { ...prev, status: change.status, isDone, completedDate: isDone ? nowIso : null, overdue: !isDone && !!prev.dueDate && prev.dueDate < today }
    }
    case 'confirm':
      return { ...prev, dateStatus: 'CONFIRMED', confirmedAt: nowIso, needsRecheck: false }
    case 'unconfirm':
      return { ...prev, dateStatus: 'PLANNED', confirmedAt: null }
    case 'date':
      return { ...prev, dueDate: change.date, dateStatus: 'CONFIRMED', confirmedAt: nowIso, needsRecheck: false, overdue: !prev.isDone && change.date < today }
  }
}

/** Áp trạng thái vào một việc của Bảng việc / Theo đơn (cùng tên trường). */
export const applyToTask = <T extends OrderTask>(t: T, s: TaskState): T => ({ ...t, ...s })

/** Áp trạng thái vào một mục TASK của Lịch (ngày là `date`, không phải `dueDate`). */
export function applyToCalendar(item: CalendarItem, s: TaskState): CalendarItem {
  if (item.kind !== 'TASK') return item
  return { ...item, date: s.dueDate, status: s.status, isDone: s.isDone, dateStatus: s.dateStatus, overdue: s.overdue }
}

const dayNum = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000)
/** Nhắc "sắp đến hạn": còn 0 đến 2 ngày (cùng ngưỡng với backend). */
const DUE_SOON_DAYS = 2

/**
 * Tiến độ đơn tính từ danh sách việc, cùng cách tính với backend (orderProgress): việc phía NCC là việc chưa ở trạng thái "Chờ khách".
 * Dùng để số đếm "N việc chưa xong / đang trễ" đổi ngay sau khi bấm mà không phải hỏi lại server.
 */
export function progressOf(items: readonly Pick<OrderTask, 'isDone' | 'status' | 'dueDate' | 'title' | 'overdue'>[], today: string): OrderProgress {
  const p: OrderProgress = { total: items.length, done: 0, next: null, open: 0, overdueVendor: 0, overdueCustomer: 0, dueSoonVendor: 0 }
  for (const t of items) {
    if (t.isDone) {
      p.done++
      continue
    }
    p.open++
    const late = t.overdue || (!!t.dueDate && t.dueDate < today)
    const vendorSide = t.status !== 'Waiting'
    if (vendorSide && (!p.next || t.dueDate < p.next.due)) p.next = { due: t.dueDate, title: t.title }
    if (late && vendorSide) p.overdueVendor++
    else if (late) p.overdueCustomer++
    else if (vendorSide && !!t.dueDate && dayNum(t.dueDate) - dayNum(today) <= DUE_SOON_DAYS) p.dueSoonVendor++
  }
  return p
}

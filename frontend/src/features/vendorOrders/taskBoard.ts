import type { BoardTask, TaskStatus } from '@/types/vendorOrder'

/*
 * Bảng việc (kanban) ở Lịch làm việc của NCC: chia việc vào cột, gom hàng theo đơn, luật kéo thả. Hàm thuần: không đụng giao diện, không đọc đồng hồ.
 * Trạng thái việc trong CSDL chỉ có Todo / Done (docs/database.md) nên kéo thả chỉ là đánh dấu xong / mở lại; không có cột "Đang làm",
 * không tự sắp thứ tự trong cột (display_order dùng chung với timeline của khách).
 */

/** customer: việc khách làm, chưa xong (NCC chỉ xem); todo: việc của NCC / hai bên chưa xong; done: đã xong. */
export type BoardColumn = 'customer' | 'todo' | 'done'

export const BOARD_COLUMNS: readonly { key: BoardColumn; title: string }[] = [
  { key: 'customer', title: 'Chờ khách làm' },
  { key: 'todo', title: 'Cần làm' },
  { key: 'done', title: 'Đã xong' },
]

type TaskState = Pick<BoardTask, 'isDone' | 'status'>

/** Cột theo trạng thái: Done là Đã xong, Waiting là Chờ khách làm, còn lại Cần làm. */
export const columnOf = (t: TaskState): BoardColumn => (t.isDone ? 'done' : t.status === 'Waiting' ? 'customer' : 'todo')

/** Trạng thái tương ứng với cột (kéo thả thẻ sang cột nào thì thành trạng thái đó). */
export const statusOfColumn = (c: BoardColumn): TaskStatus => (c === 'done' ? 'Done' : c === 'customer' ? 'Waiting' : 'Todo')

/** NCC chốt / đổi ngày tối đa sau ngày thực hiện bấy nhiêu ngày (khớp backend order-task-rules.ts). */
export const SCHEDULE_MAX_AFTER_EVENT = 120
/** Việc "Hai bên" chưa chốt lịch mà hạn còn từng này ngày (hoặc đã quá) thì nhắc "Cần chốt lịch". */
export const CONFIRM_SOON_DAYS = 7
const dayNum = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000)

/** Việc owner BOTH chưa xong, ngày mới là dự kiến (chưa chốt với khách) và hạn còn ≤ 7 ngày: "Cần chốt lịch". */
export const needsScheduleConfirm = (t: { owner: string; isDone: boolean; dateStatus: string; dueDate: string }, todayYmd: string) =>
  t.owner === 'BOTH' && !t.isDone && t.dateStatus !== 'CONFIRMED' && !!t.dueDate && dayNum(t.dueDate) - dayNum(todayYmd) <= CONFIRM_SOON_DAYS

/** Thả việc vào cột `to` được không: chỉ việc NCC được tick, chỉ giữa Cần làm và Đã xong, và phải đổi cột. */
/** NCC kéo được mọi việc của đơn mình sang cột khác. */
export const canMove = (t: TaskState, to: BoardColumn) => to !== columnOf(t)

/** order: mỗi đơn một hàng (mỗi hạng mục của đám cưới chỉ có một đơn đã cọc nên theo khách cũng là theo đơn); none: một hàng chung. */
export type BoardGroup = 'order' | 'none'

/** Khóa của hàng khi không gom. */
export const ALL_LANE = 'all'

export interface BoardLane {
  /** orderId, hoặc ALL_LANE khi không gom */
  key: string
  /** Đơn của hàng; null khi không gom */
  order: { id: string; code: string; customerName: string; eventDate: string } | null
  columns: Record<BoardColumn, BoardTask[]>
  total: number
  done: number
  /** Việc của NCC / hai bên chưa xong và quá hạn ("Trễ tiến độ") */
  late: number
  /** Số việc đã chốt lịch với khách (dateStatus CONFIRMED) */
  confirmed: number
  /** Tên gói gắn với đơn, ngăn cách bằng dấu phẩy; rỗng khi không có */
  packages: string
}

/** Hàng chứa việc `t` theo cách gom. */
export const laneKeyOf = (t: Pick<BoardTask, 'orderId'>, group: BoardGroup) => (group === 'order' ? t.orderId : ALL_LANE)

const byDue = (a: BoardTask, b: BoardTask) => a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title)
/** Cột Đã xong: việc xong gần nhất lên trên */
const byCompleted = (a: BoardTask, b: BoardTask) => (b.completedDate ?? '').localeCompare(a.completedDate ?? '') || byDue(a, b)

function laneOf(key: string, tasks: readonly BoardTask[], withOrder: boolean): BoardLane {
  const columns: Record<BoardColumn, BoardTask[]> = { customer: [], todo: [], done: [] }
  for (const t of tasks) columns[columnOf(t)].push(t)
  columns.customer.sort(byDue)
  columns.todo.sort(byDue)
  columns.done.sort(byCompleted)
  const first = tasks[0]
  return {
    key,
    order: withOrder && first ? { id: first.orderId, code: first.orderCode, customerName: first.customerName, eventDate: first.eventDate } : null,
    columns,
    total: tasks.length,
    done: columns.done.length,
    late: columns.todo.filter((t) => t.overdue).length,
    confirmed: tasks.filter((t) => t.dateStatus === 'CONFIRMED').length,
    packages: withOrder && first ? (first.packageNames ?? []).join(', ') : '',
  }
}

/**
 * Chia việc thành các hàng. Gom theo đơn: hàng có việc của NCC trễ nhiều hơn lên trước, rồi theo ngày thực hiện gần nhất, rồi mã đơn.
 * Trong cột: theo hạn tăng dần; cột Đã xong: xong gần nhất trước.
 */
export function boardLanes(tasks: readonly BoardTask[], group: BoardGroup): BoardLane[] {
  if (group === 'none') return tasks.length ? [laneOf(ALL_LANE, tasks, false)] : []
  const byOrder = new Map<string, BoardTask[]>()
  for (const t of tasks) byOrder.set(t.orderId, [...(byOrder.get(t.orderId) ?? []), t])
  return [...byOrder]
    .map(([id, list]) => laneOf(id, list, true))
    .sort((a, b) => b.late - a.late || a.order!.eventDate.localeCompare(b.order!.eventDate) || a.order!.code.localeCompare(b.order!.code))
}

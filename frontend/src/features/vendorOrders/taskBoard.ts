import type { BoardTask } from '@/types/vendorOrder'

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

type TaskState = Pick<BoardTask, 'isDone' | 'canTick'>

export const columnOf = (t: TaskState): BoardColumn => (t.isDone ? 'done' : t.canTick ? 'todo' : 'customer')

/** Thả việc vào cột `to` được không: chỉ việc NCC được tick, chỉ giữa Cần làm và Đã xong, và phải đổi cột. */
export const canMove = (t: TaskState, to: BoardColumn) => t.canTick && to !== 'customer' && to !== columnOf(t)

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

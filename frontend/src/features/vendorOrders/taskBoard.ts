import { TASK_LABELS } from '../../lib/taskLabels.ts'
import type { BoardTask, TaskStatus } from '@/types/vendorOrder'

/*
 * Bảng việc (kanban) ở Lịch làm việc của NCC: cột, luật kéo thả, nhắc chốt lịch, khoảng thời gian, lưu trữ, tìm kiếm. Hàm thuần: không đụng giao diện,
 * không đọc đồng hồ ("hôm nay" do nơi gọi truyền vào, "YYYY-MM-DD").
 * Cột theo trạng thái việc Todo / Waiting / Done (docs/TIMELINE.md "Hướng mới 11/2026"); NCC đổi được trạng thái mọi việc của đơn mình.
 * Không tự sắp thứ tự trong cột (display_order dùng chung với timeline của khách).
 * Nhiều khách (hàng trăm): không chia hàng theo khách mà luôn chỉ 3 cột, thu hẹp bằng khoảng thời gian, tìm kiếm, chọn khách;
 * đơn đã xong hết việc rời bảng sang Lưu trữ (splitBoard).
 */

/** customer: chờ khách (Waiting); todo: NCC đang làm (Todo); done: đã xong (Done). */
export type BoardColumn = 'customer' | 'todo' | 'done'

export const BOARD_COLUMNS: readonly { key: BoardColumn; title: string }[] = [
  { key: 'customer', title: TASK_LABELS.waitingCustomer },
  { key: 'todo', title: 'Cần làm' },
  { key: 'done', title: 'Đã xong' },
]

type TaskState = Pick<BoardTask, 'isDone' | 'status'>

/** Cột theo trạng thái: Done là Đã xong, Waiting là Chờ khách làm, còn lại Cần làm. */
export const columnOf = (t: TaskState): BoardColumn => (t.isDone ? 'done' : t.status === 'Waiting' ? 'customer' : 'todo')

/** Trạng thái tương ứng với cột (kéo thả thẻ sang cột nào thì thành trạng thái đó). */
export const statusOfColumn = (c: BoardColumn): TaskStatus => (c === 'done' ? 'Done' : c === 'customer' ? 'Waiting' : 'Todo')

/** NCC kéo được mọi việc của đơn mình sang cột khác. */
export const canMove = (t: TaskState, to: BoardColumn) => to !== columnOf(t)

const dayNum = (s: string) => Math.round(Date.parse(`${s.slice(0, 10)}T00:00:00Z`) / 86_400_000)

/** NCC chốt / đổi ngày tối đa sau ngày thực hiện bấy nhiêu ngày (khớp backend order-task-rules.ts). */
export const SCHEDULE_MAX_AFTER_EVENT = 120
/** Việc "Hai bên" chưa chốt lịch mà hạn còn từng này ngày (hoặc đã quá) thì nhắc "Cần chốt lịch". */
export const CONFIRM_SOON_DAYS = 7

/** Việc owner BOTH chưa xong, ngày mới là dự kiến (chưa chốt với khách) và hạn còn ≤ 7 ngày: "Cần chốt lịch". */
export const needsScheduleConfirm = (t: { owner: string; isDone: boolean; dateStatus: string; dueDate: string }, todayYmd: string) =>
  t.owner === 'BOTH' && !t.isDone && t.dateStatus !== 'CONFIRMED' && !!t.dueDate && dayNum(t.dueDate) - dayNum(todayYmd) <= CONFIRM_SOON_DAYS

/** "Sắp đến hạn" trong tóm tắt đầu bảng: hạn từ hôm nay đến từng này ngày tới. */
export const SOON_DAYS = 7

/** Khoảng thời gian của bảng (mặc định soon). */
export type BoardHorizon = 'soon' | 'month' | 'all'
export const HORIZONS: readonly { key: BoardHorizon; label: string; days: number | null }[] = [
  { key: 'soon', label: 'Quá hạn + 14 ngày tới', days: 14 },
  { key: 'month', label: '30 ngày tới', days: 30 },
  { key: 'all', label: 'Tất cả', days: null },
]

/**
 * Việc có nằm trong khoảng không. Chưa xong: quá hạn luôn hiện, còn lại hạn trong `days` ngày tới.
 * Đã xong: xong trong `days` ngày qua (việc xong từ lâu không chiếm chỗ); không rõ ngày xong thì coi như đã lâu.
 */
export function inHorizon(t: Pick<BoardTask, 'isDone' | 'dueDate' | 'completedDate'>, horizon: BoardHorizon, today: string): boolean {
  const days = HORIZONS.find((h) => h.key === horizon)?.days ?? null
  if (days === null) return true
  if (t.isDone) return !!t.completedDate && dayNum(today) - dayNum(t.completedDate) <= days
  return !t.dueDate || dayNum(t.dueDate) - dayNum(today) <= days
}

/** Đơn đã xong hết việc (trên bảng là đơn Đã cọc): chờ NCC bấm Hoàn tất đơn, nằm ở Lưu trữ. */
export interface FinishedOrder {
  orderId: string
  orderCode: string
  customerName: string
  eventDate: string
  total: number
}

/**
 * Tách việc trên bảng: `active` là việc của đơn còn ít nhất một việc chưa xong (tab Đang làm); `finished` là các đơn đã xong hết việc
 * (rời bảng, sang Lưu trữ > Chờ hoàn tất), sắp theo ngày thực hiện. Mở lại một việc thì đơn tự quay lại Đang làm.
 */
export function splitBoard(tasks: readonly BoardTask[]): { active: BoardTask[]; finished: FinishedOrder[] } {
  const byOrder = new Map<string, BoardTask[]>()
  for (const t of tasks) byOrder.set(t.orderId, [...(byOrder.get(t.orderId) ?? []), t])
  const active: BoardTask[] = []
  const finished: FinishedOrder[] = []
  for (const list of byOrder.values()) {
    if (list.some((t) => !t.isDone)) active.push(...list)
    else finished.push({ orderId: list[0].orderId, orderCode: list[0].orderCode, customerName: list[0].customerName, eventDate: list[0].eventDate, total: list.length })
  }
  finished.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.orderCode.localeCompare(b.orderCode))
  return { active, finished }
}

const byDue = (a: BoardTask, b: BoardTask) => a.dueDate.localeCompare(b.dueDate) || a.customerName.localeCompare(b.customerName) || a.title.localeCompare(b.title)

/** Thẻ trong từng cột, đã sắp: Cần làm và Chờ khách theo hạn (quá hạn tự nhiên đứng đầu); Đã xong: xong gần nhất trước. */
export function boardColumns(tasks: readonly BoardTask[]): Record<BoardColumn, BoardTask[]> {
  const out: Record<BoardColumn, BoardTask[]> = { customer: [], todo: [], done: [] }
  for (const t of tasks) out[columnOf(t)].push(t)
  out.customer.sort(byDue)
  out.todo.sort(byDue)
  out.done.sort((a, b) => (b.completedDate ?? '').localeCompare(a.completedDate ?? '') || byDue(a, b))
  return out
}

/**
 * Tóm tắt đầu bảng: việc Cần làm, trong đó quá hạn, sắp đến hạn (SOON_DAYS ngày tới); việc chờ khách; việc "Hai bên" cần chốt lịch
 * (needsScheduleConfirm, ở cột nào cũng tính).
 */
export function boardSummary(tasks: readonly BoardTask[], today: string) {
  const s = { todo: 0, late: 0, soon: 0, waiting: 0, confirm: 0 }
  for (const t of tasks) {
    if (needsScheduleConfirm(t, today)) s.confirm++
    const col = columnOf(t)
    if (col === 'customer') s.waiting++
    if (col !== 'todo') continue
    s.todo++
    if (t.overdue) s.late++
    else if (t.dueDate && dayNum(t.dueDate) - dayNum(today) <= SOON_DAYS) s.soon++
  }
  return s
}

/** Một đơn đang làm: khách, mã đơn, tên gói, số việc xong và số việc đã chốt lịch ("x/y việc xong · a/b đã chốt lịch"). */
export interface CustomerInfo {
  orderId: string
  customerName: string
  orderCode: string
  /** Số việc của NCC đang trễ ở đơn này */
  late: number
  packages: string
  done: number
  total: number
  confirmed: number
}

/** Mục của ô chọn Khách: mỗi đơn đang làm một mục; đơn có việc Cần làm trễ lên trước (kèm số việc trễ), rồi theo tên khách. */
export function customerOptions(tasks: readonly BoardTask[]): CustomerInfo[] {
  const map = new Map<string, CustomerInfo>()
  for (const t of tasks) {
    const o = map.get(t.orderId) ?? { orderId: t.orderId, customerName: t.customerName, orderCode: t.orderCode, late: 0, packages: (t.packageNames ?? []).join(', '), done: 0, total: 0, confirmed: 0 }
    o.total++
    if (t.isDone) o.done++
    if (t.dateStatus === 'CONFIRMED') o.confirmed++
    if (columnOf(t) === 'todo' && t.overdue) o.late++
    map.set(t.orderId, o)
  }
  return [...map.values()].sort((a, b) => b.late - a.late || a.customerName.localeCompare(b.customerName, 'vi'))
}

/** Bỏ dấu tiếng Việt, đ thành d, chữ thường: "Hùng" khớp "hung". */
const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()

/** Tìm trên bảng việc: mỗi từ khóa (không cần dấu) phải có trong tên khách, mã đơn, tên việc hoặc tên gói. */
export function matchesBoard(t: Pick<BoardTask, 'customerName' | 'orderCode' | 'title'> & { packageNames?: readonly string[] }, q: string): boolean {
  const terms = fold(q).split(/\s+/).filter(Boolean)
  if (!terms.length) return true
  const text = fold(`${t.customerName} ${t.orderCode} ${t.title} ${(t.packageNames ?? []).join(' ')}`)
  return terms.every((w) => text.includes(w))
}

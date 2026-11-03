/*
 * Thao tác của NCC trên việc chi tiết của đơn (tick, kéo đổi cột, chốt / bỏ chốt / đổi ngày): cập nhật lạc quan.
 *   1. Bấm là đổi giao diện NGAY (Bảng việc, Theo đơn, Lịch) bằng trạng thái tính tại chỗ (taskPatch.ts); API chạy nền.
 *   2. Chỉ khóa đúng việc đang xử lý (usePendingTask), các việc khác vẫn bấm bình thường.
 *   3. API trả đúng việc đã cập nhật: ghi đè vào cache cho việc đó (không tải lại cả danh sách, tiến độ, lịch, bảng); lỗi thì trả đúng việc đó
 *      về trạng thái cũ (không đụng việc khác đang được sửa) kèm thông báo.
 *   4. Việc thanh toán phần còn lại sang Done / về Waiting cũng cập nhật `restPayment` của đơn.
 */
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { useCallback, useSyncExternalStore } from 'react'
import { vendorOrdersApi } from '@/api/vendorOrders'
import { toast } from '@/components/ui/toast'
import { toISODate, today } from '@/lib/date'
import { markSelf } from '@/lib/selfEvents'
import { useAuth } from '@/store/auth'
import type { BoardTask, CalendarItem, NewOrderTaskInput, Order, OrderTask, OrderTasks, RestPayment } from '@/types/vendorOrder'
import { vendorKeys } from './keys'
import { joinTitle } from './taskTitle'
import { applyToCalendar, applyToTask, patchState, progressOf, stateOf, type TaskChange, type TaskState } from './taskPatch'

// ---------- Việc đang xử lý (spinner nhỏ trên đúng thẻ đó) ----------

const pending = new Set<string>()
const listeners = new Set<() => void>()
const setPending = (id: string, on: boolean) => {
  if (on) pending.add(id)
  else pending.delete(id)
  listeners.forEach((l) => l())
}
const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** true khi đúng việc này đang chờ server; việc khác không bị ảnh hưởng. */
export function usePendingTask(taskId: string): boolean {
  return useSyncExternalStore(subscribe, () => pending.has(taskId))
}

// ---------- Cache ----------

type Qc = QueryClient
const tasksKey = (uid: string | undefined, orderId: string) => vendorKeys.orderTasks(uid, orderId)

/** Đọc trạng thái hiện tại của một việc từ cache nào đang có nó (Bảng việc, Theo đơn, Lịch). */
export function readTaskState(qc: Qc, uid: string | undefined, orderId: string, taskId: string): TaskState | null {
  const onBoard = qc.getQueryData<BoardTask[]>(vendorKeys.taskBoard(uid))?.find((t) => t.id === taskId)
  if (onBoard) return stateOf(onBoard)
  const onOrder = qc.getQueryData<OrderTasks>(tasksKey(uid, orderId))?.items.find((t) => t.id === taskId)
  if (onOrder) return stateOf(onOrder)
  for (const [, items] of qc.getQueriesData<CalendarItem[]>({ queryKey: vendorKeys.calendar(uid) })) {
    const hit = items?.find((i) => i.kind === 'TASK' && i.id === taskId)
    if (hit && hit.kind === 'TASK') {
      return { status: hit.status, isDone: hit.isDone, completedDate: null, dueDate: hit.date, dateStatus: hit.dateStatus, confirmedAt: null, overdue: hit.overdue, needsRecheck: false }
    }
  }
  return null
}

/** Ghi trạng thái của một việc vào MỌI cache đang có nó; cache không có việc đó thì giữ nguyên tham chiếu (không vẽ lại). */
export function patchTaskEverywhere(qc: Qc, uid: string | undefined, orderId: string, taskId: string, s: TaskState) {
  qc.setQueryData<BoardTask[]>(vendorKeys.taskBoard(uid), (list) => (list?.some((t) => t.id === taskId) ? list.map((t) => (t.id === taskId ? applyToTask(t, s) : t)) : list))
  qc.setQueryData<OrderTasks>(tasksKey(uid, orderId), (d) => {
    if (!d?.items.some((t) => t.id === taskId)) return d
    const items = d.items.map((t) => (t.id === taskId ? applyToTask(t, s) : t))
    return { ...d, items, progress: progressOf(items, toISODate(today())) }
  })
  qc.setQueriesData<CalendarItem[]>({ queryKey: vendorKeys.calendar(uid) }, (list) =>
    list?.some((i) => i.kind === 'TASK' && i.id === taskId) ? list.map((i) => (i.kind === 'TASK' && i.id === taskId ? applyToCalendar(i, s) : i)) : list,
  )
}

/** Cập nhật `restPayment` của đơn ở mọi nơi có đơn (thẻ đơn, bảng đơn, chi tiết). Trả đợt 2 cũ (để trả lại khi lỗi). */
export function patchOrderRest(qc: Qc, uid: string | undefined, orderId: string, next: (prev: RestPayment) => RestPayment): RestPayment | null {
  let before: RestPayment | null = null
  const visit = (o: Order): Order => {
    if (o.id !== orderId || !o.restPayment) return o
    before ??= o.restPayment
    return { ...o, restPayment: next(o.restPayment) }
  }
  const walk = (data: unknown): unknown => {
    if (Array.isArray(data)) {
      let changed = false
      const out = data.map((x) => {
        const y = isOrder(x) ? visit(x) : x
        if (y !== x) changed = true
        return y
      })
      return changed ? out : data
    }
    if (isOrder(data)) return visit(data)
    if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown }).data)) {
      const inner = walk((data as { data: unknown[] }).data)
      return inner === (data as { data: unknown[] }).data ? data : { ...(data as object), data: inner }
    }
    return data
  }
  qc.setQueriesData({ queryKey: vendorKeys.all(uid) }, walk)
  return before
}

const isOrder = (x: unknown): x is Order => !!x && typeof x === 'object' && 'orderCode' in x && 'restPayment' in x

/** Việc "Thanh toán phần còn lại" của đơn trong cache (Bảng việc hoặc Theo đơn). */
function findPayTask(qc: Qc, uid: string | undefined, orderId: string): string | null {
  const b = qc.getQueryData<BoardTask[]>(vendorKeys.taskBoard(uid))?.find((t) => t.orderId === orderId && t.isRestPayment)
  if (b) return b.id
  return qc.getQueryData<OrderTasks>(tasksKey(uid, orderId))?.items.find((t) => t.isRestPayment)?.id ?? null
}

/** Làm mới tiến độ tóm tắt (nhãn "Trễ tiến độ") ở nền, gộp nhiều thao tác liên tiếp thành một lần. */
let progressTimer: ReturnType<typeof setTimeout> | undefined
function refreshProgressLater(qc: Qc, uid: string | undefined) {
  clearTimeout(progressTimer)
  progressTimer = setTimeout(() => void qc.invalidateQueries({ queryKey: vendorKeys.orderProgress(uid) }), 2500)
}

const stateFromItem = (item: OrderTask): TaskState => stateOf(item)
/** Thời gian hiện nút Hoàn tác sau khi đổi ngày (khớp SCHEDULE_UNDO_MS của backend, delayed-notice.ts). */
const UNDO_MS = 5000
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

// ---------- Hook ----------

export interface TaskActionMeta {
  /** Việc "Thanh toán phần còn lại": đổi trạng thái cũng đổi `restPayment` của đơn */
  isRestPayment?: boolean
}

/**
 * Thao tác trên MỘT việc. Trả hàm `run(orderId, taskId, change, meta?)`: đổi giao diện ngay rồi gọi API nền; true nếu thành công.
 * Việc đang xử lý (usePendingTask) bị bỏ qua nếu bấm lại; việc khác không bị ảnh hưởng.
 */
export function useTaskActions() {
  const { user } = useAuth()
  const uid = user?.role === 'VENDOR' ? user.id : undefined
  const qc = useQueryClient()

  /** Hoàn tác đổi ngày: đặt lại ngay ngày cũ và trạng thái xác nhận cũ, gọi API nền; lỗi thì trả lại ngày mới. */
  const undoDate = useCallback(
    async (orderId: string, taskId: string, prev: TaskState) => {
      if (pending.has(taskId)) return
      const current = readTaskState(qc, uid, orderId, taskId)
      markSelf(taskId)
      setPending(taskId, true)
      patchTaskEverywhere(qc, uid, orderId, taskId, prev)
      try {
        const res = await vendorOrdersApi.confirmTaskDate(orderId, taskId, prev.dueDate, { undo: true, confirmed: prev.dateStatus === 'CONFIRMED' })
        patchTaskEverywhere(qc, uid, orderId, taskId, stateFromItem(res.item))
        refreshProgressLater(qc, uid)
        toast('Đã hoàn tác, khách không nhận thông báo.')
      } catch (e) {
        if (current) patchTaskEverywhere(qc, uid, orderId, taskId, current)
        toast(errorText(e, 'Không hoàn tác được.'))
      } finally {
        setPending(taskId, false)
      }
    },
    [qc, uid],
  )

  return useCallback(
    async (orderId: string, taskId: string, change: TaskChange, meta: TaskActionMeta = {}): Promise<boolean> => {
      if (pending.has(taskId)) return false
      const prev = readTaskState(qc, uid, orderId, taskId)
      const now = new Date().toISOString()
      const todayYmd = toISODate(today())
      markSelf(taskId)
      setPending(taskId, true)

      // 1. Đổi giao diện ngay
      if (prev) patchTaskEverywhere(qc, uid, orderId, taskId, patchState(prev, change, todayYmd, now))
      let restBefore: RestPayment | null = null
      const restChange = meta.isRestPayment && change.kind === 'status'
      if (restChange) {
        const received = change.status === 'Done'
        restBefore = patchOrderRest(qc, uid, orderId, (r) => (r.status === 'NotApplicable' ? r : { ...r, status: received ? 'Received' : 'Pending', receivedDate: received ? now : null }))
      }

      // 2. API nền
      try {
        const res =
          change.kind === 'status'
            ? await vendorOrdersApi.setTaskStatus(orderId, taskId, change.status)
            : change.kind === 'unconfirm'
              ? await vendorOrdersApi.unconfirmTaskDate(orderId, taskId)
              : await vendorOrdersApi.confirmTaskDate(orderId, taskId, change.kind === 'date' ? change.date : undefined)
        // 3. Ghi đè đúng việc đó bằng dữ liệu server (không tải lại cả danh sách)
        patchTaskEverywhere(qc, uid, orderId, taskId, stateFromItem(res.item))
        refreshProgressLater(qc, uid)
        // Đổi ngày: 5 giây để Hoàn tác (trả ngày cũ + trạng thái xác nhận cũ); khách chỉ được báo sau khoảng này nếu không hoàn tác
        if (change.kind === 'date' && prev) {
          toast('Đã đổi ngày', UNDO_MS, { label: 'Hoàn tác', onClick: () => void undoDate(orderId, taskId, prev) })
        }
        return true
      } catch (e) {
        // Lỗi: trả đúng việc này (và đợt 2 của đơn) về như cũ
        if (prev) patchTaskEverywhere(qc, uid, orderId, taskId, prev)
        if (restChange && restBefore) patchOrderRest(qc, uid, orderId, () => restBefore!)
        toast(errorText(e, 'Không cập nhật được việc.'))
        return false
      } finally {
        setPending(taskId, false)
      }
    },
    [qc, uid, undoDate],
  )
}

/** Ghi nhận / bỏ ghi nhận tiền mặt đợt 2 cho cả đơn (menu "⋯", chi tiết đơn, "Chưa nhận"): đổi ngay, API nền, lỗi thì trả lại. */
export function useRestAction() {
  const { user } = useAuth()
  const uid = user?.role === 'VENDOR' ? user.id : undefined
  const qc = useQueryClient()

  return useCallback(
    async (orderId: string, received: boolean, code: string): Promise<boolean> => {
      const key = `rest:${orderId}`
      if (pending.has(key)) return false
      const now = new Date().toISOString()
      const todayYmd = toISODate(today())
      const payId = findPayTask(qc, uid, orderId)
      const prevPay = payId ? readTaskState(qc, uid, orderId, payId) : null
      if (payId) markSelf(payId)
      setPending(key, true)
      if (payId) setPending(payId, true)

      const restBefore = patchOrderRest(qc, uid, orderId, (r) => (r.status === 'NotApplicable' ? r : { ...r, status: received ? 'Received' : 'Pending', receivedDate: received ? now : null }))
      if (payId && prevPay) patchTaskEverywhere(qc, uid, orderId, payId, patchState(prevPay, { kind: 'status', status: received ? 'Done' : 'Waiting' }, todayYmd, now))

      try {
        const res = received ? await vendorOrdersApi.recordRestPayment(orderId) : await vendorOrdersApi.clearRestPayment(orderId)
        patchOrderRest(qc, uid, orderId, () => res.restPayment)
        refreshProgressLater(qc, uid)
        toast(received ? `Đã ghi nhận nhận đủ tiền mặt cho đơn ${code}.` : `Đã bỏ ghi nhận tiền mặt của đơn ${code}.`)
        return true
      } catch (e) {
        if (restBefore) patchOrderRest(qc, uid, orderId, () => restBefore)
        if (payId && prevPay) patchTaskEverywhere(qc, uid, orderId, payId, prevPay)
        toast(errorText(e, 'Không cập nhật được tiền mặt.'))
        return false
      } finally {
        setPending(key, false)
        if (payId) setPending(payId, false)
      }
    },
    [qc, uid],
  )
}

/** true khi đang ghi nhận / bỏ ghi nhận tiền mặt của đơn này (khóa các nút của đúng đơn đó). */
export const useRestPending = (orderId: string) => useSyncExternalStore(subscribe, () => pending.has(`rest:${orderId}`))

// ---------- Thêm / sửa / bỏ việc của MỘT đơn (cập nhật lạc quan) ----------

/** Áp `fn` lên danh sách việc của đơn trong cache "Theo đơn" và tính lại tiến độ tại chỗ. */
function mapOrderItems(qc: Qc, uid: string | undefined, orderId: string, fn: (items: OrderTask[]) => OrderTask[]) {
  qc.setQueryData<OrderTasks>(tasksKey(uid, orderId), (d) => {
    if (!d) return d
    const items = fn(d.items)
    return { ...d, items, progress: progressOf(items, toISODate(today())) }
  })
}

const byDueDate = <T extends { dueDate: string }>(list: T[]) => [...list].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
/** Tên việc trên timeline = tên + " — " + ghi chú (cùng cách ghép với backend, taskTitle). */
const composeTitle = joinTitle

/** Thông tin đơn cần để dựng một thẻ việc ở Bảng việc / Lịch, lấy từ chính các cache đang có việc của đơn đó. */
interface OrderCtx {
  orderCode: string
  customerName: string
  eventDate: string
  packageNames: string[]
  restAmount: number
}

function orderCtxOf(qc: Qc, uid: string | undefined, orderId: string): OrderCtx | null {
  const b = qc.getQueryData<BoardTask[]>(vendorKeys.taskBoard(uid))?.find((t) => t.orderId === orderId)
  if (b) return { orderCode: b.orderCode, customerName: b.customerName, eventDate: b.eventDate, packageNames: b.packageNames, restAmount: b.restAmount }
  for (const [, list] of qc.getQueriesData<CalendarItem[]>({ queryKey: vendorKeys.calendar(uid) })) {
    const c = list?.find((i) => i.kind === 'TASK' && i.orderId === orderId)
    if (c && c.kind === 'TASK') return { orderCode: c.orderCode, customerName: c.customerName, eventDate: c.eventDate, packageNames: [], restAmount: 0 }
  }
  return null
}

const calendarRank = (i: CalendarItem) => (i.kind === 'ORDER' ? 0 : i.isDone ? 2 : 1)
const sortCalendar = (list: CalendarItem[]) => [...list].sort((a, b) => a.date.localeCompare(b.date) || calendarRank(a) - calendarRank(b))

/**
 * Chèn một việc MỚI vào Bảng việc và mọi khoảng Lịch đang có trong cache (khoảng chứa ngày của việc). Trả false nếu có cache chưa chèn được
 * (chưa biết thông tin đơn): khi đó nơi gọi làm mới cache đó ở nền.
 */
function insertTaskEverywhere(qc: Qc, uid: string | undefined, orderId: string, item: OrderTask): boolean {
  const ctx = orderCtxOf(qc, uid, orderId)
  let complete = true
  if (qc.getQueryData<BoardTask[]>(vendorKeys.taskBoard(uid))) {
    if (ctx) qc.setQueryData<BoardTask[]>(vendorKeys.taskBoard(uid), (list) => (list ? byDueDate([...list, { ...item, orderId, ...ctx }]) : list))
    else complete = false
  }
  for (const [key, list] of qc.getQueriesData<CalendarItem[]>({ queryKey: vendorKeys.calendar(uid) })) {
    const [, , , from, to] = key as readonly string[]
    if (!list || !from || !to || item.dueDate < from || item.dueDate > to) continue
    if (!ctx) {
      complete = false
      continue
    }
    const row: CalendarItem = {
      kind: 'TASK',
      id: item.id,
      orderId,
      orderCode: ctx.orderCode,
      customerName: ctx.customerName,
      title: item.title,
      date: item.dueDate,
      eventDate: ctx.eventDate,
      isRestPayment: false,
      isPackageTask: false,
      isCustomOrderTask: true,
      isDone: false,
      status: item.status,
      dateStatus: item.dateStatus,
      owner: item.owner,
      canTick: true,
      overdue: item.overdue,
    }
    qc.setQueryData<CalendarItem[]>(key, sortCalendar([...list, row]))
  }
  return complete
}

/** Thay việc tạm (id `tmp:...`) bằng việc thật server trả về, ở Bảng việc và Lịch (Theo đơn do nơi gọi tự thay). */
function replaceTaskEverywhere(qc: Qc, uid: string | undefined, tmpId: string, real: OrderTask) {
  qc.setQueryData<BoardTask[]>(vendorKeys.taskBoard(uid), (list) => (list?.some((t) => t.id === tmpId) ? byDueDate(list.map((t) => (t.id === tmpId ? { ...t, ...real } : t))) : list))
  qc.setQueriesData<CalendarItem[]>({ queryKey: vendorKeys.calendar(uid) }, (list) =>
    list?.some((i) => i.kind === 'TASK' && i.id === tmpId)
      ? sortCalendar(list.map((i) => (i.kind === 'TASK' && i.id === tmpId ? { ...i, id: real.id, title: real.title, date: real.dueDate, status: real.status, dateStatus: real.dateStatus, owner: real.owner } : i)))
      : list,
  )
}

/** Gỡ một việc khỏi Theo đơn, Bảng việc và Lịch. */
function dropTaskEverywhere(qc: Qc, uid: string | undefined, orderId: string, taskId: string) {
  qc.setQueryData<BoardTask[]>(vendorKeys.taskBoard(uid), (list) => list?.filter((t) => t.id !== taskId))
  mapOrderItems(qc, uid, orderId, (items) => items.filter((t) => t.id !== taskId))
  qc.setQueriesData<CalendarItem[]>({ queryKey: vendorKeys.calendar(uid) }, (list) => list?.filter((i) => !(i.kind === 'TASK' && i.id === taskId)))
}

type TaskFields = Partial<Pick<OrderTask, 'title' | 'owner' | 'status'>>

/** Ghi tên / chủ / trạng thái của một việc vào Bảng việc, Theo đơn và Lịch. */
function patchFields(qc: Qc, uid: string | undefined, orderId: string, taskId: string, f: TaskFields) {
  qc.setQueryData<BoardTask[]>(vendorKeys.taskBoard(uid), (list) => (list?.some((t) => t.id === taskId) ? list.map((t) => (t.id === taskId ? { ...t, ...f } : t)) : list))
  qc.setQueryData<OrderTasks>(tasksKey(uid, orderId), (d) => {
    if (!d?.items.some((t) => t.id === taskId)) return d
    const items = d.items.map((t) => (t.id === taskId ? { ...t, ...f } : t))
    return { ...d, items, progress: progressOf(items, toISODate(today())) }
  })
  qc.setQueriesData<CalendarItem[]>({ queryKey: vendorKeys.calendar(uid) }, (list) =>
    list?.some((i) => i.kind === 'TASK' && i.id === taskId) ? list.map((i) => (i.kind === 'TASK' && i.id === taskId ? { ...i, ...f } : i)) : list,
  )
}

/**
 * NCC thêm / sửa / bỏ việc của MỘT đơn đã cọc (gói và các đơn khác không đổi). Đổi giao diện ngay, API chạy nền, lỗi thì trả lại đúng việc đó:
 *   add: chèn việc tạm vào "Theo đơn" (đã chốt ngày), khi server trả thì thay bằng việc thật; lỗi thì bỏ việc tạm.
 *   edit: đổi tên / chủ ngay; lỗi thì trả tên / chủ cũ.
 *   remove: gỡ việc khỏi Bảng việc, Theo đơn, Lịch ngay; lỗi thì đặt lại đúng chỗ.
 */
export function useOrderTaskEdits() {
  const { user } = useAuth()
  const uid = user?.role === 'VENDOR' ? user.id : undefined
  const qc = useQueryClient()

  const add = useCallback(
    async (orderId: string, input: NewOrderTaskInput): Promise<boolean> => {
      const tmpId = `tmp:${Math.random().toString(36).slice(2)}`
      const now = new Date().toISOString()
      const item: OrderTask = {
        id: tmpId,
        title: composeTitle(input.title, input.note),
        dueDate: input.date,
        isDone: false,
        completedDate: null,
        owner: input.owner,
        status: input.owner === 'CUSTOMER' ? 'Waiting' : 'Todo',
        canTick: true,
        overdue: false,
        isPackageTask: false,
        isCustomOrderTask: true,
        isRestPayment: false,
        dateStatus: 'CONFIRMED',
        confirmedAt: now,
        needsRecheck: false,
      }
      setPending(tmpId, true)
      mapOrderItems(qc, uid, orderId, (items) => byDueDate([...items, item]))
      const inserted = insertTaskEverywhere(qc, uid, orderId, item)
      try {
        const res = await vendorOrdersApi.addOrderTask(orderId, input)
        markSelf(res.item.id)
        mapOrderItems(qc, uid, orderId, (items) => byDueDate(items.map((t) => (t.id === tmpId ? res.item : t))))
        replaceTaskEverywhere(qc, uid, tmpId, res.item)
        // Chỉ khi chưa chèn được vào Bảng việc / Lịch (chưa biết thông tin đơn) mới phải tải lại chúng; còn lại không chờ refetch
        if (!inserted) {
          void qc.invalidateQueries({ queryKey: vendorKeys.taskBoard(uid) })
          void qc.invalidateQueries({ queryKey: vendorKeys.calendar(uid) })
        }
        refreshProgressLater(qc, uid)
        toast(res.addedToPackage ? 'Đã thêm việc cho đơn và vào quy trình của gói (áp cho các đơn sau).' : 'Đã thêm việc cho đơn này.')
        return true
      } catch (e) {
        dropTaskEverywhere(qc, uid, orderId, tmpId)
        toast(errorText(e, 'Không thêm được việc.'))
        return false
      } finally {
        setPending(tmpId, false)
      }
    },
    [qc, uid],
  )

  const edit = useCallback(
    async (orderId: string, task: Pick<OrderTask, 'id' | 'title' | 'owner' | 'status'>, patch: { title: string; note: string | null; owner: OrderTask['owner'] }): Promise<boolean> => {
      if (pending.has(task.id)) return false
      markSelf(task.id)
      setPending(task.id, true)
      const ownerChanged = patch.owner !== task.owner
      patchFields(qc, uid, orderId, task.id, { title: composeTitle(patch.title, patch.note), owner: patch.owner, ...(ownerChanged && { status: patch.owner === 'CUSTOMER' ? 'Waiting' : 'Todo' }) })
      try {
        const res = await vendorOrdersApi.updateOrderTask(orderId, task.id, patch)
        patchFields(qc, uid, orderId, task.id, { title: res.item.title, owner: res.item.owner, status: res.item.status })
        refreshProgressLater(qc, uid)
        toast('Đã cập nhật việc.')
        return true
      } catch (e) {
        patchFields(qc, uid, orderId, task.id, { title: task.title, owner: task.owner, status: task.status })
        toast(errorText(e, 'Không sửa được việc.'))
        return false
      } finally {
        setPending(task.id, false)
      }
    },
    [qc, uid],
  )

  const remove = useCallback(
    async (orderId: string, taskId: string): Promise<boolean> => {
      if (pending.has(taskId)) return false
      const onBoard = qc.getQueryData<BoardTask[]>(vendorKeys.taskBoard(uid))?.find((t) => t.id === taskId)
      const onOrder = qc.getQueryData<OrderTasks>(tasksKey(uid, orderId))?.items.find((t) => t.id === taskId)
      const calendars = qc.getQueriesData<CalendarItem[]>({ queryKey: vendorKeys.calendar(uid) }).filter(([, list]) => list?.some((i) => i.kind === 'TASK' && i.id === taskId))
      markSelf(taskId)
      setPending(taskId, true)
      dropTaskEverywhere(qc, uid, orderId, taskId)
      try {
        await vendorOrdersApi.removeOrderTask(orderId, taskId)
        refreshProgressLater(qc, uid)
        toast('Đã bỏ việc khỏi đơn.')
        return true
      } catch (e) {
        // Đặt lại đúng việc này (không đụng việc khác đang được sửa)
        if (onBoard) qc.setQueryData<BoardTask[]>(vendorKeys.taskBoard(uid), (list) => (list && !list.some((t) => t.id === taskId) ? byDueDate([...list, onBoard]) : list))
        if (onOrder) mapOrderItems(qc, uid, orderId, (items) => (items.some((t) => t.id === taskId) ? items : byDueDate([...items, onOrder])))
        for (const [key, list] of calendars) qc.setQueryData(key, list)
        toast(errorText(e, 'Không bỏ được việc.'))
        return false
      } finally {
        setPending(taskId, false)
      }
    },
    [qc, uid],
  )

  return { add, edit, remove }
}

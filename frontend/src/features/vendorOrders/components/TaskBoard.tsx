import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Check } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { shortCouple } from '@/features/calendar/orderColors'
import { daysBetween, formatDate, parseDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { BoardTask, TaskOwner } from '@/types/vendorOrder'
import { useMoveBoardTask, useRescheduleTask } from '../hooks'
import { BOARD_COLUMNS, boardColumns, canMove, needsScheduleConfirm, statusOfColumn, type BoardColumn } from '../taskBoard'
import { TaskDateDialog } from './TaskDateDialog'

/** Mỗi cột hiện từng này thẻ, bấm "Xem thêm" để hiện thêm từng ấy nữa (vài trăm việc vẫn nhẹ trang). */
const PAGE = 20

const OWNER: Record<TaskOwner, { label: string; tone: BadgeTone }> = {
  CUSTOMER: { label: 'Khách làm', tone: 'neutral' },
  VENDOR: { label: 'NCC làm', tone: 'talk' },
  BOTH: { label: 'Hai bên', tone: 'info' },
}

const COLUMN_TITLE = Object.fromEntries(BOARD_COLUMNS.map((c) => [c.key, c.title])) as Record<BoardColumn, string>

/** Dữ liệu gắn với ô thả (một cột) */
interface CellData {
  column: BoardColumn
}

const hueStripe = (hue: number): CSSProperties => ({ boxShadow: `inset 3px 0 0 hsl(${hue} 60% 48%)` })

/** Chuột / cảm ứng: ô dưới con trỏ; bàn phím (không có con trỏ): ô chồng lên thẻ đang kéo. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

/** Nội dung thẻ việc (dùng cho thẻ trên bảng và thẻ đang kéo): tên việc, khách và mã đơn, hạn, chốt lịch, chủ việc. */
function CardBody({ task }: { task: BoardTask }) {
  // Sắp đến hạn: còn 0 đến 2 ngày (cùng ngưỡng với thông báo của backend)
  const soon = !task.isDone && !task.overdue && !!task.dueDate && daysBetween(today(), parseDate(task.dueDate)) <= 2
  const confirmSoon = needsScheduleConfirm(task, toISODate(today()))
  const owner = OWNER[task.owner]
  const packages = (task.packageNames ?? []).join(', ')
  return (
    <>
      <p className={cn('text-[13.5px] leading-snug font-medium [overflow-wrap:anywhere]', task.isDone && 'text-muted-foreground line-through')}>{task.title}</p>
      <p className="mt-0.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]" title={packages ? `${task.customerName} · Gói ${packages}` : task.customerName}>
        {shortCouple(task.customerName)} · {task.orderCode}
      </p>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
        <span className={cn(task.overdue && 'font-semibold text-warn')}>Hạn {formatDate(task.dueDate)}</span>
        {task.overdue && <span className="font-semibold text-warn">· Quá hạn</span>}
        {soon && <span className="font-semibold text-gold-ink">· Sắp đến hạn</span>}
        {confirmSoon && <span className="font-semibold text-warn">· Cần chốt lịch</span>}
        {task.dateStatus === 'CONFIRMED' && !task.isDone && <span>· Đã chốt</span>}
        <Badge tone={owner.tone} className="ml-auto">
          {owner.label}
        </Badge>
      </p>
      {task.needsRecheck && (
        <p className="mt-1 flex items-start gap-1.5 text-[12px] font-medium text-warn">
          <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-warn" />
          Ngày thực hiện đã đổi — kiểm tra lại lịch đã chốt
        </p>
      )}
    </>
  )
}

interface CardProps {
  task: BoardTask
  hue: number
  busy: boolean
  onToggle: (t: BoardTask) => void
  onReschedule: (t: BoardTask) => void
}

/**
 * Thẻ việc: kéo được (nắm vào phần chữ), có ô tick cho ai không kéo được và nút "Đổi ngày…" khi chưa xong.
 * Ô tick và nút Đổi ngày nằm ngoài vùng kéo để Enter / Space trên đó không nhấc thẻ lên.
 */
function BoardCard({ task, hue, busy, onToggle, onReschedule }: CardProps) {
  const confirmSoon = needsScheduleConfirm(task, toISODate(today()))
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !task.canTick,
    attributes: { roleDescription: 'việc kéo được' },
  })
  return (
    <li
      ref={setNodeRef}
      style={hueStripe(hue)}
      className={cn(
        'flex items-start gap-2.5 rounded-md border bg-surface py-2.5 pr-3 pl-3.5 shadow-card',
        task.overdue ? 'border-warn/60' : confirmSoon ? 'border-orange-400' : 'border-line',
        isDragging && 'opacity-40',
      )}
    >
      {task.canTick ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={task.isDone}
          aria-label={`${task.isDone ? 'Mở lại' : 'Hoàn thành'}: ${task.title}`}
          disabled={busy}
          onClick={() => onToggle(task)}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-60',
            task.isDone ? 'border-sage bg-sage text-white' : 'border-line-strong bg-surface hover:border-sage',
          )}
        >
          {task.isDone && <Check className="size-3" strokeWidth={3} aria-hidden />}
        </button>
      ) : (
        <span aria-hidden className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2', task.isDone ? 'border-sage bg-sage text-white' : 'border-line bg-surface-2')}>
          {task.isDone && <Check className="size-3" strokeWidth={3} />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        {task.canTick ? (
          <div
            ref={setActivatorNodeRef}
            {...listeners}
            {...attributes}
            className="cursor-grab touch-manipulation rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage active:cursor-grabbing"
          >
            <CardBody task={task} />
          </div>
        ) : (
          <CardBody task={task} />
        )}
        {task.canTick && !task.isDone && (
          <button type="button" onClick={() => onReschedule(task)} className="mt-1 text-[12px] font-medium text-gold-ink underline underline-offset-2">
            Đổi ngày…
          </button>
        )}
      </div>
    </li>
  )
}

/** Một cột của bảng: nhận thả khi việc đang kéo được chuyển sang cột này. */
function BoardCell({ column, children }: { column: BoardColumn; children: ReactNode }) {
  const dragged = useDndContext().active?.data.current?.task as BoardTask | undefined
  const valid = !!dragged && canMove(dragged, column)
  const { setNodeRef, isOver } = useDroppable({ id: column, data: { column } satisfies CellData, disabled: !valid })
  return (
    <ul
      ref={setNodeRef}
      aria-label={COLUMN_TITLE[column]}
      className={cn(
        'flex min-h-24 flex-col gap-2 rounded-lg border border-transparent bg-surface-2/60 p-2 transition-colors',
        valid && 'border-dashed border-sage/60',
        valid && isOver && 'border-solid border-sage bg-sage-soft',
      )}
    >
      {children}
    </ul>
  )
}

interface TaskBoardProps {
  /** Việc đã qua bộ lọc của trang (khoảng thời gian, khách, Việc của tôi, tìm kiếm); chỉ đơn còn việc (đơn xong hết việc ở Lưu trữ) */
  tasks: readonly BoardTask[]
  hueFor: (orderId: string) => number
  /** Ẩn cột Chờ khách làm (bộ lọc "Việc của tôi") */
  hideCustomer: boolean
  /** Lời khi không có việc nào khớp bộ lọc */
  emptyText: string
}

/**
 * Bảng việc (kanban) của Lịch làm việc (docs/TIMELINE.md mục 9.2): luôn 3 cột Chờ khách làm / Cần làm / Đã xong, không chia hàng theo khách
 * nên hàng trăm khách vẫn gọn; mỗi thẻ ghi khách và mã đơn, mỗi cột PAGE thẻ kèm "Xem thêm". Trang thu hẹp bằng khoảng thời gian, chọn khách,
 * tìm kiếm (đổi bộ lọc thì trang đặt lại số thẻ đang hiện qua `key`).
 * NCC kéo mọi việc của đơn mình giữa các cột = đổi trạng thái Waiting / Todo / Done (PATCH việc của đơn); "Đổi ngày…" chốt ngày mới với khách.
 * Chuột: kéo ngay; cảm ứng: nhấn giữ rồi kéo (để vẫn cuộn được); bàn phím: Space / Enter nhấc, mũi tên di chuyển, Space / Enter thả, Esc hủy.
 */
export function TaskBoard({ tasks, hueFor, hideCustomer, emptyText }: TaskBoardProps) {
  const move = useMoveBoardTask()
  const reschedule = useRescheduleTask()
  const [rescheduling, setRescheduling] = useState<BoardTask | null>(null)
  const [dragging, setDragging] = useState<BoardTask | null>(null)
  const [shown, setShown] = useState<Record<BoardColumn, number>>({ customer: PAGE, todo: PAGE, done: PAGE })
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const columns = BOARD_COLUMNS.filter((c) => !(hideCustomer && c.key === 'customer'))
  const cols = boardColumns(tasks)
  // Bỏ tick: việc của khách về Chờ khách, còn lại về Cần làm
  const toggle = (t: BoardTask) => move.mutate({ orderId: t.orderId, taskId: t.id, status: t.isDone ? (t.owner === 'CUSTOMER' ? 'Waiting' : 'Todo') : 'Done' })
  const busyId = move.isPending ? move.variables?.taskId : undefined

  const titleOf = (data: unknown) => (data as { task?: BoardTask } | undefined)?.task?.title ?? 'việc'
  const columnOfOver = (data: unknown) => COLUMN_TITLE[(data as CellData | undefined)?.column ?? 'todo']
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Đã nhấc việc ${titleOf(active.data.current)}.`,
    onDragOver: ({ active, over }) => (over ? `Việc ${titleOf(active.data.current)} đang ở trên cột ${columnOfOver(over.data.current)}.` : `Việc ${titleOf(active.data.current)} chưa ở trên cột nào thả được.`),
    onDragEnd: ({ active, over }) => (over ? `Đã thả việc ${titleOf(active.data.current)} vào cột ${columnOfOver(over.data.current)}.` : `Đã thả việc ${titleOf(active.data.current)}, không có gì thay đổi.`),
    onDragCancel: ({ active }) => `Đã hủy kéo việc ${titleOf(active.data.current)}.`,
  }

  const onDragStart = (e: DragStartEvent) => setDragging((e.active.data.current?.task as BoardTask | undefined) ?? null)
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null)
    const task = active.data.current?.task as BoardTask | undefined
    const cell = over?.data.current as CellData | undefined
    if (!task || !cell || !canMove(task, cell.column)) return
    move.mutate({ orderId: task.orderId, taskId: task.id, status: statusOfColumn(cell.column) })
  }

  if (!tasks.length) return <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-muted-foreground">{emptyText}</p>

  const grid: CSSProperties = { gridTemplateColumns: `repeat(${columns.length}, minmax(240px, 1fr))` }
  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={collision}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: 'Nhấn Space hoặc Enter để nhấc việc, dùng phím mũi tên để di chuyển sang cột khác, nhấn Space hoặc Enter để thả, Esc để hủy.' },
        }}
      >
        <div className="overflow-x-auto pb-2">
          <div className="grid items-start gap-x-3 gap-y-2" style={grid}>
            {columns.map((c) => (
              <h3 key={c.key} className="flex items-baseline gap-2 px-1 pb-1 font-sans text-[12.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {c.title}
                <span className="font-semibold tracking-normal">{cols[c.key].length}</span>
              </h3>
            ))}
            {columns.map((c) => {
              const list = cols[c.key]
              const rest = list.length - shown[c.key]
              return (
                <BoardCell key={c.key} column={c.key}>
                  {list.slice(0, shown[c.key]).map((t) => (
                    <BoardCard key={t.id} task={t} hue={hueFor(t.orderId)} busy={busyId === t.id} onToggle={toggle} onReschedule={setRescheduling} />
                  ))}
                  {list.length === 0 && <li className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">Không có việc</li>}
                  {rest > 0 && (
                    <li>
                      <button
                        type="button"
                        onClick={() => setShown((s) => ({ ...s, [c.key]: s[c.key] + PAGE }))}
                        className="w-full rounded-md border border-dashed border-line-strong px-2 py-2 text-[12.5px] font-semibold text-gold-700 hover:bg-surface focus-visible:outline-2 focus-visible:outline-sage"
                      >
                        Xem thêm {Math.min(PAGE, rest)} việc (còn {rest})
                      </button>
                    </li>
                  )}
                </BoardCell>
              )
            })}
          </div>
        </div>
        <DragOverlay dropAnimation={null}>
          {dragging && (
            <div style={hueStripe(hueFor(dragging.orderId))} className="w-[260px] rotate-1 cursor-grabbing rounded-md border border-sage bg-surface py-2.5 pr-3 pl-3.5 shadow-lg">
              <CardBody task={dragging} />
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <TaskDateDialog
        target={rescheduling && { title: rescheduling.title, dueDate: rescheduling.dueDate, eventDate: rescheduling.eventDate }}
        busy={reschedule.isPending}
        onClose={() => setRescheduling(null)}
        onPick={(date) => rescheduling && reschedule.mutate({ orderId: rescheduling.orderId, taskId: rescheduling.id, date }, { onSuccess: () => setRescheduling(null) })}
      />
    </>
  )
}

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
import { Check, Loader2 } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { shortCouple } from '@/features/calendar/orderColors'
import { daysBetween, parseDate, toISODate, today } from '@/lib/date'
import { TASK_LABELS } from '@/lib/taskLabels'
import { cn } from '@/lib/utils'
import type { BoardTask, TaskOwner } from '@/types/vendorOrder'
import { usePendingTask, useTaskActions } from '../taskActions'
import { RestReceivedDialog } from './RestReceivedDialog'
import { BOARD_COLUMNS, boardColumns, canMove, needsScheduleConfirm, statusOfColumn, type BoardColumn } from '../taskBoard'
import { DateChip, TaskDateRow } from './TaskDateRow'
import { CustomTaskTag, TaskMenu } from './TaskMenu'
import { TaskTitle } from './TaskTitle'

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
/** Hàng chủ việc của thẻ: nhãn cảnh báo bên trái; bên phải [menu ⋯] [Thêm riêng] [chủ việc] — nhãn chủ việc sát mép phải, thẳng với cụm nút ngày. */
function CardMeta({ task, menu }: { task: BoardTask; menu?: ReactNode }) {
  // Sắp đến hạn: còn 0 đến 2 ngày (cùng ngưỡng với thông báo của backend)
  const soon = !task.isDone && !task.overdue && !!task.dueDate && daysBetween(today(), parseDate(task.dueDate)) <= 2
  const confirmSoon = needsScheduleConfirm(task, toISODate(today()))
  const owner = OWNER[task.owner]
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
      {soon && <span className="font-semibold text-gold-ink">Sắp đến hạn</span>}
      {confirmSoon && <span className="font-semibold text-warn">{TASK_LABELS.needsConfirmDate}</span>}
      <span className="ml-auto flex items-center gap-1.5">
        {menu}
        {task.isCustomOrderTask && <CustomTaskTag />}
        <Badge tone={owner.tone}>{owner.label}</Badge>
      </span>
    </div>
  )
}

function CardBody({ task }: { task: BoardTask }) {
  const packages = (task.packageNames ?? []).join(', ')
  return (
    <>
      <TaskTitle title={task.title} className={cn('text-[13.5px] leading-snug font-semibold [overflow-wrap:anywhere]', task.isDone && 'text-muted-foreground line-through')} />
      <p className="mt-0.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]" title={packages ? `${task.customerName} · Gói ${packages}` : task.customerName}>
        {shortCouple(task.customerName)} · {task.orderCode}
        {packages && ` · Gói ${packages}`}
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
  onToggle: (t: BoardTask) => void
}

/**
 * Thẻ việc: kéo được (nắm vào phần chữ), có ô tick và nhãn ngày bấm được ("Dự kiến …" / "Đã chốt … ✓", bấm mở popover chốt / đổi ngày).
 * Chỉ thẻ đang xử lý bị khóa (spinner nhỏ ở ô tick); thẻ khác vẫn bấm và kéo được.
 */
function BoardCard({ task, hue, onToggle }: CardProps) {
  const run = useTaskActions()
  const busy = usePendingTask(task.id)
  const confirmSoon = needsScheduleConfirm(task, toISODate(today()))
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: task.id,
    data: { task },
    disabled: !task.canTick || busy,
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
          aria-busy={busy}
          aria-label={`${task.isDone ? 'Mở lại' : 'Hoàn thành'}: ${task.title}`}
          disabled={busy}
          onClick={() => onToggle(task)}
          className={cn(
            'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage',
            task.isDone ? 'border-sage bg-sage text-white' : 'border-line-strong bg-surface hover:border-sage',
          )}
        >
          {busy ? <Loader2 className="size-3 animate-spin" aria-hidden /> : task.isDone && <Check className="size-3" strokeWidth={3} aria-hidden />}
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
        <CardMeta task={task} menu={<TaskMenu task={task} orderId={task.orderId} customerName={task.customerName} eventDate={task.eventDate} readOnly={!task.canTick} />} />
        <div className="mt-1.5">
          <TaskDateRow
            dueDate={task.dueDate}
            eventDate={task.eventDate}
            confirmed={task.dateStatus === 'CONFIRMED'}
            overdue={task.overdue}
            isDone={task.isDone}
            readOnly={!task.canTick}
            busy={busy}
            onPickDate={(date) => void run(task.orderId, task.id, { kind: 'date', date })}
            onConfirm={() => void run(task.orderId, task.id, { kind: 'confirm' })}
            onUnconfirm={() => void run(task.orderId, task.id, { kind: 'unconfirm' })}
          />
        </div>
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
  /** Số việc bị khoảng thời gian ẩn theo cột (hạn xa hoặc xong đã lâu), để cột trống nói rõ còn việc */
  hidden?: Readonly<Record<BoardColumn, number>>
  /** "Xem tất cả": đổi khoảng thời gian sang Tất cả */
  onShowAll?: () => void
}

/**
 * Bảng việc (kanban) của Lịch làm việc (docs/TIMELINE.md mục 9.2): luôn 3 cột Chờ khách làm / Cần làm / Đã xong, không chia hàng theo khách
 * nên hàng trăm khách vẫn gọn; mỗi thẻ ghi khách và mã đơn, mỗi cột PAGE thẻ kèm "Xem thêm". Trang thu hẹp bằng khoảng thời gian, chọn khách,
 * tìm kiếm (đổi bộ lọc thì trang đặt lại số thẻ đang hiện qua `key`).
 * NCC kéo mọi việc của đơn mình giữa các cột = đổi trạng thái Waiting / Todo / Done (PATCH việc của đơn); "Đổi ngày…" chốt ngày mới với khách.
 * Chuột: kéo ngay; cảm ứng: nhấn giữ rồi kéo (để vẫn cuộn được); bàn phím: Space / Enter nhấc, mũi tên di chuyển, Space / Enter thả, Esc hủy.
 */
export function TaskBoard({ tasks, hueFor, hideCustomer, emptyText, hidden, onShowAll }: TaskBoardProps) {
  const run = useTaskActions()
  // Việc "Thanh toán phần còn lại" sang Đã xong = ghi nhận đã nhận tiền mặt: hỏi xác nhận, không kéo âm thầm
  const [receiving, setReceiving] = useState<BoardTask | null>(null)
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
  const toggle = (t: BoardTask) =>
    t.isRestPayment && !t.isDone ? setReceiving(t) : void run(t.orderId, t.id, { kind: 'status', status: t.isDone ? (t.owner === 'CUSTOMER' ? 'Waiting' : 'Todo') : 'Done' }, { isRestPayment: t.isRestPayment })

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
    if (task.isRestPayment && cell.column === 'done') return setReceiving(task)
    void run(task.orderId, task.id, { kind: 'status', status: statusOfColumn(cell.column) }, { isRestPayment: task.isRestPayment })
  }

  const hiddenTotal = hidden ? hidden.customer + hidden.todo + hidden.done : 0
  if (!tasks.length) {
    return (
      <div className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-muted-foreground">
        <p>{emptyText}</p>
        {hiddenTotal > 0 && onShowAll && (
          <button type="button" onClick={onShowAll} className="mt-2 font-semibold text-ink underline underline-offset-[3px]">
            Có {hiddenTotal} việc hạn xa hơn — Xem tất cả
          </button>
        )}
      </div>
    )
  }

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
                    <BoardCard key={t.id} task={t} hue={hueFor(t.orderId)} onToggle={toggle} />
                  ))}
                  {list.length === 0 && (
                    <li className="px-2 py-6 text-center text-[12.5px] text-muted-foreground">
                      {hidden && hidden[c.key] > 0 && onShowAll ? (
                        <button type="button" onClick={onShowAll} className="font-semibold text-ink underline underline-offset-[3px]">
                          Có {hidden[c.key]} việc hạn xa hơn — Xem tất cả
                        </button>
                      ) : (
                        'Không có việc'
                      )}
                    </li>
                  )}
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
              <CardMeta task={dragging} />
              <div className="mt-1.5">
                <DateChip dueDate={dragging.dueDate} confirmed={dragging.dateStatus === 'CONFIRMED'} overdue={dragging.overdue} isDone={dragging.isDone} />
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
      <RestReceivedDialog
        open={!!receiving}
        amount={receiving?.restAmount}
        onOpenChange={(o) => !o && setReceiving(null)}
        onConfirm={() => receiving && void run(receiving.orderId, receiving.id, { kind: 'status', status: 'Done' }, { isRestPayment: true })}
      />
    </>
  )
}

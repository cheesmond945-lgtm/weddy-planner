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
import { Check, ChevronDown } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { shortCouple } from '@/features/calendar/orderColors'
import { daysBetween, formatDate, parseDate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { BoardTask, TaskOwner } from '@/types/vendorOrder'
import { useMoveBoardTask } from '../hooks'
import { BOARD_COLUMNS, boardLanes, canMove, laneKeyOf, type BoardColumn, type BoardGroup, type BoardLane } from '../taskBoard'

const OWNER: Record<TaskOwner, { label: string; tone: BadgeTone }> = {
  CUSTOMER: { label: 'Khách làm', tone: 'neutral' },
  VENDOR: { label: 'NCC làm', tone: 'talk' },
  BOTH: { label: 'Hai bên', tone: 'info' },
}

const COLUMN_TITLE = Object.fromEntries(BOARD_COLUMNS.map((c) => [c.key, c.title])) as Record<BoardColumn, string>

/** Dữ liệu gắn với ô thả (hàng × cột) */
interface CellData {
  lane: string
  column: BoardColumn
}

const hueStripe = (hue: number): CSSProperties => ({ boxShadow: `inset 3px 0 0 hsl(${hue} 60% 48%)` })

/** Chuột / cảm ứng: ô dưới con trỏ; bàn phím (không có con trỏ): ô chồng lên thẻ đang kéo. */
const collision: CollisionDetection = (args) => {
  const hits = pointerWithin(args)
  return hits.length ? hits : rectIntersection(args)
}

/** Nội dung thẻ việc (dùng cho thẻ trên bảng và thẻ đang kéo). */
function CardBody({ task, showCustomer }: { task: BoardTask; showCustomer: boolean }) {
  // Sắp đến hạn: còn 0 đến 2 ngày (cùng ngưỡng với thông báo của backend)
  const soon = !task.isDone && !task.overdue && !!task.dueDate && daysBetween(today(), parseDate(task.dueDate)) <= 2
  const owner = OWNER[task.owner]
  return (
    <>
      <p className={cn('text-[13.5px] leading-snug font-medium [overflow-wrap:anywhere]', task.isDone && 'text-muted-foreground line-through')}>{task.title}</p>
      {showCustomer && (
        <p className="mt-0.5 text-[12px] text-muted-foreground [overflow-wrap:anywhere]">
          {shortCouple(task.customerName)} · {task.orderCode}
        </p>
      )}
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
        <span className={cn(task.overdue && 'font-semibold text-warn')}>Hạn {formatDate(task.dueDate)}</span>
        {task.overdue && <span className="font-semibold text-warn">· Quá hạn</span>}
        {soon && <span className="font-semibold text-gold-ink">· Sắp đến hạn</span>}
        <Badge tone={owner.tone} className="ml-auto">
          {owner.label}
        </Badge>
      </p>
    </>
  )
}

interface CardProps {
  task: BoardTask
  hue: number
  showCustomer: boolean
  busy: boolean
  onToggle: (t: BoardTask) => void
}

/**
 * Thẻ việc. Việc của NCC / hai bên kéo được (nắm vào phần chữ) và có ô tick cho ai không kéo được; việc của khách chỉ xem.
 * Ô tick nằm ngoài vùng kéo để Enter / Space trên ô tick không nhấc thẻ lên.
 */
function BoardCard({ task, hue, showCustomer, busy, onToggle }: CardProps) {
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
      className={cn('flex items-start gap-2.5 rounded-md border bg-surface py-2.5 pr-3 pl-3.5 shadow-card', task.overdue ? 'border-warn/60' : 'border-line', isDragging && 'opacity-40')}
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
      {task.canTick ? (
        <div
          ref={setActivatorNodeRef}
          {...listeners}
          {...attributes}
          className="min-w-0 flex-1 cursor-grab touch-manipulation rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage active:cursor-grabbing"
        >
          <CardBody task={task} showCustomer={showCustomer} />
        </div>
      ) : (
        <div className="min-w-0 flex-1">
          <CardBody task={task} showCustomer={showCustomer} />
        </div>
      )}
    </li>
  )
}

/** Một ô của bảng (hàng × cột): nhận thả khi việc đang kéo thuộc hàng này và được chuyển sang cột này. */
function BoardCell({ lane, column, group, children }: { lane: string; column: BoardColumn; group: BoardGroup; children: ReactNode }) {
  const dragged = useDndContext().active?.data.current?.task as BoardTask | undefined
  const valid = !!dragged && laneKeyOf(dragged, group) === lane && canMove(dragged, column)
  const { setNodeRef, isOver } = useDroppable({ id: `${lane}|${column}`, data: { lane, column } satisfies CellData, disabled: !valid })
  return (
    <ul
      ref={setNodeRef}
      aria-label={COLUMN_TITLE[column]}
      className={cn(
        'flex min-h-16 flex-col gap-2 rounded-lg border border-transparent bg-surface-2/60 p-2 transition-colors',
        valid && 'border-dashed border-sage/60',
        valid && isOver && 'border-solid border-sage bg-sage-soft',
      )}
    >
      {children}
    </ul>
  )
}

function LaneHeader({ lane, hue, open, onToggle }: { lane: BoardLane; hue: number; open: boolean; onToggle: () => void }) {
  const o = lane.order!
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="col-span-full flex flex-wrap items-center gap-x-2.5 gap-y-1 rounded-md px-1 py-1.5 text-left hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-sage"
    >
      <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} aria-hidden />
      <i aria-hidden className="size-3 shrink-0 rounded-full" style={{ backgroundColor: `hsl(${hue} 60% 48%)` }} />
      <span className="text-[14.5px] font-semibold [overflow-wrap:anywhere]">{o.customerName || 'Khách'}</span>
      <span className="text-[12.5px] text-muted-foreground">
        {o.code} · thực hiện {formatDate(o.eventDate)} · {lane.done}/{lane.total} việc xong
      </span>
      {lane.late > 0 && <Badge tone="warn">Trễ tiến độ · {lane.late}</Badge>}
    </button>
  )
}

interface TaskBoardProps {
  /** Việc đã qua bộ lọc của trang (khách / đơn, Việc của tôi) */
  tasks: readonly BoardTask[]
  group: BoardGroup
  hueFor: (orderId: string) => number
  /** Ẩn cột Chờ khách làm (bộ lọc "Việc của tôi") */
  hideCustomer: boolean
}

/**
 * Bảng việc (kanban) của Lịch làm việc (docs/TIMELINE.md mục 9.2): cột Chờ khách làm / Cần làm / Đã xong, mỗi hàng một đơn (hoặc một hàng chung).
 * Kéo việc của NCC giữa Cần làm và Đã xong = đánh dấu xong / mở lại (PATCH việc của đơn); không kéo sang hàng khác, không kéo việc của khách.
 * Chuột: kéo ngay; cảm ứng: nhấn giữ rồi kéo (để vẫn cuộn được); bàn phím: Space / Enter nhấc, mũi tên di chuyển, Space / Enter thả, Esc hủy.
 */
export function TaskBoard({ tasks, group, hueFor, hideCustomer }: TaskBoardProps) {
  const move = useMoveBoardTask()
  const [dragging, setDragging] = useState<BoardTask | null>(null)
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const columns = BOARD_COLUMNS.filter((c) => !(hideCustomer && c.key === 'customer'))
  const lanes = boardLanes(tasks, group)
  const counts = Object.fromEntries(columns.map((c) => [c.key, lanes.reduce((n, l) => n + l.columns[c.key].length, 0)])) as Record<BoardColumn, number>
  const toggle = (t: BoardTask) => move.mutate({ orderId: t.orderId, taskId: t.id, isDone: !t.isDone })
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
    if (!task || !cell || cell.lane !== laneKeyOf(task, group) || !canMove(task, cell.column)) return
    move.mutate({ orderId: task.orderId, taskId: task.id, isDone: cell.column === 'done' })
  }

  if (!lanes.length) {
    return <p className="rounded-xl border border-line bg-surface px-4 py-8 text-center text-muted-foreground">Chưa có việc nào. Việc chi tiết của đơn mở ra khi khách đặt cọc.</p>
  }

  const grid: CSSProperties = { gridTemplateColumns: `repeat(${columns.length}, minmax(230px, 1fr))` }
  return (
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
        <div className="grid gap-x-3 gap-y-2" style={grid}>
          {columns.map((c) => (
            <h3 key={c.key} className="flex items-baseline gap-2 px-1 pb-1 font-sans text-[12.5px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
              {c.title}
              <span className="font-semibold tracking-normal">{counts[c.key]}</span>
            </h3>
          ))}
          {lanes.map((lane) => {
            const open = !closed.has(lane.key)
            return (
              <section key={lane.key} aria-label={lane.order ? `Đơn ${lane.order.code} của ${lane.order.customerName}` : 'Mọi việc'} className="col-span-full grid gap-x-3 gap-y-2" style={grid}>
                {lane.order && (
                  <LaneHeader
                    lane={lane}
                    hue={hueFor(lane.key)}
                    open={open}
                    onToggle={() =>
                      setClosed((cur) => {
                        const next = new Set(cur)
                        if (next.has(lane.key)) next.delete(lane.key)
                        else next.add(lane.key)
                        return next
                      })
                    }
                  />
                )}
                {open &&
                  columns.map((c) => (
                    <BoardCell key={c.key} lane={lane.key} column={c.key} group={group}>
                      {lane.columns[c.key].map((t) => (
                        <BoardCard key={t.id} task={t} hue={hueFor(t.orderId)} showCustomer={group === 'none'} busy={busyId === t.id} onToggle={toggle} />
                      ))}
                    </BoardCell>
                  ))}
              </section>
            )
          })}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {dragging && (
          <div style={hueStripe(hueFor(dragging.orderId))} className="w-[260px] rotate-1 cursor-grabbing rounded-md border border-sage bg-surface py-2.5 pr-3 pl-3.5 shadow-lg">
            <CardBody task={dragging} showCustomer={group === 'none'} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

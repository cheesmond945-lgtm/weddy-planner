import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { SegmentedTabs } from '@/components/SegmentedTabs'
import { Button } from '@/components/ui/button'
import { CalendarMonth, dayHeading, type CalendarEvent, type CalendarTone } from '@/features/calendar/components/CalendarMonth'
import { gridRange, monthOf } from '@/features/calendar/monthGrid'
import { shortCouple } from '@/features/calendar/orderColors'
import { BoardArchive } from '@/features/vendorOrders/components/BoardArchive'
import { CustomerPicker } from '@/features/vendorOrders/components/CustomerPicker'
import { ACTIVE_STATUSES, OrderBoard, useHues } from '@/features/vendorOrders/components/OrderBoard'
import { TaskRow } from '@/features/vendorOrders/components/OrderProgressPanel'
import { BusyCalendar } from '@/features/halls/components/BusyCalendar'
import { useVendorHalls } from '@/features/halls/hooks'
import { TaskBoard } from '@/features/vendorOrders/components/TaskBoard'
import { ORDER_STATUS } from '@/features/vendorOrders/constants'
import { TaskDateDialog } from '@/features/vendorOrders/components/TaskDateDialog'
import { useConfirmTaskDate, useOrderProgress, useOrders, useRescheduleTask, useSetOrderTask, useTaskBoard, useVendorCalendar } from '@/features/vendorOrders/hooks'
import { HORIZONS, SOON_DAYS, boardSummary, customerOptions, inHorizon, matchesBoard, splitBoard, type BoardHorizon } from '@/features/vendorOrders/taskBoard'
import { daysBetween, formatDate, parseDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { CalendarItem, OrderTask } from '@/types/vendorOrder'

type TaskItem = Extract<CalendarItem, { kind: 'TASK' }>
type OrderItem = Extract<CalendarItem, { kind: 'ORDER' }>
/** busy: Lịch bận theo sảnh, chỉ Trung tâm tổ chức sự kiện (docs/LICH_BAN_SANH.md) */
type View = 'month' | 'board' | 'busy' | 'orders'

const VIEW_KEY = 'weddy.vendor.calendar.view'
const HORIZON_KEY = 'weddy.vendor.board.horizon'
const loadView = (): View => {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'orders' || v === 'board' || v === 'busy' ? v : 'month'
  } catch {
    return 'month'
  }
}
/** Khoảng thời gian của Bảng việc, mặc định quá hạn + 14 ngày tới. */
const loadHorizon = (): BoardHorizon => {
  try {
    const h = localStorage.getItem(HORIZON_KEY)
    return h === 'month' || h === 'all' ? h : 'soon'
  } catch {
    return 'soon'
  }
}
const store = (key: string, v: string) => {
  try {
    localStorage.setItem(key, v)
  } catch {
    // không lưu được thì thôi
  }
}

// Số đơn mỗi lần lấy: 100 là trang lớn nhất API cho phép (README mục 6)
const ALL_ORDERS = { page: 1, pageSize: 100 }
// Hàng nút lọc theo khách ở Lịch tháng hiện tối đa từng này nút, còn lại gom vào "+N khách"
const CHIP_LIMIT = 8

const toneOf = (i: CalendarItem): CalendarTone => (i.kind === 'ORDER' ? 'event' : i.isDone ? 'done' : i.overdue ? 'overdue' : 'todo')

/** Một việc trong lịch: tick được nếu là việc của NCC / hai bên; mỗi dòng gọi hook theo đơn của nó. */
function CalendarTaskRow({ item }: { item: TaskItem }) {
  const set = useSetOrderTask(item.orderId)
  const confirm = useConfirmTaskDate(item.orderId)
  const reschedule = useRescheduleTask()
  const [picking, setPicking] = useState(false)
  const task: OrderTask = { id: item.id, title: item.title, dueDate: item.date, isDone: item.isDone, completedDate: null, owner: item.owner, status: item.status, canTick: item.canTick, overdue: item.overdue, isPackageTask: false, dateStatus: item.dateStatus, confirmedAt: null, needsRecheck: false }
  return (
    <>
      <TaskRow
        t={task}
        busy={set.isPending || confirm.isPending}
        onToggle={(t) => set.mutate({ taskId: t.id, isDone: !t.isDone })}
        onConfirm={(t) => confirm.mutate(t.dateStatus === 'CONFIRMED' ? { taskId: t.id, unconfirm: true } : { taskId: t.id })}
        onReschedule={() => setPicking(true)}
      />
      <TaskDateDialog
        target={picking ? { title: item.title, dueDate: item.date, eventDate: item.eventDate } : null}
        busy={reschedule.isPending}
        onClose={() => setPicking(false)}
        onPick={(date) => reschedule.mutate({ orderId: item.orderId, taskId: item.id, date }, { onSuccess: () => setPicking(false) })}
      />
    </>
  )
}

function CalendarOrderRow({ item }: { item: OrderItem }) {
  const status = ORDER_STATUS[item.status]
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-gold/40 bg-gold-soft/40 px-3.5 py-2.5">
      <p className="min-w-0 text-[13.5px] font-semibold [overflow-wrap:anywhere]">{item.title}</p>
      <span className="flex items-center gap-2">
        <Badge tone={status.tone}>{status.label}</Badge>
        <Button asChild variant="outline" size="sm" className="border-line-strong">
          <Link to={`${paths.vendor.orders}?order=${item.orderId}`}>Xem đơn</Link>
        </Button>
      </span>
    </li>
  )
}

/**
 * Lịch làm việc của NCC (docs/TIMELINE.md mục 9): ngày thực hiện các đơn và việc chi tiết của đơn đã cọc.
 * Nhiều khách cùng lúc nên có ba công cụ để theo dõi: mỗi đơn một màu và tên khách ngắn trên thẻ; lọc theo khách / đơn và "Việc của tôi";
 * danh sách của ngày gom theo khách. Chế độ "Bảng việc" là kanban kéo thả luôn chỉ 3 cột (Chờ khách làm / Cần làm / Đã xong), thu hẹp bằng
 * khoảng thời gian, ô chọn khách, tìm kiếm; đơn đã xong hết việc rời bảng sang tab Lưu trữ (mục 9.2).
 * "Theo đơn" cho một thẻ mỗi đơn kèm tiến độ và việc tiếp theo.
 */
export default function VendorCalendarPage() {
  const now = toISODate(today())
  const [view, setViewState] = useState<View>(loadView)
  const [horizon, setHorizonState] = useState<BoardHorizon>(loadHorizon)
  const [month, setMonth] = useState(monthOf(now))
  const [selected, setSelected] = useState<string | null>(now)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [mineOnly, setMineOnly] = useState(false)
  // Nhiều khách: hàng nút lọc chỉ hiện CHIP_LIMIT nút đầu (và nút đang chọn), còn lại gom vào "+N khách"
  const [allChips, setAllChips] = useState(false)
  // Bảng việc: tab Đang làm / Lưu trữ, khách đang chọn ('' là tất cả), ô tìm theo tên khách, mã đơn, tên việc
  const [boardTab, setBoardTab] = useState<'active' | 'archive'>('active')
  const [boardCustomer, setBoardCustomer] = useState('')
  const [boardQ, setBoardQ] = useState('')
  const { from, to } = useMemo(() => gridRange(month), [month])
  const cal = useVendorCalendar(from, to)
  const { data: ordersPage } = useOrders(ALL_ORDERS)
  const { data: progress } = useOrderProgress()
  const board = useTaskBoard()
  const { data: halls } = useVendorHalls()
  // Tab Lịch bận chỉ có ở Trung tâm tổ chức sự kiện; đã nhớ tab này mà tài khoản không phải trung tâm thì về Lịch tháng
  const shown: View = view === 'busy' && !halls?.enabled ? 'month' : view

  const orders = useMemo(() => ordersPage?.data ?? [], [ordersPage])
  const hueFor = useHues(orders)
  const active = useMemo(() => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).sort((a, b) => a.eventDate.localeCompare(b.eventDate)), [orders])
  const setView = (v: View) => {
    setViewState(v)
    store(VIEW_KEY, v)
  }
  const setHorizon = (h: BoardHorizon) => {
    setHorizonState(h)
    store(HORIZON_KEY, h)
  }
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const items = useMemo(
    () => (cal.data ?? []).filter((i) => (picked.size === 0 || picked.has(i.orderId)) && !(mineOnly && i.kind === 'TASK' && i.status === 'Waiting')),
    [cal.data, picked, mineOnly],
  )
  const events: CalendarEvent[] = useMemo(
    () =>
      items.map((i) => {
        const short = shortCouple(i.customerName)
        return { id: `${i.kind}-${i.id}`, date: i.date, title: `${short}: ${i.title}`, tone: toneOf(i), hue: hueFor(i.orderId), groupKey: i.orderId, groupLabel: short }
      }),
    [items, hueFor],
  )
  const ofDay = selected ? items.filter((i) => i.date === selected) : []
  const groups = useMemo(() => {
    const map = new Map<string, CalendarItem[]>()
    for (const i of ofDay) map.set(i.orderId, [...(map.get(i.orderId) ?? []), i])
    return [...map.entries()]
  }, [ofDay])
  // Bảng việc: đơn đã xong hết việc sang Lưu trữ; phần còn lại lọc theo khách, Việc của tôi, tìm kiếm (scoped) rồi theo khoảng thời gian
  const { active: liveTasks, finished } = useMemo(() => splitBoard(board.data ?? []), [board.data])
  const custOptions = useMemo(() => customerOptions(liveTasks), [liveTasks])
  // Khách đang chọn đã rời bảng (đơn vừa xong hết việc / bị hủy) thì về tất cả khách
  const boardOrder = custOptions.some((o) => o.orderId === boardCustomer) ? boardCustomer : ''
  const scoped = useMemo(
    () => liveTasks.filter((t) => (!boardOrder || t.orderId === boardOrder) && !(mineOnly && t.status === 'Waiting') && matchesBoard(t, boardQ)),
    [liveTasks, boardOrder, mineOnly, boardQ],
  )
  const boardTasks = useMemo(() => scoped.filter((t) => inHorizon(t, horizon, now)), [scoped, horizon, now])
  const summary = boardSummary(scoped, now)
  const outside = scoped.length - boardTasks.length
  const boardEmpty = !liveTasks.length
    ? finished.length
      ? 'Mọi đơn đã xong hết việc. Mở tab Lưu trữ để hoàn tất đơn.'
      : 'Chưa có việc nào. Việc xuất hiện khi khách đã đặt cọc.'
    : !scoped.length
      ? boardQ.trim()
        ? `Không có việc nào khớp "${boardQ.trim()}".`
        : 'Không có việc nào của bạn ở đây.'
      : 'Không có việc nào trong khoảng thời gian này. Chọn 30 ngày tới hoặc Tất cả để xem thêm.'
  const visibleChips = allChips ? active : active.filter((o, i) => i < CHIP_LIMIT || picked.has(o.id))
  const hiddenChips = active.length - visibleChips.length
  const todoCount = (board.data ?? []).filter((t) => t.status !== 'Waiting' && !t.isDone).length
  const lateCount = items.filter((i) => i.kind === 'TASK' && i.overdue).length
  const soonCount = items.filter((i) => i.kind === 'TASK' && !i.isDone && !i.overdue && i.status !== 'Waiting' && daysBetween(today(), parseDate(i.date)) <= 2).length
  const totalLate = Object.values(progress ?? {}).reduce((n, p) => n + p.overdueVendor, 0)
  const chip = (on: boolean) => cn('inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[13px] font-medium transition-colors', on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-ink')

  return (
    <>
      <PageTitle
        title="Lịch làm việc"
        description={`Theo dõi các đơn của khách và việc cần làm: xem theo tháng, trên bảng việc kéo thả${halls?.enabled ? ', lịch bận của từng sảnh' : ''}, hoặc theo từng đơn.`}
      />

      <SegmentedTabs
        ariaLabel="Cách xem lịch làm việc"
        className="mb-4"
        value={shown}
        onChange={setView}
        tabs={[
          { value: 'month', label: 'Lịch tháng', sub: 'Theo ngày' },
          { value: 'board', label: 'Bảng việc', sub: board.data ? `${todoCount} việc cần làm` : 'Kéo thả' },
          ...(halls?.enabled ? [{ value: 'busy' as const, label: 'Lịch bận', sub: `${halls.halls.length} sảnh` }] : []),
          { value: 'orders', label: 'Theo đơn', sub: `${active.length} đơn${totalLate ? ` · ${totalLate} việc trễ` : ''}` },
        ]}
      />

      {shown === 'busy' ? (
        <BusyCalendar />
      ) : shown === 'orders' ? (
        <OrderBoard orders={orders} progress={progress} hueFor={hueFor} />
      ) : shown === 'board' ? (
        board.isError ? (
          <EmptyState title="Chưa tải được bảng việc" description={board.error.message} action={<Button onClick={() => board.refetch()}>Thử lại</Button>} />
        ) : board.isPending ? (
          <div className="h-[320px] animate-pulse rounded-xl bg-muted" aria-busy="true" aria-label="Đang tải bảng việc" />
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Đang làm hoặc lưu trữ">
              <button type="button" aria-pressed={boardTab === 'active'} className={chip(boardTab === 'active')} onClick={() => setBoardTab('active')}>
                Đang làm <span className={cn('text-[12px]', boardTab === 'active' ? 'opacity-80' : 'text-muted-foreground')}>{custOptions.length} đơn</span>
              </button>
              <button type="button" aria-pressed={boardTab === 'archive'} className={chip(boardTab === 'archive')} onClick={() => setBoardTab('archive')}>
                Lưu trữ
                {finished.length > 0 && <span className="rounded-pill bg-gold px-1.5 text-[11px] font-bold text-white">{finished.length} chờ hoàn tất</span>}
              </button>
            </div>

            {boardTab === 'archive' ? (
              <BoardArchive finished={finished} hueFor={hueFor} />
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <CustomerPicker options={custOptions} value={boardOrder} onChange={setBoardCustomer} hueFor={hueFor} />
                  <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Khoảng thời gian">
                    {HORIZONS.map((h) => (
                      <button key={h.key} type="button" aria-pressed={horizon === h.key} className={chip(horizon === h.key)} onClick={() => setHorizon(h.key)}>
                        {h.label}
                      </button>
                    ))}
                  </span>
                  <label className="relative ml-auto w-full max-w-[280px] max-sm:max-w-none">
                    <span className="sr-only">Tìm việc theo khách, mã đơn hoặc tên việc</span>
                    <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <input
                      type="search"
                      value={boardQ}
                      onChange={(e) => setBoardQ(e.target.value)}
                      placeholder="Tìm khách, mã đơn, việc…"
                      className="h-9 w-full rounded-pill border border-line bg-surface pr-3 pl-9 text-[13.5px] outline-none placeholder:text-muted-foreground focus-visible:border-sage focus-visible:ring-2 focus-visible:ring-sage/30"
                    />
                  </label>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <p role="status" className="text-[13px] text-muted-foreground">
                    <b className="font-semibold text-ink">{summary.todo} việc cần làm</b>
                    {summary.late > 0 && <b className="font-semibold text-warn"> · {summary.late} quá hạn</b>}
                    {summary.soon > 0 && <span>{` · ${summary.soon} đến hạn trong ${SOON_DAYS} ngày`}</span>}
                    {summary.confirm > 0 && <b className="font-semibold text-warn">{` · ${summary.confirm} cần chốt lịch`}</b>}
                    {!mineOnly && summary.waiting > 0 && <span> · {summary.waiting} việc chờ khách</span>}
                    {outside > 0 && (
                      <>
                        <span> · ẩn {outside} việc hạn xa hoặc xong đã lâu </span>
                        <button type="button" className="font-medium text-ink underline underline-offset-[3px]" onClick={() => setHorizon('all')}>
                          Xem tất cả
                        </button>
                      </>
                    )}
                  </p>
                  <span className="ml-auto flex items-center gap-2">
                    <button type="button" aria-pressed={!mineOnly} className={chip(!mineOnly)} onClick={() => setMineOnly(false)}>
                      Tất cả việc
                    </button>
                    <button type="button" aria-pressed={mineOnly} className={chip(mineOnly)} onClick={() => setMineOnly(true)}>
                      Việc của tôi
                    </button>
                  </span>
                </div>
                {/* key: đổi bộ lọc thì mỗi cột quay về PAGE thẻ đầu */}
                <TaskBoard key={`${horizon}|${boardOrder}|${boardQ}|${mineOnly}`} tasks={boardTasks} hueFor={hueFor} hideCustomer={mineOnly} emptyText={boardEmpty} />
              </>
            )}
          </>
        )
      ) : (
        <>
          {/* Chú giải bấm được: màu của từng khách / đơn, bấm để chỉ xem khách đó */}
          <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo khách hoặc đơn">
            {visibleChips.map((o) => {
              const on = picked.has(o.id)
              const late = progress?.[o.id]?.overdueVendor ?? 0
              return (
                <button key={o.id} type="button" aria-pressed={on} onClick={() => toggle(o.id)} className={chip(on)} title={`${o.customerName} · ${o.orderCode} · thực hiện ${formatDate(o.eventDate)}`}>
                  <i aria-hidden className="size-2.5 rounded-full" style={{ backgroundColor: `hsl(${hueFor(o.id)} 60% 48%)` }} />
                  {shortCouple(o.customerName)}
                  <span className={cn('text-[11.5px]', on ? 'opacity-80' : 'text-muted-foreground')}>{o.orderCode.slice(-4)}</span>
                  {late > 0 && <span className="rounded-pill bg-warn px-1.5 text-[11px] font-bold text-white">{late}</span>}
                </button>
              )
            })}
            {(hiddenChips > 0 || allChips) && active.length > CHIP_LIMIT && (
              <button type="button" aria-expanded={allChips} className={chip(false)} onClick={() => setAllChips((v) => !v)}>
                {allChips ? 'Ẩn bớt' : `+${hiddenChips} khách`}
              </button>
            )}
            {picked.size > 0 && (
              <Button variant="ghost" size="sm" className="rounded-pill" onClick={() => setPicked(new Set())}>
                Bỏ lọc
              </Button>
            )}
            <span className="ml-auto flex items-center gap-2">
              <button type="button" aria-pressed={!mineOnly} className={chip(!mineOnly)} onClick={() => setMineOnly(false)}>
                Tất cả việc
              </button>
              <button type="button" aria-pressed={mineOnly} className={chip(mineOnly)} onClick={() => setMineOnly(true)}>
                Việc của tôi
              </button>
            </span>
          </div>

          {(lateCount > 0 || soonCount > 0) && (
            <div role="status" className={cn('mb-3 rounded-lg border px-4 py-2.5 text-sm', lateCount > 0 ? 'border-warn bg-warn-soft text-warn' : 'border-gold-500 bg-gold-100 text-gold-800')}>
              {lateCount > 0 && <b className="font-semibold">{lateCount} việc của bạn đang quá hạn</b>}
              {lateCount > 0 && soonCount > 0 && ' · '}
              {soonCount > 0 && <b className="font-semibold">{soonCount} việc sắp đến hạn</b>}
              <span> trong khoảng đang xem. Bấm vào ngày để cập nhật.</span>
            </div>
          )}

          {cal.isError ? (
            <EmptyState title="Chưa tải được lịch" description={cal.error.message} action={<Button onClick={() => cal.refetch()}>Thử lại</Button>} />
          ) : (
            <div aria-busy={cal.isPending}>
              <CalendarMonth
                month={month}
                onMonthChange={setMonth}
                events={events}
                today={now}
                selected={selected}
                onSelect={setSelected}
                onToday={() => {
                  setMonth(monthOf(now))
                  setSelected(now)
                }}
              />
            </div>
          )}

          <section aria-label="Việc trong ngày" className="mt-5">
            {selected ? (
              <>
                <h3 className="mb-3 flex flex-wrap items-baseline gap-2 font-serif text-xl leading-tight">
                  {dayHeading(selected)}
                  <span className="font-sans text-[13px] font-medium text-muted-foreground">
                    {ofDay.length} mục · {groups.length} khách
                  </span>
                </h3>
                {groups.filter(([, g]) => g.some((i) => i.kind === 'ORDER')).length > 1 && (
                  <p role="status" className="mb-3 rounded-lg bg-gold-soft px-4 py-2.5 text-sm font-medium text-gold-ink">
                    Có {groups.filter(([, g]) => g.some((i) => i.kind === 'ORDER')).length} đơn cùng thực hiện trong ngày này. Kiểm tra lại nhân sự và lịch.
                  </p>
                )}
                {groups.length ? (
                  <div className="grid gap-4">
                    {groups.map(([orderId, list]) => (
                      <section key={orderId} aria-label={`Khách ${list[0].customerName}`}>
                        <h4 className="mb-2 flex flex-wrap items-center gap-2 font-sans text-[14px] font-semibold tracking-normal">
                          <i aria-hidden className="size-3 rounded-full" style={{ backgroundColor: `hsl(${hueFor(orderId)} 60% 48%)` }} />
                          {list[0].customerName}
                          <span className="text-[12.5px] font-normal text-muted-foreground">
                            {list[0].orderCode} · {list.length} mục
                          </span>
                        </h4>
                        <ul className="grid gap-2">{list.map((i) => (i.kind === 'ORDER' ? <CalendarOrderRow key={`o-${i.id}`} item={i} /> : <CalendarTaskRow key={`t-${i.id}`} item={i} />))}</ul>
                      </section>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Không có việc nào trong ngày này" />
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Bấm một ngày trên lịch để xem chi tiết.</p>
            )}
          </section>
        </>
      )}
    </>
  )
}

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
import { ACTIVE_STATUSES, OrderBoard, useHues } from '@/features/vendorOrders/components/OrderBoard'
import { TaskRow } from '@/features/vendorOrders/components/OrderProgressPanel'
import { ORDER_STATUS } from '@/features/vendorOrders/constants'
import { useOrderProgress, useOrders, useSetOrderTask, useVendorCalendar } from '@/features/vendorOrders/hooks'
import { daysBetween, formatDate, parseDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { CalendarItem, OrderTask } from '@/types/vendorOrder'

type TaskItem = Extract<CalendarItem, { kind: 'TASK' }>
type OrderItem = Extract<CalendarItem, { kind: 'ORDER' }>
type View = 'month' | 'orders'

const VIEW_KEY = 'weddy.vendor.calendar.view'
const loadView = (): View => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'orders' ? 'orders' : 'month'
  } catch {
    return 'month'
  }
}
const saveView = (v: View) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // không lưu được thì thôi
  }
}

// Số đơn mỗi lần lấy: 100 là trang lớn nhất API cho phép (README mục 6)
const ALL_ORDERS = { page: 1, pageSize: 100 }

const toneOf = (i: CalendarItem): CalendarTone => (i.kind === 'ORDER' ? 'event' : i.isDone ? 'done' : i.overdue ? 'overdue' : 'todo')

/** Một việc trong lịch: tick được nếu là việc của NCC / hai bên; mỗi dòng gọi hook theo đơn của nó. */
function CalendarTaskRow({ item }: { item: TaskItem }) {
  const set = useSetOrderTask(item.orderId)
  const task: OrderTask = { id: item.id, title: item.title, dueDate: item.date, isDone: item.isDone, completedDate: null, owner: item.owner, canTick: item.canTick, overdue: item.overdue }
  return <TaskRow t={task} busy={set.isPending} onToggle={(t) => set.mutate({ taskId: t.id, isDone: !t.isDone })} />
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
 * danh sách của ngày gom theo khách. Chế độ "Theo đơn" cho một thẻ mỗi đơn kèm tiến độ và việc tiếp theo.
 */
export default function VendorCalendarPage() {
  const now = toISODate(today())
  const [view, setViewState] = useState<View>(loadView)
  const [month, setMonth] = useState(monthOf(now))
  const [selected, setSelected] = useState<string | null>(now)
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [mineOnly, setMineOnly] = useState(false)
  const { from, to } = useMemo(() => gridRange(month), [month])
  const cal = useVendorCalendar(from, to)
  const { data: ordersPage } = useOrders(ALL_ORDERS)
  const { data: progress } = useOrderProgress()

  const orders = useMemo(() => ordersPage?.data ?? [], [ordersPage])
  const hueFor = useHues(orders)
  const active = useMemo(() => orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).sort((a, b) => a.eventDate.localeCompare(b.eventDate)), [orders])
  const setView = (v: View) => {
    setViewState(v)
    saveView(v)
  }
  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const items = useMemo(
    () => (cal.data ?? []).filter((i) => (picked.size === 0 || picked.has(i.orderId)) && !(mineOnly && i.kind === 'TASK' && !i.canTick)),
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
  const lateCount = items.filter((i) => i.kind === 'TASK' && i.overdue).length
  const soonCount = items.filter((i) => i.kind === 'TASK' && !i.isDone && !i.overdue && i.canTick && daysBetween(today(), parseDate(i.date)) <= 2).length
  const totalLate = Object.values(progress ?? {}).reduce((n, p) => n + p.overdueVendor, 0)
  const chip = (on: boolean) => cn('inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-[13px] font-medium transition-colors', on ? 'border-ink bg-ink text-bg' : 'border-line bg-surface hover:border-ink')

  return (
    <>
      <PageTitle title="Lịch làm việc" description="Theo dõi các đơn của khách và việc cần làm: xem theo tháng, hoặc theo từng đơn." />

      <SegmentedTabs
        ariaLabel="Cách xem lịch làm việc"
        className="mb-4"
        value={view}
        onChange={setView}
        tabs={[
          { value: 'month', label: 'Lịch tháng', sub: 'Theo ngày' },
          { value: 'orders', label: 'Theo đơn', sub: `${active.length} đơn${totalLate ? ` · ${totalLate} việc trễ` : ''}` },
        ]}
      />

      {view === 'orders' ? (
        <OrderBoard orders={orders} progress={progress} hueFor={hueFor} />
      ) : (
        <>
          {/* Chú giải bấm được: màu của từng khách / đơn, bấm để chỉ xem khách đó */}
          <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Lọc theo khách hoặc đơn">
            {active.map((o) => {
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

import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { catalogApi } from '@/api/catalog'
import { EmptyState } from '@/components/EmptyState'
import { SegmentedTabs } from '@/components/SegmentedTabs'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { PrepLevel, TimelineItem, Wedding } from '@/types/wedding'
import { useTimeline, useTimelineMutations } from '../hooks'
import { usePlanActions } from '../planActions'
import { countServices, groupByTime, type ViewMode } from '../timelineGroups'
import { filterTimeline, hasFilters, isDueSoon, isOverdue, monthOptions, type OwnerFilter, type TimelineFilters as Filters } from '../timelineFilter'
import { CompleteTaskDialog, ReopenTaskDialog } from './TimelineConfirmDialogs'
import { AddTaskDialog, EditMilestoneDialog } from './TimelineDialogs'
import { TimelineGroupCard, defaultOpen } from './TimelineGroupCard'
import { TimelineCalendar } from './TimelineCalendar'
import { TimelineFilters } from './TimelineFilters'
import { TimelineHero } from './TimelineHero'
import { SERVICE_LABEL, TimelineCard, meetingDraft } from './TimelineRow'
import { WeddingEditDialog } from './WeddingDialogs'

type Show = 'todo' | 'done' | 'all'
const SHOWS: { value: Show; label: string }[] = [
  { value: 'todo', label: 'Chưa xong' },
  { value: 'done', label: 'Đã xong' },
  { value: 'all', label: 'Tất cả' },
]

const VIEW_KEY = 'weddy.timeline.view'
/** Cách xem đã chọn (THEO THỜI GIAN / THEO DỊCH VỤ / LỊCH), nhớ trong trình duyệt (localStorage có thể bị chặn nên bọc try/catch); mặc định THEO THỜI GIAN. */
const loadView = (): ViewMode => {
  try {
    const v = localStorage.getItem(VIEW_KEY)
    return v === 'service' || v === 'calendar' ? v : 'time'
  } catch {
    return 'time'
  }
}
const saveView = (v: ViewMode) => {
  try {
    localStorage.setItem(VIEW_KEY, v)
  } catch {
    // không lưu được thì thôi
  }
}

const OPEN_KEY = 'weddy.timeline.groups'
/** Trạng thái xổ / thu của các nhóm, nhớ trong phiên (sessionStorage có thể bị chặn nên bọc try/catch). */
const loadOpen = (): Record<string, boolean> => {
  try {
    return JSON.parse(sessionStorage.getItem(OPEN_KEY) ?? '{}')
  } catch {
    return {}
  }
}
const saveOpen = (v: Record<string, boolean>) => {
  try {
    sessionStorage.setItem(OPEN_KEY, JSON.stringify(v))
  } catch {
    // không lưu được thì thôi: chỉ mất trạng thái khi tải lại trang
  }
}

type Entry = { type: 'task'; key: string; due: string; item: TimelineItem } | { type: 'group'; key: string; due: string; book: TimelineItem; kids: TimelineItem[] }

/**
 * Dải tổng hợp việc cần chú ý: quá hạn và sắp đến hạn (còn 0 đến 2 ngày). Bấm để xem đúng nhóm đó ở cách xem THEO THỜI GIAN.
 * Cùng ngưỡng với thông báo (chuông) để hai nơi nói cùng một chuyện.
 */
function DeadlineBanner({ overdue, soon, onPick }: { overdue: number; soon: number; onPick: (month: 'overdue' | 'soon') => void }) {
  if (!overdue && !soon) return null
  const btn = 'font-semibold underline underline-offset-2 hover:opacity-80'
  return (
    <div role="status" className={cn('mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-3 text-sm', overdue ? 'border-warn bg-warn-soft text-warn' : 'border-gold-500 bg-gold-100 text-gold-800')}>
      {overdue > 0 && (
        <button type="button" className={btn} onClick={() => onPick('overdue')}>
          {overdue} việc quá hạn
        </button>
      )}
      {soon > 0 && (
        <button type="button" className={btn} onClick={() => onPick('soon')}>
          {soon} việc sắp đến hạn
        </button>
      )}
      <span className="text-[13px] opacity-80">Bấm để xem danh sách.</span>
    </div>
  )
}

/** Banner khi thời gian chuẩn bị ngắn (mức Gấp / Rất gấp). */
function UrgencyBanner({ level, daysLeft }: { level: PrepLevel | null; daysLeft: number | null }) {
  if (level !== 'SOON' && level !== 'VERY_SOON') return null
  const very = level === 'VERY_SOON'
  return (
    <div role="status" className={cn('mb-4 rounded-lg border px-4 py-3 text-sm', very ? 'border-warn bg-warn-soft text-warn' : 'border-gold-500 bg-gold-100 text-gold-800')}>
      {very ? (
        <>
          <b className="font-semibold">Thời gian chuẩn bị rất ngắn</b>, ưu tiên chốt các dịch vụ chính trước.
        </>
      ) : (
        <>Còn {daysLeft} ngày nữa đến đám cưới, thời gian chuẩn bị khá gấp. Lịch bên dưới đã được rút gọn cho kịp.</>
      )}
    </div>
  )
}

/**
 * Trang Timeline khi đã có thông tin đám cưới: danh sách theo hạn tăng dần, lọc Chưa xong / Đã xong / Tất cả (?show=) và theo hạng mục (?category=).
 * Việc chi tiết của dịch vụ đã cọc nằm TRONG thẻ nhóm của Mốc chốt; Mốc chốt chưa cọc là một thẻ riêng có dòng "N việc chi tiết mở sau khi bạn đặt cọc".
 */
export function TimelineView({ wedding }: { wedding: Wedding }) {
  const timeline = useTimeline(true)
  const { update, remove } = useTimelineMutations()
  const { openChat } = usePlanActions()
  const [params, setParams] = useSearchParams()
  const show = (SHOWS.find((s) => s.value === params.get('show'))?.value ?? 'todo') as Show
  const category = params.get('category') ?? ''
  // Tìm kiếm / lọc việc (cách xem THEO THỜI GIAN và LỊCH), giữ trên URL để tải lại hoặc gửi link vẫn còn: ?q= &month= &owner=
  const filters: Filters = {
    q: params.get('q') ?? '',
    month: params.get('month') ?? '',
    owner: (['mine', 'vendor'] as const).find((o) => o === params.get('owner')) ?? 'all',
  }
  const [editing, setEditing] = useState<TimelineItem | null>(null)
  const [completing, setCompleting] = useState<TimelineItem | null>(null)
  const [reopening, setReopening] = useState<TimelineItem | null>(null)
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [editingWedding, setEditingWedding] = useState(false)
  const [openMap, setOpenMap] = useState<Record<string, boolean>>(loadOpen)
  const [view, setViewState] = useState<ViewMode>(loadView)

  if (timeline.isPending) return <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải timeline" />
  if (timeline.isError) {
    return (
      <EmptyState
        title="Không tải được timeline"
        description={timeline.error.message}
        action={
          <Button variant="outline" onClick={() => timeline.refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }

  const { items, level, daysLeft } = timeline.data
  const slugOf = (i: TimelineItem) => i.category?.slug ?? ''
  const tab = (i: TimelineItem) => show === 'all' || (show === 'done' ? i.isDone : !i.isDone)

  // Việc chi tiết gom vào Mốc chốt cùng hạng mục; Mốc chốt chưa cọc đứng riêng như một việc
  const books = new Map(items.filter((i) => i.kind === 'CATEGORY_DEADLINE').map((i) => [slugOf(i), i]))
  const kidsOf = (slug: string) => items.filter((i) => i.kind === 'SERVICE_TASK' && slugOf(i) === slug).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!))
  const entries: Entry[] = []
  for (const i of items) {
    if (i.kind === 'LOCKED' || (category && slugOf(i) !== category)) continue
    if (i.kind === 'SERVICE_TASK') {
      if (!books.has(slugOf(i))) entries.push({ type: 'task', key: i.id, due: i.dueDate!, item: i }) // không có Mốc chốt để gom: hiện rời
    } else if (i.kind === 'CATEGORY_DEADLINE' && i.isDone) {
      entries.push({ type: 'group', key: i.id, due: i.dueDate!, book: i, kids: kidsOf(slugOf(i)) })
    } else {
      entries.push({ type: 'task', key: i.id, due: i.dueDate!, item: i })
    }
  }
  entries.sort((a, b) => a.due.localeCompare(b.due))

  const shown = entries.flatMap((e): { e: Entry; visibleKids: TimelineItem[] }[] => {
    if (e.type === 'task') return tab(e.item) ? [{ e, visibleKids: [] }] : []
    const visibleKids = e.kids.filter(tab)
    return show === 'all' || visibleKids.length ? [{ e, visibleKids }] : []
  })

  // Cách xem THEO THỜI GIAN: mọi việc (khung + việc con + việc tự thêm), cùng bộ lọc với cách xem theo dịch vụ
  const nowISO = toISODate(today())
  const baseItems = items.filter((i) => i.kind !== 'LOCKED' && (!category || slugOf(i) === category) && tab(i))
  // Số đếm của ô chọn tháng tính theo các bộ lọc khác (trừ tháng) để khớp với những gì sẽ thấy
  const months = monthOptions(filterTimeline(baseItems, { ...filters, month: '' }, nowISO), nowISO)
  const timeItems = view === 'service' ? baseItems : filterTimeline(baseItems, view === 'calendar' ? { ...filters, month: '' } : filters, nowISO)
  const timeGroups = groupByTime(timeItems, nowISO)
  const categories = [...new Map(items.filter((i) => i.category).map((i) => [i.category!.slug, SERVICE_LABEL[i.category!.slug] ?? i.category!.name])).entries()].map(([slug, label]) => ({ slug, label }))
  const setView = (v: ViewMode) => {
    setViewState(v)
    saveView(v)
  }

  const setShow = (value: Show) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (value === 'todo') next.delete('show')
        else next.set('show', value)
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  const setParam = (patch: Record<string, string>) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        return next
      },
      { replace: true, preventScrollReset: true },
    )
  const overdueCount = items.filter((i) => i.kind !== 'LOCKED' && isOverdue(i, nowISO)).length
  const soonCount = items.filter((i) => i.kind !== 'LOCKED' && isDueSoon(i, nowISO)).length
  const setFilters = (patch: Partial<Filters>) => setParam({ ...(patch.q !== undefined && { q: patch.q.trim() }), ...(patch.month !== undefined && { month: patch.month }), ...(patch.owner !== undefined && { owner: patch.owner === 'all' ? '' : (patch.owner as OwnerFilter) }) })
  const resetFilters = () => setParam({ q: '', month: '', owner: '', category: '' })
  const toggleGroup = (slug: string, current: boolean) =>
    setOpenMap((cur) => {
      const next = { ...cur, [slug]: !current }
      saveOpen(next)
      return next
    })

  const setLeave = (id: string, on: boolean) =>
    setLeaving((cur) => {
      const next = new Set(cur)
      if (on) next.add(id)
      else next.delete(id)
      return next
    })
  const undo = (item: TimelineItem) => update.mutate({ id: item.id, patch: { isDone: false } })
  /** Hoàn thành: thẻ trượt mờ ra khỏi "Chưa xong", rồi PATCH Done; toast có Hoàn tác trong 5 giây. */
  const complete = (item: TimelineItem) => {
    setCompleting(null)
    setLeave(item.id, true)
    window.setTimeout(() => {
      update.mutate({ id: item.id, patch: { isDone: true } })
      setLeave(item.id, false) // thẻ đã rời "Chưa xong" (cập nhật lạc quan), bỏ kiểu trượt để tab "Đã xong" hiện đủ
      toast('Đã chuyển sang Đã xong', 5000, { label: 'Hoàn tác', onClick: () => undo(item) })
    }, 280)
  }
  const reopen = (item: TimelineItem) => {
    setReopening(null)
    update.mutate({ id: item.id, patch: { isDone: false } })
    toast('Đã đưa về Chưa xong')
  }

  /** Mở khung chat với NCC của dịch vụ (đơn hoặc kế hoạch), có thể kèm câu nhắn soạn sẵn. */
  const chatWith = (serviceId: string, draft?: string) =>
    catalogApi.getService(serviceId).then(
      (service) => openChat(service, draft ? { draft } : undefined),
      () => toast('Không mở được khung chat với nhà cung cấp'),
    )

  const handlers = {
    onComplete: setCompleting,
    onReopen: setReopening,
    onEdit: setEditing,
    onRemove: (i: TimelineItem) => remove.mutate(i.id, { onSuccess: () => toast('Đã xóa việc') }),
    onMeet: (i: TimelineItem) => void chatWith(i.serviceId!, meetingDraft(i)),
  }

  const chip = (active: boolean) =>
    cn('rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition-colors', active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-primary')

  return (
    <>
      <TimelineHero wedding={wedding} items={items} onEdit={() => setEditingWedding(true)} onAddTask={() => setAdding(true)} />
      <UrgencyBanner level={level} daysLeft={daysLeft} />
      <DeadlineBanner overdue={overdueCount} soon={soonCount} onPick={(m) => { setView('time'); setParam({ month: m, q: '', owner: '', category: '', show: '' }) }} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[26px] leading-[1.15]">Timeline</h1>
        <div role="group" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
          {SHOWS.map((s) => (
            <button key={s.value} type="button" aria-pressed={show === s.value} className={chip(show === s.value)} onClick={() => setShow(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <SegmentedTabs
        ariaLabel="Cách xem timeline"
        className="mt-4"
        value={view}
        onChange={setView}
        tabs={[
          { value: 'time', label: 'Theo thời gian', sub: `${timeItems.length} việc` },
          { value: 'service', label: 'Theo dịch vụ', sub: `${countServices(timeItems)} dịch vụ` },
          { value: 'calendar', label: 'Lịch', sub: 'Theo tháng' },
        ]}
      />

      {view !== 'service' && (
        <TimelineFilters
          filters={filters}
          onChange={setFilters}
          onReset={resetFilters}
          months={view === 'time' ? months : undefined}
          categories={categories}
          category={category}
          onCategory={(slug) => setParam({ category: slug })}
          shown={timeItems.length}
        />
      )}

      {view === 'calendar' ? (
        <TimelineCalendar items={timeItems} weddingDate={wedding.date} renderCard={(i) => <TimelineCard key={i.id} item={i} leaving={leaving.has(i.id)} showService compactDate {...handlers} />} />
      ) : view === 'time' ? (
        <div className="mt-5">
          {timeItems.length === 0 && <EmptyState title={hasFilters(filters) || category ? 'Không có việc nào khớp bộ lọc' : show === 'done' ? 'Chưa có việc nào xong' : 'Không còn việc nào cần làm'} action={hasFilters(filters) || category ? <Button variant="outline" onClick={resetFilters}>Xóa bộ lọc</Button> : undefined} />}
          {timeGroups.map((g) => (
            <section key={g.key} aria-label={g.title} className="mb-7 last:mb-0">
              <h2 className={cn('mb-3 flex items-baseline gap-2 font-serif text-xl leading-tight', g.key === 'overdue' && 'text-warn')}>
                {g.title}
                <span className="font-sans text-[13px] font-medium text-muted-foreground">{g.items.length} việc</span>
              </h2>
              <div className="flex flex-col gap-3.5">
                {g.items.map((i) => (
                  <TimelineCard key={i.id} item={i} leaving={leaving.has(i.id)} showService compactDate={g.key !== 'overdue'} {...handlers} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
      <div className="mt-5 flex flex-col gap-3.5">
        {shown.length === 0 && <EmptyState title={show === 'done' ? 'Chưa có việc nào xong' : 'Không còn việc nào cần làm'} />}
        {shown.map(({ e, visibleKids }) =>
          e.type === 'task' ? (
            <TimelineCard key={e.key} item={e.item} leaving={leaving.has(e.item.id)} {...handlers} />
          ) : (
            <TimelineGroupCard
              key={e.key}
              book={e.book}
              kids={e.kids}
              visibleKids={visibleKids}
              open={openMap[slugOf(e.book)] ?? defaultOpen(e.kids)}
              onToggle={() => toggleGroup(slugOf(e.book), openMap[slugOf(e.book)] ?? defaultOpen(e.kids))}
              leaving={leaving}
              {...handlers}
            />
          ),
        )}
      </div>
      )}

      <CompleteTaskDialog item={completing} onClose={() => setCompleting(null)} onConfirm={complete} />
      <ReopenTaskDialog item={reopening} onClose={() => setReopening(null)} onConfirm={reopen} />
      <EditMilestoneDialog item={editing} wedding={wedding} onClose={() => setEditing(null)} />
      <AddTaskDialog open={adding} wedding={wedding} onClose={() => setAdding(false)} />
      <WeddingEditDialog open={editingWedding} onOpenChange={setEditingWedding} />
    </>
  )
}

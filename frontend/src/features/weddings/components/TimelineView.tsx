import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TimelineItem, Wedding } from '@/types/wedding'
import { useTimeline, useTimelineMutations } from '../hooks'
import { dateConflictOf, groupByTime, orderProgress, parseView, type ViewMode } from '../timelineGroups'
import { chatDraft, filterTimeline, processChangeDraft, hasFilters, monthOptions, type OwnerFilter, type TimelineFilters as Filters } from '../timelineFilter'
import { CompleteTaskDialog, DeleteTaskDialog } from './TimelineConfirmDialogs'
import { AddTaskDialog, EditMilestoneDialog } from './TimelineDialogs'
import { TimelineServiceSummary } from './TimelineServiceSummary'
import { TimelineCalendar } from './TimelineCalendar'
import { TimelineFilters } from './TimelineFilters'
import { TimelineCard } from './TimelineRow'
import { catalogApi } from '@/api/catalog'
import { usePlanActions } from '../planActions'

type Show = 'todo' | 'done' | 'all'
const SHOWS: { value: Show; label: string }[] = [
  { value: 'todo', label: 'Chưa xong' },
  { value: 'done', label: 'Đã xong' },
  { value: 'all', label: 'Tất cả' },
]

const VIEW_KEY = 'weddy.timeline.view'
/** Chế độ xem (danh sách / lịch) nhớ trong trình duyệt (localStorage có thể bị chặn nên bọc try/catch); giá trị cũ 'service' / 'time' về danh sách: xem parseView. */
const loadView = (): ViewMode => {
  try {
    return parseView(localStorage.getItem(VIEW_KEY))
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

/**
 * Trang Timeline khi đã có thông tin đám cưới: danh sách theo hạn tăng dần, lọc Chưa xong / Đã xong / Tất cả (?show=) và theo hạng mục (?category=).
 * Việc chi tiết của dịch vụ đã cọc nằm TRONG thẻ nhóm của Mốc chốt; Mốc chốt chưa cọc là một thẻ riêng có dòng "N việc chi tiết mở sau khi bạn đặt cọc".
 */
export function TimelineView({ wedding }: { wedding: Wedding }) {
  const timeline = useTimeline(true)
  const { update, remove } = useTimelineMutations()
  const { openChat } = usePlanActions()
  const [params, setParams] = useSearchParams()
  const show = (SHOWS.find((s) => s.value === params.get('show'))?.value ?? 'all') as Show
  const category = params.get('category') ?? ''
  // Tìm kiếm / lọc việc (cách xem THEO THỜI GIAN và LỊCH), giữ trên URL để tải lại hoặc gửi link vẫn còn: ?q= &month= &owner=
  const filters: Filters = {
    q: params.get('q') ?? '',
    month: params.get('month') ?? '',
    owner: (['mine', 'vendor'] as const).find((o) => o === params.get('owner')) ?? 'all',
  }
  const [editing, setEditing] = useState<TimelineItem | null>(null)
  const [completing, setCompleting] = useState<TimelineItem | null>(null)
  const [removing, setRemoving] = useState<TimelineItem | null>(null)
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set())
  const [adding, setAdding] = useState(false)
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

  const { items } = timeline.data
  const slugOf = (i: TimelineItem) => i.category?.slug ?? ''
  const tab = (i: TimelineItem) => show === 'all' || (show === 'done' ? i.isDone : !i.isDone)

  // Mọi việc (khung + việc con + việc tự thêm) qua bộ lọc Chưa xong / Đã xong / Tất cả và dịch vụ; danh sách và lịch dùng chung
  const nowISO = toISODate(today())
  const baseItems = items.filter((i) => i.kind !== 'LOCKED' && (!category || slugOf(i) === category) && tab(i))
  // Số đếm của ô chọn tháng tính theo các bộ lọc khác (trừ tháng) để khớp với những gì sẽ thấy
  const months = monthOptions(filterTimeline(baseItems, { ...filters, month: '' }, nowISO), nowISO)
  const timeItems = filterTimeline(baseItems, view === 'calendar' ? { ...filters, month: '' } : filters, nowISO)
  const timeGroups = groupByTime(timeItems, nowISO)
  const categories = [...new Map(items.filter((i) => i.category).map((i) => [i.category!.slug, i.category!.name])).entries()].map(([slug, label]) => ({ slug, label }))
  // Tóm tắt quy trình của NCC: chỉ khi lọc đúng một dịch vụ (Bộ lọc hoặc ?category=); mỗi đơn đã cọc một dòng
  const kidsOf = (slug: string) => items.filter((i) => i.kind === 'SERVICE_TASK' && slugOf(i) === slug)
  const summary = category ? orderProgress(kidsOf(category)) : []
  // Cảnh báo ngày thực hiện của đơn lệch ngày cưới nằm ở thẻ Mốc chốt của dịch vụ đó (hiện cả khi không lọc)
  const conflictOf = (i: TimelineItem) => (i.kind === 'CATEGORY_DEADLINE' && i.isDone ? dateConflictOf(kidsOf(slugOf(i))) : null)
  const setView = (v: ViewMode) => {
    setViewState(v)
    saveView(v)
  }

  const setShow = (value: Show) =>
    setParams(
      (p) => {
        const next = new URLSearchParams(p)
        if (value === 'all') next.delete('show')
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
  const setFilters = (patch: Partial<Filters>) => setParam({ ...(patch.q !== undefined && { q: patch.q.trim() }), ...(patch.month !== undefined && { month: patch.month }), ...(patch.owner !== undefined && { owner: patch.owner === 'all' ? '' : (patch.owner as OwnerFilter) }) })
  const resetFilters = () => setParam({ q: '', month: '', owner: '', category: '' })
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
  const removeTask = (item: TimelineItem) => {
    setRemoving(null)
    remove.mutate(item.id, { onSuccess: () => toast('Đã xóa việc'), onError: (e) => toast(e.message) })
  }

  /** Mở khung chat với NCC của dịch vụ (đơn), kèm câu nhắn soạn sẵn. */
  const chatWith = (serviceId: string, draft: string) =>
    catalogApi.getService(serviceId).then(
      (service) => openChat(service, { draft }),
      () => toast('Không mở được khung chat với nhà cung cấp'),
    )

  const handlers = {
    onChat: (i: TimelineItem) => void chatWith(i.serviceId!, chatDraft(i)),
    onComplete: setCompleting,
    onEdit: setEditing,
    onRemove: setRemoving,
  }

  const chip = (active: boolean) =>
    cn('rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition-colors', active ? 'border-(--accent) bg-(--accent) text-(--accent-ink)' : 'border-line bg-surface text-ink hover:border-primary')

  return (
    <>

      {/* Tab Timeline trong Kế hoạch của tôi: lọc trạng thái bên trái, nút Thêm việc bên phải (thông tin đám cưới đã ở đầu trang Kế hoạch) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Lọc theo trạng thái" className="flex flex-wrap gap-2">
          {SHOWS.map((s) => (
            <button key={s.value} type="button" aria-pressed={show === s.value} className={chip(show === s.value)} onClick={() => setShow(s.value)}>
              {s.label}
            </button>
          ))}
        </div>
        <Button onClick={() => setAdding(true)}>
          <Plus />
          Thêm việc
        </Button>
      </div>

      <TimelineFilters
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        months={view === 'time' ? months : undefined}
        categories={categories}
        category={category}
        onCategory={(slug) => setParam({ category: slug })}
        shown={timeItems.length}
        view={view}
        onToggleView={() => setView(view === 'calendar' ? 'time' : 'calendar')}
      />

      {view === 'time' && <TimelineServiceSummary orders={summary} onAskVendor={(serviceId, orderCode) => void chatWith(serviceId, processChangeDraft(orderCode))} />}

      {view === 'calendar' ? (
        <TimelineCalendar items={timeItems} weddingDate={wedding.date} renderCard={(i) => <TimelineCard key={i.id} item={i} leaving={leaving.has(i.id)} compactDate conflictDate={conflictOf(i)} {...handlers} />} />
      ) : (
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
                  <TimelineCard key={i.id} item={i} leaving={leaving.has(i.id)} compactDate={g.key !== 'overdue'} conflictDate={conflictOf(i)} {...handlers} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <CompleteTaskDialog item={completing} onClose={() => setCompleting(null)} onConfirm={complete} />
      <DeleteTaskDialog item={removing} onClose={() => setRemoving(null)} onConfirm={removeTask} />
      <EditMilestoneDialog item={editing} wedding={wedding} onClose={() => setEditing(null)} />
      <AddTaskDialog open={adding} wedding={wedding} onClose={() => setAdding(false)} />
    </>
  )
}

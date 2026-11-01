import { Download, FileSpreadsheet, Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { weddingsApi } from '@/api/weddings'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useCategories } from '@/features/catalog/hooks'
import { addDays, parseDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TimelineItem, TimelineItemPatch, Wedding } from '@/types/wedding'
import type { PlanAccess } from '../access'
import { ASSIGNEE_LABEL, matchAssignee, memberName, relativeMembers } from '../assignee'
import { useMembers, usePlan, useTimeline, useTimelineMutations, useUpdateMember } from '../hooks'
import { ImportDialog } from '../import/ImportDialog'
import { usePlanActions } from '../planActions'
import { useAiSuggest } from '../useAiSuggest'
import { AddTaskDialog, EditMilestoneDialog } from './TimelineDialogs'
import { LockedGroupRow, TimelineRow, WeddingDayRow } from './TimelineRow'

const chip = (active: boolean) =>
  cn('rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition-colors', active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-primary')

/** Giá trị cũ của các trường sắp sửa, để "Hoàn tác". */
function previous(item: TimelineItem, patch: TimelineItemPatch): TimelineItemPatch {
  const prev: TimelineItemPatch = {}
  if ('dueDate' in patch && item.dueDate) prev.dueDate = item.dueDate
  if ('isDone' in patch) prev.isDone = item.isDone
  if ('assignee' in patch) Object.assign(prev, { assignee: item.assignee?.kind ?? null, assigneeUserId: item.assignee?.userId ?? null })
  if ('note' in patch) prev.note = item.note?.text ?? null
  return prev
}

/**
 * Subtab Timeline của Kế hoạch (tlTab trong prototype, P4). Lọc hạng mục (?category=) và phụ trách (?giao=) lưu trên URL.
 * Các việc chi tiết chưa mở gộp thành một dòng; lọc theo người thì không hiện dòng này.
 */
export function TimelineView({ wedding, access }: { wedding: Wedding; access: PlanAccess }) {
  const timeline = useTimeline(true)
  const { data: plan } = usePlan()
  const { data: members = [] } = useMembers()
  const { data: categories = [] } = useCategories()
  const { update } = useTimelineMutations()
  const updateMember = useUpdateMember()
  const aiSuggest = useAiSuggest()
  const { openChat } = usePlanActions()
  const [params, setParams] = useSearchParams()
  const filter = params.get('category') ?? ''
  const person = params.get('giao') ?? ''
  const [editing, setEditing] = useState<TimelineItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)

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

  const items = timeline.data.items
  const relatives = relativeMembers(members)
  const dueBounds = { min: toISODate(today()), max: toISODate(addDays(parseDate(wedding.date), -1)) }
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true, preventScrollReset: true })
  }

  // Chip lọc: các hạng mục có trên timeline, theo thứ tự danh mục
  const order = categories.map((c) => c.slug)
  const slots = items
    .filter((i) => i.kind === 'CATEGORY_DEADLINE')
    .map((i) => i.category!)
    .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug))

  // Lọc phụ trách chỉ hiện khi đã có việc được giao
  const assignable = items.filter((i) => i.kind !== 'LOCKED' && i.kind !== 'SERVICE_DATE')
  const people = [
    { key: 'bride', label: ASSIGNEE_LABEL.BRIDE },
    { key: 'groom', label: ASSIGNEE_LABEL.GROOM },
    { key: 'both', label: ASSIGNEE_LABEL.BOTH },
    ...relatives.map((m) => ({ key: m.userId, label: memberName(m) })),
    { key: 'none', label: 'Chưa giao' },
  ]
  const hasAssigned = assignable.some((i) => i.assignee)

  const visible = items.filter((i) => (!filter || i.category?.slug === filter) && (!person || (i.kind !== 'LOCKED' && i.kind !== 'SERVICE_DATE' && matchAssignee(i.assignee, person))))
  const locked = visible.filter((i) => i.kind === 'LOCKED')
  const firstLocked = locked[0]?.id

  // Tiến độ: không tính chỗ giữ (LOCKED) và ngày thực hiện (SERVICE_DATE)
  const done = assignable.filter((i) => i.isDone).length
  const percent = assignable.length ? Math.round((done / assignable.length) * 100) : 0

  /** Sửa nhanh kèm Hoàn tác. Giao việc cho người chỉ xem thì báo, owner có nút "Cho phép chỉnh sửa". */
  function patch(item: TimelineItem, p: TimelineItemPatch, message: string) {
    const undo = previous(item, p)
    update.mutate(
      { id: item.id, patch: p },
      {
        onSuccess: () => {
          const target =
            p.assignee === 'MEMBER'
              ? members.find((m) => m.userId === p.assigneeUserId)
              : p.assignee === 'BRIDE' || p.assignee === 'GROOM'
                ? members.find((m) => m.relation === p.assignee)
                : undefined
          if (target?.role === 'VIEWER') {
            toast(`${memberName(target)} đang chỉ xem nên chưa tích xong được`, {
              duration: 8000,
              action: access.isOwner ? { label: 'Cho phép chỉnh sửa', onClick: () => updateMember.mutate({ userId: target.userId, role: 'EDITOR' }, { onSuccess: () => toast('Đã cho phép chỉnh sửa') }) } : undefined,
            })
            return
          }
          toast(message, { action: { label: 'Hoàn tác', onClick: () => update.mutate({ id: item.id, patch: undo }) } })
        },
      },
    )
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <div className="mr-2 min-w-[220px] flex-1">
          <div>
            <b className="font-serif text-[22px] font-semibold">{done}</b>/{assignable.length} việc đã xong
          </div>
          <div className="mt-2.5 h-1.5 overflow-hidden rounded-[9px] bg-line" aria-hidden>
            <i className="block h-full bg-sage" style={{ width: `${percent}%` }} />
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => weddingsApi.downloadExport('tasks').catch((e: Error) => toast(e.message))}>
          <Download />
          Tải về
        </Button>
        {access.canEdit && (
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            <FileSpreadsheet />
            Nhập từ Excel
          </Button>
        )}
        <Button size="sm" disabled={!access.canEdit} onClick={() => setAdding(true)}>
          <Plus />
          Thêm việc
        </Button>
      </div>

      <div role="group" aria-label="Lọc theo hạng mục" className="mb-2.5 flex flex-wrap gap-2">
        <button type="button" aria-pressed={!filter} className={chip(!filter)} onClick={() => setParam('category', '')}>
          Tất cả
        </button>
        {slots.map((c) => (
          <button key={c.slug} type="button" aria-pressed={filter === c.slug} className={chip(filter === c.slug)} onClick={() => setParam('category', c.slug)}>
            {c.name}
          </button>
        ))}
      </div>

      {(hasAssigned || person) && (
        <div role="group" aria-label="Lọc theo người phụ trách" className="mb-3.5 flex flex-wrap items-center gap-2">
          <span className="text-[13px] text-muted-foreground">Phụ trách:</span>
          <button type="button" aria-pressed={!person} className={chip(!person)} onClick={() => setParam('giao', '')}>
            Tất cả
          </button>
          {people.map((p) => (
            <button key={p.key} type="button" aria-pressed={person === p.key} className={chip(person === p.key)} onClick={() => setParam('giao', p.key)}>
              {p.label} <span className="opacity-70">{assignable.filter((i) => matchAssignee(i.assignee, p.key)).length}</span>
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {visible.map((item) =>
          item.kind === 'LOCKED' ? (
            item.id === firstLocked && <LockedGroupRow key="locked" names={locked.map((l) => l.category?.name.toLowerCase() ?? l.title)} />
          ) : (
            <TimelineRow
                key={item.id}
                item={item}
                onToggle={(i) => patch(i, { isDone: !i.isDone }, i.isDone ? 'Đã bỏ đánh dấu xong' : 'Đã đánh dấu xong')}
                onEdit={setEditing}
                onPatch={patch}
                relatives={relatives}
                dueBounds={dueBounds}
                onAiSuggest={aiSuggest}
                readOnly={!access.canEdit}
                canChat={access.canChat}
                onOpenChat={(serviceId) => {
                  const service = plan?.items.find((p) => p.service.id === serviceId)?.service
                  if (service) openChat(service)
                }}
              />
          ),
        )}
        {!visible.length && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Không có việc nào khớp bộ lọc.</p>}
        {!filter && !person && <WeddingDayRow date={wedding.date} />}
      </div>

      <EditMilestoneDialog item={editing} wedding={wedding} relatives={relatives} onClose={() => setEditing(null)} />
      <AddTaskDialog open={adding} wedding={wedding} relatives={relatives} onClose={() => setAdding(false)} />
      <ImportDialog type="tasks" open={importing} onOpenChange={setImporting} />
    </>
  )
}

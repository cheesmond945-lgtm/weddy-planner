import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { useCategories } from '@/features/catalog/hooks'
import { cn } from '@/lib/utils'
import type { TimelineItem, Wedding } from '@/types/wedding'
import { usePlan, useTimeline, useTimelineMutations } from '../hooks'
import { usePlanActions } from '../planActions'
import { useAiSuggest } from '../useAiSuggest'
import { AddTaskDialog, EditMilestoneDialog } from './TimelineDialogs'
import { TimelineHero } from './TimelineHero'
import { TimelineRow, WeddingDayRow } from './TimelineRow'
import { WeddingEditDialog } from './WeddingDialogs'

/** Trang Timeline khi đã có thông tin đám cưới (renderTimeline trong prototype). Lọc hạng mục lưu trên URL ?category=. */
export function TimelineView({ wedding }: { wedding: Wedding }) {
  const timeline = useTimeline(true)
  const { data: plan } = usePlan()
  const { data: categories = [] } = useCategories()
  const { update } = useTimelineMutations()
  const aiSuggest = useAiSuggest()
  const { openChat } = usePlanActions()
  const [params, setParams] = useSearchParams()
  const filter = params.get('category') ?? ''
  const [editing, setEditing] = useState<TimelineItem | null>(null)
  const [adding, setAdding] = useState(false)
  const [editingWedding, setEditingWedding] = useState(false)

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
  // Chip lọc: các hạng mục có trên timeline, theo thứ tự danh mục
  const order = categories.map((c) => c.slug)
  const slots = items
    .filter((i) => i.kind === 'CATEGORY_DEADLINE')
    .map((i) => i.category!)
    .sort((a, b) => order.indexOf(a.slug) - order.indexOf(b.slug))
  const visible = items.filter((i) => !filter || i.category?.slug === filter)
  const setFilter = (slug: string) => setParams(slug ? { category: slug } : {}, { replace: true, preventScrollReset: true })

  const chip = (active: boolean) =>
    cn(
      'rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
      active ? 'border-ink bg-ink text-bg' : 'border-line bg-surface text-ink hover:border-primary',
    )

  return (
    <>
      <TimelineHero wedding={wedding} items={items} onEdit={() => setEditingWedding(true)} onAddTask={() => setAdding(true)} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-[26px] leading-[1.15]">Timeline</h1>
        <div role="group" aria-label="Lọc theo hạng mục" className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={!filter} className={chip(!filter)} onClick={() => setFilter('')}>
            Tất cả
          </button>
          {slots.map((c) => (
            <button key={c.slug} type="button" aria-pressed={filter === c.slug} className={chip(filter === c.slug)} onClick={() => setFilter(c.slug)}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-line bg-surface">
        {visible.map((item) => (
          <TimelineRow
            key={item.id}
            item={item}
            onToggle={(i) => update.mutate({ id: i.id, patch: { isDone: !i.isDone } })}
            onEdit={setEditing}
            onAiSuggest={aiSuggest}
            onOpenChat={(serviceId) => {
              const service = plan?.items.find((p) => p.service.id === serviceId)?.service
              if (service) openChat(service)
            }}
          />
        ))}
        {!filter && <WeddingDayRow date={wedding.date} />}
      </div>

      <EditMilestoneDialog item={editing} wedding={wedding} onClose={() => setEditing(null)} />
      <AddTaskDialog open={adding} wedding={wedding} onClose={() => setAdding(false)} />
      <WeddingEditDialog open={editingWedding} onOpenChange={setEditingWedding} />
    </>
  )
}

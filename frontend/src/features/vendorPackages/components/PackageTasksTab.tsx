import { ArrowDown, ArrowUp, ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { PackageTaskOwner } from '@/types/vendorPackage'
import type { PackageTasksDraft } from '../hooks'
import { canMove, countByOwner, MAX_TASKS, move, offsetLabel, OWNER_CUSTOMER_VIEW, OWNER_LABEL, remove, upsert, type TaskDraft } from '../packageTasks'
import { TaskDialog } from './TaskDialog'

const card = 'rounded-md border border-line bg-surface px-7 pt-[26px] pb-6 shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4'

const OWNER_TONE: Record<PackageTaskOwner, string> = {
  VENDOR: 'bg-info-soft text-info',
  CUSTOMER: 'bg-gold-soft text-gold-ink',
  BOTH: 'bg-sage-soft text-sage',
}

type Filter = 'ALL' | PackageTaskOwner
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'VENDOR', label: 'Nhà cung cấp' },
  { value: 'CUSTOMER', label: 'Khách hàng' },
  { value: 'BOTH', label: 'Cả hai' },
]

function OwnerBadge({ owner }: { owner: PackageTaskOwner }) {
  return <span className={cn('inline-block rounded-pill px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', OWNER_TONE[owner])}>{OWNER_LABEL[owner]}</span>
}

/**
 * Tab "Công việc" của gói: trái là danh sách NCC khai, phải là bản xem trước "Khách sẽ thấy sau khi đặt cọc".
 * Mọi thao tác chỉ đổi danh sách trên màn (draft); xuống CSDL khi bấm lưu ở thanh dưới của trang.
 */
export function PackageTasksTab({ draft, disabled }: { draft: PackageTasksDraft; disabled?: boolean }) {
  const [filter, setFilter] = useState<Filter>('ALL')
  const [dialog, setDialog] = useState<{ task?: TaskDraft } | null>(null)
  const list = draft.rows
  const counts = countByOwner(list)
  const full = list.length >= MAX_TASKS

  if (draft.loading) return <div aria-busy="true" aria-label="Đang tải công việc" className="h-[320px] animate-pulse rounded-md bg-muted" />
  if (draft.loadError) {
    return (
      <div className={card} role="alert">
        <p className="text-[13.5px] text-destructive">Chưa tải được công việc của gói: {draft.loadError.message}</p>
      </div>
    )
  }

  // Hiện số thứ tự theo vị trí trong cả danh sách (không đổi khi lọc)
  const shown = list.map((task, index) => ({ task, index })).filter(({ task }) => filter === 'ALL' || task.owner === filter)
  const edit = (update: (rows: TaskDraft[]) => TaskDraft[]) => draft.setRows(update)

  const addButton = (
    <Button type="button" size="sm" disabled={disabled || full} title={full ? `Tối đa ${MAX_TASKS} công việc mỗi gói` : undefined} onClick={() => setDialog({})}>
      <Plus />
      Thêm công việc
    </Button>
  )

  return (
    <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] items-start gap-5 max-lg:grid-cols-1">
      <p className="col-span-full text-[13px] text-muted-foreground">Công việc lưu ngay, không cần Admin duyệt, và chỉ áp dụng cho các đơn đặt cọc sau khi lưu.</p>
      <section className={card} aria-labelledby="package-tasks-title">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="package-tasks-title" className="font-sans text-[17px] font-semibold tracking-normal">
              Công việc của gói
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{list.length} công việc</p>
          </div>
          {addButton}
        </div>

        {list.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Lọc theo người phụ trách">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-pill border px-3 py-1 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                  filter === f.value ? 'border-gold bg-gold-soft text-gold-ink' : 'border-line-strong bg-surface hover:bg-surface-2',
                )}
              >
                {f.label} <span className="tabular-nums">({counts[f.value]})</span>
              </button>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <div className="grid justify-items-center gap-3 rounded-md border border-dashed border-line px-4 py-10 text-center">
            <ListChecks className="size-8 text-muted-foreground" aria-hidden />
            <p className="max-w-[360px] text-[13.5px] text-muted-foreground">Chưa có công việc — khách sẽ không thấy các bước phục vụ sau khi đặt cọc</p>
            {addButton}
          </div>
        ) : shown.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-muted-foreground">Không có công việc nào ở mục này.</p>
        ) : (
          <ol className="grid gap-2.5">
            {shown.map(({ task, index }) => {
              const up = canMove(list, index, -1)
              const down = canMove(list, index, 1)
              return (
                <li key={task.key} className="flex items-start gap-3 rounded-sm border border-line bg-surface px-3.5 py-3">
                  <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums">{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[14.5px] leading-snug font-semibold break-words">{task.title}</div>
                    {task.note && <div className="mt-0.5 text-[12.5px] leading-snug break-words text-muted-foreground">{task.note}</div>}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <OwnerBadge owner={task.owner} />
                      <span className="inline-block rounded-pill border border-line-strong px-2.5 py-0.5 text-xs font-medium whitespace-nowrap">{offsetLabel(task.offsetDays)}</span>
                    </div>
                  </div>
                  {!disabled && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="size-8 disabled:opacity-35" aria-label={`Chuyển lên: ${task.title}`} title={up ? 'Chuyển lên' : 'Chỉ đổi thứ tự giữa các việc cùng mốc'} disabled={!up} onClick={() => edit((r) => move(r, index, -1))}>
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="size-8 disabled:opacity-35" aria-label={`Chuyển xuống: ${task.title}`} title={down ? 'Chuyển xuống' : 'Chỉ đổi thứ tự giữa các việc cùng mốc'} disabled={!down} onClick={() => edit((r) => move(r, index, 1))}>
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="size-8" aria-label={`Sửa: ${task.title}`} onClick={() => setDialog({ task })}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button type="button" variant="outline" size="icon" className="size-8 text-warn hover:bg-warn-soft" aria-label={`Xóa: ${task.title}`} onClick={() => edit((r) => remove(r, task.key))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <aside className={card} aria-labelledby="package-tasks-preview">
        <h2 id="package-tasks-preview" className="font-sans text-[17px] font-semibold tracking-normal">
          Khách sẽ thấy sau khi đặt cọc
        </h2>
        {list.length === 0 ? (
          <p className="mt-3 text-[13.5px] text-muted-foreground">Chưa có công việc nào để hiển thị.</p>
        ) : (
          <ol className="mt-4 grid">
            {list.map((task, i) => (
              <li key={task.key} className="relative flex gap-3 pb-4 last:pb-0">
                {i < list.length - 1 && <span aria-hidden className="absolute top-4 bottom-0 left-[5px] w-px bg-line-strong" />}
                <span aria-hidden className="relative mt-1 size-[11px] shrink-0 rounded-full border-2 border-gold bg-surface" />
                <div className="min-w-0">
                  <div className="text-[14px] leading-snug font-semibold break-words">{task.title}</div>
                  <div className="text-[12.5px] text-muted-foreground">{OWNER_CUSTOMER_VIEW[task.owner]}</div>
                  <div className="text-[12.5px] font-medium text-gold-ink">{offsetLabel(task.offsetDays)}</div>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-5 rounded-sm bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed text-muted-foreground">
          Hạn của từng việc được tính tự động theo ngày thực hiện của đơn khi khách đặt cọc (ví dụ: ngày thực hiện 20/03, việc “trước 21 ngày” có hạn 27/02). Nhà cung cấp chốt lại ngày với khách ở mục Lịch. Sửa công việc không ảnh hưởng các đơn đã cọc.
        </p>
      </aside>

      <TaskDialog
        open={!!dialog}
        task={dialog?.task}
        onClose={() => setDialog(null)}
        onSave={(task) => edit((r) => upsert(r, task))}
      />
    </div>
  )
}

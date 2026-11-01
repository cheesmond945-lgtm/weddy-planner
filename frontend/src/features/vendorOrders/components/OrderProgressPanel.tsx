import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { daysBetween, formatDate, parseDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { OrderTask, TaskOwner } from '@/types/vendorOrder'
import { useState } from 'react'
import { useConfirmTaskDate, useOrderTasks, useRescheduleTask, useSetOrderTask } from '../hooks'
import { needsScheduleConfirm } from '../taskBoard'
import { TaskDateDialog } from './TaskDateDialog'

const OWNER: Record<TaskOwner, { label: string; tone: BadgeTone }> = {
  CUSTOMER: { label: 'Khách làm', tone: 'neutral' },
  VENDOR: { label: 'NCC làm', tone: 'talk' },
  BOTH: { label: 'Hai bên', tone: 'info' },
}

/** Một việc của đơn: ô tick (nếu NCC được tick), tên, hạn, chủ việc. `extra` là dòng phụ dưới hạn (mã đơn, khách khi hiện ở lịch). */
export function TaskRow({ t, busy, onToggle, onConfirm, onReschedule, extra }: { t: OrderTask; busy: boolean; onToggle: (t: OrderTask) => void; onConfirm?: (t: OrderTask) => void; onReschedule?: (t: OrderTask) => void; extra?: ReactNode }) {
  const confirmSoon = needsScheduleConfirm(t, toISODate(today()))
  const owner = OWNER[t.owner]
  // Sắp đến hạn: còn 0 đến 2 ngày (cùng ngưỡng với thông báo của backend)
  const dueSoon = !t.isDone && !t.overdue && !!t.dueDate && daysBetween(today(), parseDate(t.dueDate)) <= 2
  return (
    <li className={cn('flex items-start gap-3 rounded-md border border-line px-3.5 py-2.5', confirmSoon && 'border-orange-400', t.overdue && 'border-warn/50 bg-warn-soft/40')}>
      {t.canTick ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={t.isDone}
          aria-label={`${t.isDone ? 'Mở lại' : 'Hoàn thành'}: ${t.title}`}
          disabled={busy}
          onClick={() => onToggle(t)}
          className={cn(
            'mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage disabled:opacity-60',
            t.isDone ? 'border-sage bg-sage text-white' : 'border-line-strong bg-surface hover:border-sage',
          )}
        >
          {t.isDone && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
        </button>
      ) : (
        <span aria-hidden className={cn('mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border-2', t.isDone ? 'border-sage bg-sage text-white' : 'border-line bg-surface-2')}>
          {t.isDone && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('text-[13.5px] leading-snug font-medium [overflow-wrap:anywhere]', t.isDone && 'text-muted-foreground line-through')}>{t.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
          <span className={cn(t.overdue && 'font-semibold text-warn')}>Hạn {formatDate(t.dueDate)}</span>
          {t.overdue && <span className="font-semibold text-warn">· Quá hạn</span>}
          {dueSoon && <span className="font-semibold text-gold-ink">· Sắp đến hạn</span>}
          {t.status === 'Waiting' && !t.isDone && <span>· Chờ khách thực hiện</span>}
          {!t.isDone && <span>· {t.dateStatus === 'CONFIRMED' ? 'Đã chốt lịch' : 'Dự kiến'}</span>}
          {confirmSoon && <span className="font-semibold text-warn">· Cần chốt lịch</span>}
        </p>
        {t.needsRecheck && (
          <p className="mt-1 flex items-start gap-1.5 text-[12.5px] font-medium text-warn">
            <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-warn" />
            Ngày thực hiện đã đổi — kiểm tra lại lịch đã chốt
          </p>
        )}
        {extra}
        {onReschedule && !t.isDone && t.canTick && (
          <button type="button" disabled={busy} onClick={() => onReschedule(t)} className="mt-1 mr-3 text-[12.5px] font-medium text-gold-ink underline underline-offset-2 disabled:opacity-60">
            Đổi ngày…
          </button>
        )}
        {onConfirm && !t.isDone && t.canTick && (
          <button type="button" disabled={busy} onClick={() => onConfirm(t)} className="mt-1 text-[12.5px] font-medium text-gold-ink underline underline-offset-2 disabled:opacity-60">
            {t.dateStatus === 'CONFIRMED' ? 'Bỏ chốt ngày' : 'Chốt ngày này'}
          </button>
        )}
      </div>
      <Badge tone={owner.tone} className="shrink-0">
        {owner.label}
      </Badge>
    </li>
  )
}

/**
 * "Tiến độ đơn" (docs/TIMELINE.md mục 8): việc chi tiết gắn với đơn, dùng chung với timeline của khách.
 * NCC tự chủ mọi việc của đơn: đổi trạng thái (Todo / Waiting / Done), chốt ngày với khách. Khách chỉ xem, thấy việc xong ngay và nhận thông báo.
 */
export function OrderProgressPanel({ orderId, readOnly }: { orderId: string; readOnly?: boolean }) {
  const { data, isLoading, isError } = useOrderTasks(orderId)
  const set = useSetOrderTask(orderId)
  const confirm = useConfirmTaskDate(orderId)
  const reschedule = useRescheduleTask()
  const [rescheduling, setRescheduling] = useState<OrderTask | null>(null)

  if (isLoading) return <p className="text-[13.5px] text-muted-foreground">Đang tải tiến độ…</p>
  if (isError || !data) return <p className="text-[13.5px] text-warn">Không tải được tiến độ đơn.</p>
  if (!data.items.length) return <p className="text-[13.5px] text-muted-foreground">Đơn này chưa có việc nào trên timeline của khách.</p>

  const { progress } = data
  const items = readOnly ? data.items.map((t) => ({ ...t, canTick: false })) : data.items
  return (
    <div>
      <p className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        <span>{progress.open} việc chưa xong</span>
        {progress.overdueVendor > 0 && <span className="font-semibold text-warn">{progress.overdueVendor} việc của bạn đang trễ</span>}
        {progress.dueSoonVendor > 0 && <span className="font-semibold text-gold-ink">{progress.dueSoonVendor} việc của bạn sắp đến hạn</span>}
        {progress.overdueCustomer > 0 && <span>{progress.overdueCustomer} việc của khách đang trễ</span>}
      </p>
      <ul className="grid gap-2">
        {items.map((t) => (
          <TaskRow
            key={t.id}
            t={t}
            busy={set.isPending || confirm.isPending}
            onToggle={(x) => set.mutate({ taskId: x.id, isDone: !x.isDone })}
            onConfirm={(x) => confirm.mutate(x.dateStatus === 'CONFIRMED' ? { taskId: x.id, unconfirm: true } : { taskId: x.id })}
            onReschedule={readOnly ? undefined : setRescheduling}
          />
        ))}
      </ul>
      <TaskDateDialog
        target={rescheduling && { title: rescheduling.title, dueDate: rescheduling.dueDate, eventDate: data.eventDate ?? '' }}
        busy={reschedule.isPending}
        onClose={() => setRescheduling(null)}
        onPick={(date) => rescheduling && reschedule.mutate({ orderId, taskId: rescheduling.id, date }, { onSuccess: () => setRescheduling(null) })}
      />
    </div>
  )
}

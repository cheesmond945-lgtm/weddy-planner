import { Check, Loader2, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/Badge'
import { daysBetween, parseDate, toISODate, today } from '@/lib/date'
import { TASK_LABELS } from '@/lib/taskLabels'
import { cn } from '@/lib/utils'
import type { OrderTask, TaskOwner } from '@/types/vendorOrder'
import { useOrderTasks } from '../hooks'
import { usePendingTask, useTaskActions } from '../taskActions'
import { needsScheduleConfirm } from '../taskBoard'
import { Button } from '@/components/ui/button'
import { OrderTaskDialog } from './OrderTaskDialog'
import { RestReceivedDialog } from './RestReceivedDialog'
import { TaskDateRow } from './TaskDateRow'
import { TaskTitle } from './TaskTitle'
import { CustomTaskTag, TaskMenu } from './TaskMenu'

const OWNER: Record<TaskOwner, { label: string; tone: BadgeTone }> = {
  CUSTOMER: { label: 'Khách làm', tone: 'neutral' },
  VENDOR: { label: 'NCC làm', tone: 'talk' },
  BOTH: { label: 'Hai bên', tone: 'info' },
}

interface TaskRowProps {
  t: OrderTask
  orderId: string
  /** Ngày thực hiện của đơn "YYYY-MM-DD" (giới hạn trên của ô chọn ngày: ngày này + 120) */
  eventDate?: string
  /** Số tiền đợt 2, hiện trong hộp xác nhận đã nhận tiền mặt */
  restAmount?: number
  /** Tên khách, hiện trong hộp xác nhận bỏ việc */
  customerName?: string
  /** Chỉ xem (đơn đã hoàn tất): không tick, không đổi ngày */
  readOnly?: boolean
  /** Dòng phụ dưới hạn (mã đơn, khách khi hiện ở lịch) */
  extra?: ReactNode
}

/**
 * Một việc của đơn: ô tick, tên, nhãn ngày bấm được (Dự kiến / Đã chốt), chủ việc. Mọi thao tác đổi giao diện NGAY (cập nhật lạc quan, taskActions.ts),
 * chỉ khóa đúng việc này (spinner nhỏ trên ô tick) và việc khác vẫn bấm được.
 */
export function TaskRow({ t, orderId, eventDate = '', restAmount, customerName, readOnly, extra }: TaskRowProps) {
  const run = useTaskActions()
  const busy = usePendingTask(t.id)
  const [receiving, setReceiving] = useState(false)
  const confirmSoon = needsScheduleConfirm(t, toISODate(today()))
  const owner = OWNER[t.owner]
  const editable = t.canTick && !readOnly
  // Sắp đến hạn: còn 0 đến 2 ngày (cùng ngưỡng với thông báo của backend)
  const dueSoon = !t.isDone && !t.overdue && !!t.dueDate && daysBetween(today(), parseDate(t.dueDate)) <= 2
  const meta = { isRestPayment: t.isRestPayment }

  // Bỏ tick: việc của khách về Chờ khách, còn lại về Cần làm. Việc "Thanh toán phần còn lại" sang Xong thì hỏi xác nhận đã nhận tiền mặt.
  const toggle = () => {
    if (t.isRestPayment && !t.isDone) return setReceiving(true)
    void run(orderId, t.id, { kind: 'status', status: t.isDone ? (t.owner === 'CUSTOMER' ? 'Waiting' : 'Todo') : 'Done' }, meta)
  }

  return (
    <li className={cn('rounded-md border border-line px-3.5 py-2.5', confirmSoon && 'border-orange-400', t.overdue && 'border-warn/50 bg-warn-soft/40')}>
      <div className="flex items-start gap-3">
      {editable ? (
        <button
          type="button"
          role="checkbox"
          aria-checked={t.isDone}
          aria-busy={busy}
          aria-label={`${t.isDone ? 'Mở lại' : 'Hoàn thành'}: ${t.title}`}
          disabled={busy}
          onClick={toggle}
          className={cn(
            'mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage',
            t.isDone ? 'border-sage bg-sage text-white' : 'border-line-strong bg-surface hover:border-sage',
          )}
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : t.isDone && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
        </button>
      ) : (
        <span aria-hidden className={cn('mt-0.5 grid size-[22px] shrink-0 place-items-center rounded-full border-2', t.isDone ? 'border-sage bg-sage text-white' : 'border-line bg-surface-2')}>
          {t.isDone && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <TaskTitle title={t.title} className={cn('text-[13.5px] leading-snug font-semibold [overflow-wrap:anywhere]', t.isDone && 'text-muted-foreground line-through')} />
        {((t.status === 'Waiting' && !t.isDone) || dueSoon || confirmSoon) && (
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
            {t.status === 'Waiting' && !t.isDone && <span>{TASK_LABELS.waitingCustomer}</span>}
            {dueSoon && <span className="font-semibold text-gold-ink">Sắp đến hạn</span>}
            {confirmSoon && <span className="font-semibold text-warn">{TASK_LABELS.needsConfirmDate}</span>}
          </p>
        )}
        {t.needsRecheck && (
          <p className="mt-1 flex items-start gap-1.5 text-[12.5px] font-medium text-warn">
            <span aria-hidden className="mt-1 size-2 shrink-0 rounded-full bg-warn" />
            Ngày thực hiện đã đổi — kiểm tra lại lịch đã chốt
          </p>
        )}
        {extra}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <TaskMenu task={t} orderId={orderId} customerName={customerName} eventDate={eventDate} readOnly={!editable} />
        {t.isCustomOrderTask && <CustomTaskTag />}
        <Badge tone={owner.tone} className="shrink-0">
          {owner.label}
        </Badge>
      </div>
      </div>
      {/* Hàng ngày nằm dưới cả hàng trên: mép phải cụm nút thẳng với mép phải nhãn chủ việc; chip thẳng với tên việc (ô tick 22px + gap 12px) */}
      <div className="mt-1.5 pl-[34px]">
        <TaskDateRow
          dueDate={t.dueDate}
          eventDate={eventDate}
          beforeEvent={t.beforeEvent}
          overdue={t.overdue}
          isDone={t.isDone}
          readOnly={!editable}
          busy={busy}
          onPickDate={(date) => void run(orderId, t.id, { kind: 'date', date })}
        />
      </div>
      <RestReceivedDialog open={receiving} amount={restAmount} onOpenChange={setReceiving} onConfirm={() => void run(orderId, t.id, { kind: 'status', status: 'Done' }, meta)} />
    </li>
  )
}

/**
 * "Tiến độ đơn" (docs/TIMELINE.md mục 8): việc chi tiết gắn với đơn, dùng chung với timeline của khách.
 * NCC tự chủ mọi việc của đơn: đổi trạng thái (Todo / Waiting / Done), chốt hoặc đổi ngày với khách. Khách chỉ xem, thấy việc xong ngay và nhận thông báo.
 */
export function OrderProgressPanel({ orderId, customerName, readOnly }: { orderId: string; customerName?: string; readOnly?: boolean }) {
  const { data, isLoading, isError } = useOrderTasks(orderId)
  const [adding, setAdding] = useState(false)

  if (isLoading) return <p className="text-[13.5px] text-muted-foreground">Đang tải tiến độ…</p>
  if (isError || !data) return <p className="text-[13.5px] text-warn">Không tải được tiến độ đơn.</p>

  // progress được cập nhật tại chỗ sau mỗi thao tác (taskActions.ts), không phải hỏi lại server
  const { progress } = data
  const addButton = !readOnly && (
    <>
      <Button type="button" variant="outline" size="sm" className="mb-2.5 border-line-strong" onClick={() => setAdding(true)}>
        <Plus className="size-3.5" aria-hidden />
        Thêm việc cho đơn này
      </Button>
      <OrderTaskDialog open={adding} orderId={orderId} eventDate={data.eventDate ?? ''} hasPackage={data.hasPackage} onClose={() => setAdding(false)} />
    </>
  )
  if (!data.items.length) {
    return (
      <div>
        {addButton}
        <p className="text-[13.5px] text-muted-foreground">Đơn này chưa có việc nào trên timeline của khách.</p>
      </div>
    )
  }
  return (
    <div>
      {addButton}
      <p className="mb-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        <span>{progress.open} việc chưa xong</span>
        {progress.overdueVendor > 0 && <span className="font-semibold text-warn">{progress.overdueVendor} việc của bạn đang trễ</span>}
        {progress.dueSoonVendor > 0 && <span className="font-semibold text-gold-ink">{progress.dueSoonVendor} việc của bạn sắp đến hạn</span>}
        {progress.overdueCustomer > 0 && <span>{progress.overdueCustomer} việc của khách đang trễ</span>}
      </p>
      <ul className="grid gap-2">
        {data.items.map((t) => (
          <TaskRow key={t.id} t={t} orderId={orderId} eventDate={data.eventDate} restAmount={data.restAmount} customerName={customerName} readOnly={readOnly} />
        ))}
      </ul>
    </div>
  )
}

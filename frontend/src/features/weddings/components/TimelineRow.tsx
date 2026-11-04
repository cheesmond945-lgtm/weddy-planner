import { Ban, CalendarDays, Check, Clock, Hourglass, Lock, MessageSquareText, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useState, type KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DateChip } from '@/features/vendorOrders/components/TaskDateRow'
import { TaskTitle } from '@/features/vendorOrders/components/TaskTitle'
import { daysBetween, formatDate, parseDate, today } from '@/lib/date'
import { TASK_LABELS } from '@/lib/taskLabels'
import { cn } from '@/lib/utils'
import type { TimelineItem } from '@/types/wedding'
import { DUE_SOON_DAYS } from '../timelineFilter'
import { SuggestionsDialog } from './SuggestionsPanel'

/** Tên hạng mục dùng trong chữ ("Gợi ý nhà hàng", "Việc chi tiết của nhà hàng"); danh mục lạ thì dùng tên từ API. */
export const SERVICE_LABEL: Record<string, string> = {
  'nha-hang': 'nhà hàng',
  'chup-anh': 'chụp ảnh & quay phim',
  'trang-phuc': 'trang phục',
  decor: 'trang trí',
  makeup: 'makeup',
  'hoa-cuoi': 'hoa cưới',
}
export const serviceLabel = (item: TimelineItem) => SERVICE_LABEL[item.category?.slug ?? ''] ?? item.category?.name.toLowerCase() ?? 'dịch vụ'

/** "14/7/2026": ngày, tháng không đệm số 0 (như thiết kế mẫu). */
export const dmy = (s: string) => {
  const d = parseDate(s)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}
export const dm = (s: string) => {
  const d = parseDate(s)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

/** Tag trạng thái của việc chi tiết (pill nổi bật, góc phải trên của thẻ): Bạn cần làm / Cùng NCC / NCC thực hiện / Đã xong · dd/mm. */
function StatusTag({ item }: { item: TimelineItem }) {
  const base = 'inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3 py-1 text-[12.5px] leading-none font-bold whitespace-nowrap'
  if (item.isDone) {
    const day = item.completedDate ? formatDate(new Date(new Date(item.completedDate).getTime() + 7 * 3600_000).toISOString().slice(0, 10)).slice(0, 5) : ''
    return (
      <span className={cn(base, 'bg-sage-soft text-sage')}>
        <Check className="size-3.5" strokeWidth={3} aria-hidden />
        {item.isRestPayment ? 'Đã thanh toán' : 'Đã xong'}
        {day && ` · ${day}`}
      </span>
    )
  }
  if (item.status === 'Waiting') {
    return (
      <span className={cn(base, 'border border-gold/60 bg-[color-mix(in_srgb,var(--gold)_30%,var(--surface))] text-gold-ink')}>
        <Hourglass className="size-3.5" aria-hidden />
        {TASK_LABELS.youNeedToDo}
      </span>
    )
  }
  if (item.owner === 'BOTH') return <span className={cn(base, 'bg-info-soft text-info')}>{TASK_LABELS.withVendor}</span>
  return <span className={cn(base, 'border border-line bg-surface-2 text-muted-foreground')}>{TASK_LABELS.vendorDoing}</span>
}

const card =
  'group relative flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[22px] border border-line bg-surface px-5 py-[18px] shadow-card transition-all duration-150 ease-out max-[640px]:px-4'
/** Thẻ bấm được (việc chưa xong, chưa khóa): nảy nhẹ, viền xanh nhạt, bóng mềm khi rê chuột. */
const clickable =
  'cursor-pointer hover:-translate-y-0.5 hover:border-sage/40 hover:shadow-[0_12px_28px_rgb(var(--shadow-rgb)/0.14)] focus-visible:-translate-y-0.5 focus-visible:border-sage/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage motion-reduce:transition-none motion-reduce:hover:translate-y-0'

interface TimelineCardProps {
  item: TimelineItem
  /** Đang trượt ra khỏi danh sách sau khi hoàn thành */
  leaving?: boolean
  /** Mở hộp "Xác nhận hoàn thành" (bấm thẻ, ô tick hoặc Enter) */
  onComplete: (item: TimelineItem) => void
  /** Đưa việc đã xong về Chưa xong (nút ↺) */
  onReopen: (item: TimelineItem) => void
  onEdit: (item: TimelineItem) => void
  onRemove: (item: TimelineItem) => void
  /** "Nhắn NCC" cho việc chi tiết đang chờ khách / cùng NCC chưa chốt lịch */
  onChat?: (item: TimelineItem) => void
  /** Việc con trong thẻ nhóm: nhỏ gọn hơn, thụt vào */
  nested?: boolean
  /** Cách xem THEO THỜI GIAN: việc con có thêm tên dịch vụ ở dòng hạn ("Hạn: d/m · Nhà hàng") */
  showService?: boolean
  /** Hạn dạng d/m (không năm): nhóm theo tháng đã có năm ở tiêu đề */
  compactDate?: boolean
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Thẻ một việc: ô tick tròn, tên, dòng hạn, và nút chỉ khi nghiệp vụ cần. */
export function TimelineCard({ item, leaving, nested, showService, onComplete, onReopen, onEdit, onRemove, onChat }: TimelineCardProps) {
  const due = parseDate(item.dueDate!)
  const done = item.isDone
  const overdue = !done && due < today()
  // Sắp đến hạn: còn 0 đến 2 ngày (cùng ngưỡng với thông báo của backend)
  const dueSoon = !done && !overdue && daysBetween(today(), due) <= DUE_SOON_DAYS
  // Mốc "Chốt" tự xong khi đặt cọc: không tick tay
  const autoDone = item.kind === 'CATEGORY_DEADLINE'
  // Việc chi tiết của đơn do NCC quản lý (mọi việc, kể cả việc của khách): khách chỉ xem, NCC cập nhật ở "Tiến độ đơn"
  const vendorOwned = item.kind === 'SERVICE_TASK'
  const waiting = vendorOwned && item.status === 'Waiting' && !done
  // Việc làm cùng NCC mà ngày mới là dự kiến: NCC sẽ hẹn lịch với khách
  const togetherUnconfirmed = vendorOwned && !done && !waiting && item.owner === 'BOTH' && item.dateStatus !== 'CONFIRMED'
  const canComplete = !done && !autoDone && !vendorOwned
  // Việc chi tiết của đơn đã xong: vẫn hiện đúng chỗ theo ngày, nhưng cả thẻ sang tông xám (không gạch ngang)
  const grayDone = done && vendorOwned
  // Nút "Gợi ý {dịch vụ}" theo cờ `suggest` của backend (việc Chọn NCC đầu tiên của dịch vụ; Mốc chốt Todo có đơn đã hủy). Việc đã tick xong vẫn giữ nút.
  const suggests = item.suggest && !!item.category
  const [suggesting, setSuggesting] = useState(false)
  const label = serviceLabel(item)
  const hintId = `hint-${item.id}`

  // Việc chi tiết của đơn: khách chỉ xem, không tick được nên không có vòng tròn bên trái.
  // Hàng 1: tên (trái) + tag trạng thái (phải) · Hàng 2: chip ngày (trái) + "Nhắn NCC" (phải) · Hàng 3: dòng phụ nhỏ (nếu có). Đã xong: cả thẻ xám mờ, không dòng phụ và nút.
  if (vendorOwned) {
    const askVendor = (waiting || togetherUnconfirmed) && !!onChat && !!item.serviceId
    const notes = done
      ? []
      : [
          togetherUnconfirmed && <span key="plan">NCC sẽ hẹn lịch với bạn</span>,
          showService && <span key="svc">{capitalize(serviceLabel(item))}</span>,
          dueSoon && (
            <span key="soon" className="font-semibold text-gold-ink">
              Sắp đến hạn
            </span>
          ),
          !done && item.urgent && (
            <span key="urgent" className="font-semibold text-warn">
              Gấp
            </span>
          ),
          item.isCustomOrderTask && (
            <span key="custom" className="rounded-pill border border-dashed border-gold-ink/50 px-2 py-0.5 text-[11.5px] leading-none font-medium text-gold-ink">
              NCC thêm
            </span>
          ),
        ].filter(Boolean)
    return (
      <div data-state={done ? 'done' : 'todo'} className={cn('rounded-[22px] border border-line bg-surface px-5 py-[16px] shadow-card max-[640px]:px-4', nested && 'rounded-2xl px-4 py-3 shadow-sm max-[640px]:px-3', done && 'border-line/70 bg-surface-2/60 opacity-60 shadow-none', leaving && !done && 'pointer-events-none -translate-x-6 scale-[0.98] opacity-0 duration-300')}>
        <div className="flex items-start justify-between gap-3">
          <div className={cn('min-w-0 flex-1 leading-snug font-semibold [overflow-wrap:anywhere]', nested ? 'text-[15.5px]' : 'text-[17px]', done && 'text-muted-foreground')}>
            <TaskTitle as="div" title={item.title} className="" noteClassName="text-[13px]" />
          </div>
          <StatusTag item={item} />
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-2" onClick={(e) => e.stopPropagation()}>
          <DateChip dueDate={item.dueDate!} confirmed={item.dateStatus === 'CONFIRMED'} overdue={overdue} isDone={done} />
          {askVendor && (
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => onChat!(item)}>
              Nhắn NCC
            </Button>
          )}
        </div>
        {notes.length > 0 && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted-foreground">{notes}</div>}
      </div>
    )
  }

  // Enter trên chính thẻ mở hộp xác nhận (Enter trên nút bên trong thẻ giữ nguyên việc của nút)
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (canComplete && e.key === 'Enter' && e.target === e.currentTarget) {
      e.preventDefault()
      onComplete(item)
    }
  }

  return (
    <div
      role={canComplete ? 'button' : undefined}
      tabIndex={canComplete || (autoDone && !done) ? 0 : undefined}
      aria-label={canComplete ? `Hoàn thành: ${item.title}` : undefined}
      aria-describedby={autoDone && !done ? hintId : undefined}
      data-state={done ? 'done' : 'todo'}
      onClick={canComplete ? () => onComplete(item) : undefined}
      onKeyDown={onKeyDown}
      className={cn(card, nested && 'rounded-2xl px-4 py-3 shadow-sm max-[640px]:px-3', grayDone && 'border-line/70 bg-surface-2/60 opacity-60 shadow-none', canComplete && clickable, leaving && !done && 'pointer-events-none -translate-x-6 scale-[0.98] opacity-0 duration-300')}
    >
      {done ? (
        <span aria-hidden className={cn('grid size-[26px] shrink-0 place-items-center rounded-full', grayDone ? 'bg-sage/25 text-sage' : 'bg-sage text-white')}>
          <Check className="size-4" strokeWidth={3} />
        </span>
      ) : (
        <span aria-hidden className={cn('grid size-[26px] shrink-0 place-items-center rounded-full border-2 bg-surface transition-colors', autoDone ? 'border-line' : 'border-line group-hover:border-sage')} />
      )}

      <div className="min-w-0 flex-1 basis-[220px]">
        <div className={cn(nested ? 'text-[15.5px]' : 'text-[17px]', 'leading-snug font-semibold', done && !autoDone && !grayDone && 'text-muted-foreground line-through', grayDone && 'text-muted-foreground', done && autoDone && 'text-sage')}>{vendorOwned ? <TaskTitle as="div" title={item.title} className="" noteClassName="text-[13px]" /> : item.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px] font-medium text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          <span className={cn(overdue && 'text-warn')}>Hạn {formatDate(item.dueDate!)}</span>
          {dueSoon && <span className="font-semibold text-gold-ink">· Sắp đến hạn</span>}
          {overdue && <span className="font-semibold text-warn">· Quá hạn</span>}
          {!done && item.urgent && <span className="font-semibold text-warn">· Gấp</span>}
        </div>
        {autoDone && done && (
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-sage">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
            Đã chốt{item.serviceName ? ` · ${item.serviceName}` : ''}
          </div>
        )}
        {/* Mốc chốt chưa cọc: gộp khối khóa vào ngay trong thẻ, không xổ ra */}
        {autoDone && !done && item.cancelledOrder && (
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] font-medium text-warn">
            <Ban className="size-3.5" aria-hidden />
            Đơn {item.cancelledOrder.orderCode} với {item.cancelledOrder.vendorName} đã hủy ngày {dm(item.cancelledOrder.date)}
          </div>
        )}
        {autoDone && !done && (
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            Các việc phục vụ của nhà cung cấp mở ra sau khi bạn đặt cọc
          </div>
        )}
        {autoDone && done && item.vendorProcessMissing && (
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Ban className="size-3.5" aria-hidden />
            Nhà cung cấp chưa khai quy trình công việc cho dịch vụ này
          </div>
        )}
        {autoDone && done && item.processSyncFailed && (
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            Đang cập nhật quy trình công việc của nhà cung cấp
          </div>
        )}
        {item.note && (
          <p className="mt-1.5 flex gap-1.5 text-[13px]">
            <MessageSquareText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span>{item.note}</span>
          </p>
        )}
      </div>

      {/* Bấm nút trong thẻ không mở hộp xác nhận */}
      <div className="flex flex-wrap items-center gap-2 max-[640px]:w-full max-[640px]:pl-[42px]" onClick={(e) => e.stopPropagation()}>
        {suggests && item.category && (
          <>
            {/* Popup 3 nhà cung cấp gợi ý ngay trên Timeline; "Xem thêm" mới sang trang Dịch vụ cưới */}
            <Button variant="secondary" size="sm" className="h-auto min-h-8 max-w-full whitespace-normal py-1.5" onClick={() => setSuggesting(true)}>
              <span className="min-w-0 whitespace-normal text-left leading-tight">{item.suggestLabel ?? `Gợi ý ${label}`} →</span>
            </Button>
            <SuggestionsDialog categorySlug={item.category.slug} categoryName={item.category.name} open={suggesting} onOpenChange={setSuggesting} />
          </>
        )}
        {!done && item.isCustom && (
          <span className="flex gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 max-md:opacity-100">
            <Button variant="outline" size="icon" className="size-8" aria-label={`Sửa ${item.title}`} onClick={() => onEdit(item)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="outline" size="icon" className="size-8" aria-label={`Xóa ${item.title}`} onClick={() => onRemove(item)}>
              <Trash2 className="size-3.5" />
            </Button>
          </span>
        )}
        {done && !autoDone && !vendorOwned && (
          <Button variant="outline" size="icon" className="size-8" aria-label={`Đưa về Chưa xong: ${item.title}`} title="Đưa về Chưa xong" onClick={() => onReopen(item)}>
            <RotateCcw className="size-3.5" />
          </Button>
        )}
      </div>

      {autoDone && !done && (
        <span
          id={hintId}
          role="tooltip"
          className="pointer-events-none absolute top-1/2 right-5 z-10 hidden -translate-y-1/2 rounded-md bg-ink px-3 py-1.5 text-xs text-bg shadow-card group-focus-visible:block group-hover:block"
        >
          Tự hoàn thành khi bạn đặt cọc cho nhà cung cấp
        </span>
      )}
    </div>
  )
}

import { Ban, CalendarDays, Check, Lock, Pencil, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { parseDate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { TimelineItem } from '@/types/wedding'

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

/** Câu nhắn soạn sẵn cho "Hẹn với NCC" (chưa tự gửi). Tên việc cắt tại dấu hai chấm hoặc ngoặc cho gọn. */
export function meetingDraft(item: TimelineItem) {
  const name = item.title.split(/:| \(/)[0].trim()
  const lower = name.charAt(0).toLowerCase() + name.slice(1)
  return `Chào shop, mình muốn hẹn lịch ${lower} trước ${dmy(item.dueDate!)}, bên mình tiện ngày nào ạ?`
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
  onMeet: (item: TimelineItem) => void
  /** Việc con trong thẻ nhóm: nhỏ gọn hơn, thụt vào */
  nested?: boolean
  /** Cách xem THEO THỜI GIAN: việc con có thêm tên dịch vụ ở dòng hạn ("Hạn: d/m · Nhà hàng") */
  showService?: boolean
  /** Hạn dạng d/m (không năm): nhóm theo tháng đã có năm ở tiêu đề */
  compactDate?: boolean
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Thẻ một việc: ô tick tròn, tên, dòng hạn, và nút chỉ khi nghiệp vụ cần. */
export function TimelineCard({ item, leaving, nested, showService, compactDate, onComplete, onReopen, onEdit, onRemove, onMeet }: TimelineCardProps) {
  const due = parseDate(item.dueDate!)
  const done = item.isDone
  const overdue = !done && due < today()
  // Mốc "Chốt" tự xong khi đặt cọc: không tick tay
  const autoDone = item.kind === 'CATEGORY_DEADLINE'
  const canComplete = !done && !autoDone
  // Nút "Gợi ý {dịch vụ}" theo cờ `suggest` của backend (việc Chọn NCC đầu tiên của dịch vụ; Mốc chốt Todo có đơn đã hủy). Việc đã tick xong vẫn giữ nút.
  const suggests = item.suggest && !!item.category
  const label = serviceLabel(item)
  const hintId = `hint-${item.id}`

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
      className={cn(card, nested && 'rounded-2xl px-4 py-3 shadow-sm max-[640px]:px-3', canComplete && clickable, leaving && !done && 'pointer-events-none -translate-x-6 scale-[0.98] opacity-0 duration-300')}
    >
      {done ? (
        <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-sage text-white">
          <Check className="size-4" strokeWidth={3} />
        </span>
      ) : (
        <span aria-hidden className={cn('grid size-[26px] shrink-0 place-items-center rounded-full border-2 bg-surface transition-colors', autoDone ? 'border-line' : 'border-line group-hover:border-sage')} />
      )}

      <div className="min-w-0 flex-1 basis-[220px]">
        <div className={cn(nested ? 'text-[15.5px]' : 'text-[17px]', 'leading-snug font-semibold', done && !autoDone && 'text-muted-foreground line-through', done && autoDone && 'text-sage')}>{item.title}</div>
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[12.5px] font-medium text-muted-foreground">
          <CalendarDays className="size-3.5" aria-hidden />
          <span className={cn(overdue && 'text-warn')}>Hạn: {compactDate ? dm(item.dueDate!) : dmy(item.dueDate!)}</span>
          {showService && item.kind === 'SERVICE_TASK' && <span>· {capitalize(serviceLabel(item))}</span>}
          {!done && item.appointmentDate && <span>· Đã hẹn {dm(item.appointmentDate)}</span>}
          {!done && item.urgent && <span className="font-semibold text-warn">· Gấp</span>}
          {!done && item.tentative && <span>· Tạm tính</span>}
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
        {autoDone && !done && item.detailCount > 0 && (
          <div className="mt-1 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
            <Lock className="size-3.5" aria-hidden />
            {item.detailCount} việc chi tiết mở sau khi bạn đặt cọc
          </div>
        )}
      </div>

      {/* Bấm nút trong thẻ không mở hộp xác nhận */}
      <div className="flex flex-wrap items-center gap-2 max-[640px]:w-full max-[640px]:pl-[42px]" onClick={(e) => e.stopPropagation()}>
        {suggests && item.category && (
          <Button asChild variant="secondary" size="sm">
            <Link to={`${paths.services}?category=${item.category.slug}`}>
              <Sparkles className="size-[15px]" />
              Gợi ý {label} →
            </Link>
          </Button>
        )}
        {!done && item.kind === 'SERVICE_TASK' && item.needsMeeting && item.serviceId && (
          <Button variant="outline" size="sm" onClick={() => onMeet(item)}>
            Hẹn với NCC
          </Button>
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
        {done && !autoDone && (
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

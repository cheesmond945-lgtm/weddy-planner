import { Check, Flag, Lock, Pencil, Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { daysBetween, formatDate, formatShortDate, parseDate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { TimelineItem } from '@/types/wedding'

interface TimelineRowProps {
  item: TimelineItem
  onToggle: (item: TimelineItem) => void
  onEdit: (item: TimelineItem) => void
  onAiSuggest: (categorySlug: string) => void
  onOpenChat: (serviceId: string) => void
}

const rowBase = 'flex items-start gap-3.5 border-t border-line px-4 py-3.5 first:border-t-0'

/** Hàng "Ngày đám cưới" ở cuối danh sách. */
export function WeddingDayRow({ date }: { date: string }) {
  return (
    <div className={rowBase}>
      <Flag className="mt-px size-5 shrink-0 text-gold-700" aria-hidden />
      <div className="min-w-0 flex-1 font-medium">Ngày đám cưới</div>
      <div className="text-[13px] whitespace-nowrap text-muted-foreground">{formatDate(date)}</div>
    </div>
  )
}

/** Một mốc trên timeline (rowHtml trong prototype). */
export function TimelineRow({ item, onToggle, onEdit, onAiSuggest, onOpenChat }: TimelineRowProps) {
  if (item.kind === 'SERVICE_DATE') {
    return (
      <div className={rowBase}>
        <Flag className="mt-px size-5 shrink-0 text-gold-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{item.title}</div>
          <div className="text-[13px] text-muted-foreground">Ngày đã thống nhất với nhà cung cấp</div>
        </div>
        <div className="text-[13px] whitespace-nowrap text-muted-foreground">{formatDate(item.dueDate!)}</div>
      </div>
    )
  }

  if (item.kind === 'LOCKED') {
    return (
      <div className={cn(rowBase, 'bg-[color-mix(in_srgb,var(--line)_35%,var(--surface))]')}>
        <Lock className="mt-px size-[18px] shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="font-medium">{item.title}</div>
          <div className="text-[13px] text-muted-foreground">Mở sau khi bạn đặt cọc cho nhà cung cấp.</div>
        </div>
      </div>
    )
  }

  const due = parseDate(item.dueDate!)
  const over = !item.isDone && due < today()
  const soon = !item.isDone && !over && daysBetween(today(), due) <= 7
  const dueLabel = item.isDone ? 'Đã xong' : `${over ? 'Quá hạn' : 'Hạn'} ${formatShortDate(item.dueDate!)}`

  let mark: ReactNode
  let extra: ReactNode = null
  if (item.kind === 'CATEGORY_DEADLINE') {
    mark = (
      <span
        role="img"
        aria-label={item.isDone ? 'Đã chốt' : 'Chưa chốt'}
        className={cn('mt-px grid size-5 shrink-0 place-items-center rounded-full border-2', item.isDone ? 'border-sage bg-sage text-white' : 'border-line')}
      >
        {item.isDone && <Check className="size-[13px]" strokeWidth={3} />}
      </span>
    )
    const slug = item.category!.slug
    extra = item.isDone ? (
      <div className="text-[13px] text-muted-foreground">Đã chốt {item.serviceName}. Việc chi tiết nằm trong danh sách bên dưới.</div>
    ) : (
      <>
        <div className="text-[13px] text-muted-foreground">{item.serviceName ? `Đang cân nhắc ${item.serviceName}` : 'Chưa chọn nhà cung cấp'}</div>
        <div className="mt-[9px] flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onAiSuggest(slug)}>
            <Sparkles className="size-[15px]" />
            Gợi ý bằng AI
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to={`${paths.services}?category=${slug}`}>Xem dịch vụ</Link>
          </Button>
          {item.serviceId && (
            <Button variant="outline" size="sm" onClick={() => onOpenChat(item.serviceId!)}>
              Nhắn tin
            </Button>
          )}
        </div>
      </>
    )
  } else {
    mark = (
      <input
        type="checkbox"
        checked={item.isDone}
        onChange={() => onToggle(item)}
        aria-label={item.title}
        className="mt-px size-5 shrink-0 cursor-pointer accent-sage"
      />
    )
    if (item.kind === 'SERVICE_TASK') extra = <div className="text-[13px] text-muted-foreground">{item.serviceName}</div>
  }

  return (
    <div className={rowBase}>
      {mark}
      <div className="min-w-0 flex-1">
        <div className={cn('font-medium', item.isDone && item.kind !== 'CATEGORY_DEADLINE' && 'text-muted-foreground line-through')}>{item.title}</div>
        {extra}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={cn('text-right text-[13px] whitespace-nowrap text-muted-foreground', soon && 'font-semibold text-gold', over && 'font-semibold text-warn')}>
          {dueLabel}
        </span>
        <Button variant="outline" size="icon" className="size-8" aria-label={`Sửa ${item.title}`} onClick={() => onEdit(item)}>
          <Pencil className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

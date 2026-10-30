import { Check, ChevronDown } from 'lucide-react'
import type { KeyboardEvent } from 'react'
import { parseDate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TimelineItem } from '@/types/wedding'
import { TimelineCard, dm, dmy } from './TimelineRow'

interface Handlers {
  onComplete: (item: TimelineItem) => void
  onReopen: (item: TimelineItem) => void
  onEdit: (item: TimelineItem) => void
  onRemove: (item: TimelineItem) => void
  onMeet: (item: TimelineItem) => void
}

interface GroupProps extends Handlers {
  /** Mốc chốt của dịch vụ (đã cọc) */
  book: TimelineItem
  /** Mọi việc chi tiết của dịch vụ, sắp theo hạn */
  kids: TimelineItem[]
  /** Các việc con đang hiện theo tab (Chưa xong / Đã xong / Tất cả) */
  visibleKids: TimelineItem[]
  open: boolean
  onToggle: () => void
  leaving: ReadonlySet<string>
}

/** "Chốt nhà hàng: so sánh, ..." -> "Chốt nhà hàng" */
const shortTitle = (title: string) => title.split(':')[0].trim()

/** Nhóm đã cọc có việc con quá hạn hoặc hạn trong 14 ngày tới thì mở sẵn. */
export function defaultOpen(kids: TimelineItem[]) {
  const limit = new Date(today())
  limit.setDate(limit.getDate() + 14)
  return kids.some((k) => !k.isDone && k.dueDate && parseDate(k.dueDate) <= limit)
}

/**
 * Thẻ nhóm của Mốc chốt đã cọc: ✓ đã chốt, tên NCC + mã đơn, tiến độ "Đã xong x/N việc", mũi tên. Bấm thẻ (hoặc mũi tên, Enter, Space)
 * xổ / thu danh sách việc con, không mở hộp hoàn thành. Thu gọn thì hiện việc kế tiếp; có việc con quá hạn thì chấm đỏ.
 */
export function TimelineGroupCard({ book, kids, visibleKids, open, onToggle, leaving, ...handlers }: GroupProps) {
  const total = kids.length
  const doneCount = kids.filter((k) => k.isDone).length
  const next = kids.find((k) => !k.isDone)
  const overdue = kids.some((k) => !k.isDone && k.dueDate && parseDate(k.dueDate) < today())
  // Đơn đang giữ nhiều việc con nhất (việc đã xong của đơn cũ có thể còn sót lại trong nhóm)
  const byOrder = new Map<string, TimelineItem[]>()
  for (const k of kids) if (k.orderCode) byOrder.set(k.orderCode, [...(byOrder.get(k.orderCode) ?? []), k])
  const owner = [...byOrder.values()].sort((x, y) => y.length - x.length)[0]
  const vendor = owner?.[0].serviceName ?? kids[0]?.serviceName ?? book.serviceName
  const orderCode = owner?.[0].orderCode
  // Đơn giữ nhóm này có ngày thực hiện sau ngày cưới (đơn cũ hoặc khách đã đổi ngày cưới): các hạn bên dưới tính theo ngày đó
  const conflict = owner?.find((k) => k.dateConflict && k.orderEventDate)
  const panelId = `group-${book.id}`

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) {
      e.preventDefault()
      onToggle()
    }
  }

  return (
    <section aria-label={shortTitle(book.title)}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        data-state="group"
        className="group relative flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-2 rounded-[22px] border border-line bg-[color-mix(in_srgb,var(--sage-soft)_45%,var(--surface))] px-5 py-[18px] shadow-card transition-all duration-150 ease-out hover:-translate-y-0.5 hover:border-sage/40 hover:shadow-[0_12px_28px_rgb(var(--shadow-rgb)/0.14)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage motion-reduce:transition-none motion-reduce:hover:translate-y-0 max-[640px]:px-4"
      >
        <span aria-hidden className="grid size-[26px] shrink-0 place-items-center rounded-full bg-sage text-white">
          <Check className="size-4" strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1 basis-[220px]">
          <div className="flex flex-wrap items-baseline gap-x-2 text-[17px] leading-snug font-semibold text-sage">
            {shortTitle(book.title)}
            <span className="text-[12px] font-semibold tracking-[0.06em] uppercase">Đã chốt</span>
          </div>
          {(vendor || orderCode) && <div className="mt-0.5 text-[13px] text-muted-foreground">{[vendor, orderCode].filter(Boolean).join(' · ')}</div>}
          {conflict && (
            <div role="note" className="mt-1 text-[12.5px] text-warn">
              Ngày thực hiện của đơn ({dmy(conflict.orderEventDate!)}) sau ngày cưới. Nhắn nhà cung cấp để cập nhật đơn.
            </div>
          )}
          <div className="mt-2 flex items-center gap-2.5">
            <div className="h-1.5 w-full max-w-[220px] overflow-hidden rounded-[9px] bg-line" aria-hidden>
              <i className="block h-full bg-sage transition-[width] duration-300" style={{ width: `${total ? Math.round((doneCount / total) * 100) : 0}%` }} />
            </div>
            <span className="text-[12.5px] font-medium whitespace-nowrap text-muted-foreground">
              Đã xong {doneCount}/{total} việc
            </span>
          </div>
          {!open && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              {overdue && <span aria-label="Có việc quá hạn" role="img" className="size-2 shrink-0 rounded-full bg-warn" />}
              {next ? (
                <span>
                  Tiếp theo: <b className="font-semibold text-ink">{next.title}</b> · Hạn {dm(next.dueDate!)}
                </span>
              ) : (
                <span>{total ? 'Tất cả việc chi tiết đã xong' : 'Chưa có việc chi tiết'}</span>
              )}
            </div>
          )}
        </div>
        <ChevronDown className={cn('size-5 shrink-0 text-muted-foreground transition-transform duration-300', open && 'rotate-180')} aria-hidden />
      </div>

      {/* Xổ / thu mượt bằng chiều cao dòng lưới 0fr -> 1fr */}
      <div id={panelId} className={cn('grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none', open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
        <div className="min-h-0 overflow-hidden" inert={!open}>
          <ul className="mt-3 ml-[13px] flex flex-col gap-2.5 border-l-2 border-[color-mix(in_srgb,var(--sage)_30%,transparent)] pl-5 max-[640px]:ml-[9px] max-[640px]:pl-3">
            {visibleKids.map((k) => (
              <li key={k.id}>
                <TimelineCard item={k} nested leaving={leaving.has(k.id)} {...handlers} />
              </li>
            ))}
            {visibleKids.length === 0 && <li className="py-2 text-[13px] text-muted-foreground">Không có việc nào ở mục này.</li>}
          </ul>
        </div>
      </div>
    </section>
  )
}

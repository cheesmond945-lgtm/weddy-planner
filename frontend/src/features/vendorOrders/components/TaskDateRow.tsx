import { CalendarDays, Check, Pencil } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { formatDate } from '@/lib/date'
import { TASK_LABELS, dateLabel } from '@/lib/taskLabels'
import { cn } from '@/lib/utils'
import { DatePickPopover } from './DatePickPopover'

interface DateChipProps {
  dueDate: string
  confirmed: boolean
  /** Chưa xong và quá hạn */
  overdue: boolean
  isDone: boolean
}

/**
 * Nhãn ngày (chip bo tròn cao 26px, chữ 13px, icon lịch bên trái), KHÔNG bấm được:
 *   Dự kiến: viền nét đứt nâu nhạt, chữ nâu · Đã chốt: nền xanh lá rất nhạt, viền xanh nhạt, chữ xanh đậm, icon ✓ ·
 *   Quá hạn (chưa xong): chữ và viền đỏ nhạt · Đã xong: chip xám "Hạn dd/mm/yyyy".
 */
export function DateChip({ dueDate, confirmed, overdue, isDone }: DateChipProps) {
  const date = formatDate(dueDate)
  const { text, tone, Icon } = isDone
    ? { text: `Hạn ${date}`, tone: 'border-line bg-surface-2 text-muted-foreground', Icon: CalendarDays }
    : overdue
      ? { text: `Quá hạn · ${date}`, tone: 'border-warn/40 bg-transparent text-warn', Icon: CalendarDays }
      : confirmed
        ? { text: dateLabel(true, date), tone: 'border-sage/40 bg-sage-soft text-sage', Icon: Check }
        : { text: dateLabel(false, date), tone: 'border-dashed border-gold-ink/50 bg-transparent text-gold-ink', Icon: CalendarDays }
  return (
    <span className={cn('inline-flex h-[26px] items-center gap-1.5 rounded-pill border px-2.5 text-[13px] leading-none font-medium whitespace-nowrap', tone)}>
      <Icon className="size-3.5 shrink-0" strokeWidth={confirmed && !isDone && !overdue ? 3 : 2} aria-hidden />
      {text}
    </span>
  )
}

interface TaskDateRowProps extends DateChipProps {
  /** Ngày thực hiện của đơn (giới hạn trên của lịch chọn ngày: ngày này + 120; hiện chấm nhỏ); rỗng nếu không biết */
  eventDate: string
  /** Chỉ xem (đơn đã hoàn tất, hoặc không được sửa): chỉ có chip */
  readOnly?: boolean
  /** Đang xử lý việc này: khóa các nút */
  busy?: boolean
  /** Bấm một ngày trong lịch = đổi và chốt luôn */
  onPickDate: (date: string) => void
  onConfirm: () => void
  onUnconfirm: () => void
}

const ghost =
  'inline-flex h-[26px] items-center gap-1 rounded-sm px-2 text-[13px] leading-none font-medium text-gold-ink transition-colors hover:bg-gold-soft focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent'

/**
 * Hàng ngày dưới cùng của thẻ việc: bên trái là chip ngày (không bấm được); bên phải, cùng hàng, các nút ghost nhỏ:
 * "✓ Chốt" (chỉ khi Dự kiến), "✎ Đổi ngày" (khi chưa xong; mở thẳng lịch dựng sẵn), "Bỏ chốt" (chữ xám, khi đã chốt).
 * Thẻ hẹp thì nút tự xuống dòng gọn, không chồng chữ. "Chốt" đổi chip ngay (lạc quan), không mở popup.
 */
export function TaskDateRow({ dueDate, confirmed, overdue, isDone, eventDate, readOnly, busy, onPickDate, onConfirm, onUnconfirm }: TaskDateRowProps) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const close = useCallback(() => setOpen(false), [])
  const editable = !isDone && !readOnly

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
      <DateChip dueDate={dueDate} confirmed={confirmed} overdue={overdue} isDone={isDone} />
      {editable && (
        <span className="ml-auto flex shrink-0 items-center justify-end gap-2">
          {confirmed ? (
            <button type="button" disabled={busy} onClick={onUnconfirm} className="inline-flex h-[26px] items-center rounded-sm px-2 text-[13px] leading-none text-muted-foreground transition-colors hover:bg-surface-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-50">
              {TASK_LABELS.unconfirmDate}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={onConfirm} className={ghost}>
              <Check className="size-3.5" strokeWidth={2.5} aria-hidden />
              {TASK_LABELS.confirmDate}
            </button>
          )}
          <button ref={btnRef} type="button" disabled={busy} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={cn(ghost, open && 'bg-gold-soft')}>
            <Pencil className="size-3.5" aria-hidden />
            Đổi ngày
          </button>
        </span>
      )}
      {open && (
        <DatePickPopover
          anchor={btnRef}
          value={dueDate}
          eventDate={eventDate}
          onClose={close}
          onPick={(date) => {
            setOpen(false)
            onPickDate(date)
          }}
        />
      )}
    </div>
  )
}

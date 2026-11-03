import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject, type SyntheticEvent } from 'react'
import { createPortal } from 'react-dom'
import { monthOf, monthTitle, shiftMonth, WEEKDAYS } from '@/features/calendar/monthGrid'
import { addDays, formatDate, parseDate, toISODate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { canGoNext, canGoPrev, pickerDays, placePopover } from '../datePicker'
import { SCHEDULE_MAX_AFTER_EVENT } from '../taskBoard'

const WIDTH = 280

/*
 * Vì sao phải có pointerEvents: 'auto': hộp thoại Radix (Dialog modal) đặt `body { pointer-events: none }` và chỉ bật lại cho chính nội dung hộp thoại.
 * Popover này portal ra document.body (để không bị vùng cuộn / overflow của hộp thoại cắt) nên thừa hưởng "none": mọi cú bấm xuyên qua, ngày không chọn được.
 * Bấm trong popover vẫn tính là "bên trong" hộp thoại vì portal giữ nguyên cây React, nên Radix không đóng hộp thoại.
 */

/** Chặn sự kiện nổi lên thẻ / vùng kéo chứa nó (portal cũng nổi lên theo cây React). */
const stop = (e: SyntheticEvent) => e.stopPropagation()

interface DatePickPopoverProps {
  /** Nút mở popover: popover bám theo nút này và bấm vào nút này không tính là "bấm ra ngoài" */
  anchor: RefObject<HTMLElement | null>
  /** Ngày hiện tại của việc "YYYY-MM-DD" */
  value: string
  /** Ngày thực hiện của đơn; ngày muộn nhất chọn được = ngày này + 120 */
  eventDate: string
  /** Bấm một ngày = đổi ngày và chốt luôn (nơi gọi đóng popover và cập nhật lạc quan) */
  onPick: (date: string) => void
  onClose: () => void
  /** true (mặc định): bấm một ngày chỉ CHỌN, chân lịch hỏi "Đổi sang dd/mm/yyyy và báo khách?" rồi mới gọi onPick khi Xác nhận. false: bấm ngày là gọi onPick ngay. */
  confirmStep?: boolean
}

/**
 * Lịch chọn ngày dựng sẵn (không dùng ô ngày của trình duyệt): tiếng Việt, tuần bắt đầu thứ Hai, "Tháng 5/2027" kèm ‹ ›, màu theo theme.
 * Ngày hiện tại của việc tô đặc, hôm nay có viền, ngày thực hiện của đơn có chấm nhỏ; trước hôm nay và sau ngày thực hiện + 120 bị mờ.
 * Rộng 280px, tự lật lên / xuống, đóng khi bấm ra ngoài hoặc Esc.
 */
export function DatePickPopover({ anchor, value, eventDate, onPick, onClose, confirmStep = true }: DatePickPopoverProps) {
  const [chosen, setChosen] = useState<string | null>(null)
  const now = toISODate(today())
  const min = now
  const max = eventDate ? toISODate(addDays(parseDate(eventDate), SCHEDULE_MAX_AFTER_EVENT)) : undefined
  const [month, setMonth] = useState(monthOf(value < min ? min : value))
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const days = useMemo(() => pickerDays(month, { value, today: now, eventDate, min, max }), [month, value, now, eventDate, min, max])

  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current?.getBoundingClientRect()
      if (!a) return
      setPos(placePopover(a, { width: window.innerWidth, height: window.innerHeight }, { width: WIDTH, height: panelRef.current?.offsetHeight ?? 340 }))
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [anchor, month])

  useEffect(() => {
    // Bắt ở window (pha capture) để chạy TRƯỚC hộp thoại Radix chứa nút này: Esc / bấm ra ngoài chỉ đóng lịch, hộp thoại giữ nguyên
    const inDialog = !!anchor.current?.closest('[role="dialog"]')
    const outside = (e: Event) => !panelRef.current?.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)
    const onDown = (e: PointerEvent) => {
      if (!outside(e)) return
      if (inDialog) e.stopPropagation()
      onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    panelRef.current?.querySelector<HTMLElement>('[data-selected="true"]')?.focus()
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [anchor, onClose])

  const nav = 'grid size-8 place-items-center rounded-sm text-ink hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-gold'

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Chọn ngày"
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: WIDTH, pointerEvents: 'auto' }}
      onPointerDown={stop}
      onKeyDown={stop}
      onClick={stop}
      className="fixed z-[500] rounded-lg border border-line bg-surface p-3.5 shadow-portal-lift animate-in fade-in zoom-in-95"
    >
      <div className="mb-2 flex items-center justify-between">
        <button type="button" aria-label="Tháng trước" className={nav} disabled={!canGoPrev(month, min)} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
          <ChevronLeft className="size-4" />
        </button>
        <span className="font-sans text-[14px] font-semibold">{monthTitle(month)}</span>
        <button type="button" aria-label="Tháng sau" className={nav} disabled={!canGoNext(month, max)} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-semibold tracking-wide text-muted-foreground">
        {WEEKDAYS.map((w) => (
          <span key={w} className="py-1">
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            disabled={d.disabled}
            data-selected={d.selected}
            aria-label={`${formatDate(d.date)}${d.isEvent ? ', ngày thực hiện của đơn' : ''}${d.isToday ? ', hôm nay' : ''}`}
            aria-pressed={d.selected}
            title={d.isEvent ? 'Ngày thực hiện của đơn' : d.disabled ? (d.date < min ? 'Đã qua' : 'Quá xa ngày thực hiện') : undefined}
            onClick={() => (confirmStep ? setChosen(d.date) : onPick(d.date))}
            className={cn(
              'relative mx-auto grid size-9 place-items-center rounded-full text-[13px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-gold',
              d.inMonth ? 'text-ink' : 'text-muted-foreground',
              d.selected ? 'bg-gold font-semibold text-white hover:bg-gold' : !d.disabled && 'hover:bg-gold-soft',
              d.isToday && !d.selected && 'border border-gold-ink/60',
              chosen === d.date && !d.selected && 'bg-gold-soft ring-2 ring-gold',
              d.disabled && 'cursor-not-allowed opacity-30',
            )}
          >
            {d.day}
            {d.isEvent && <span aria-hidden className={cn('absolute bottom-1 size-1 rounded-full', d.selected ? 'bg-white' : 'bg-gold-ink')} />}
          </button>
        ))}
      </div>
      {chosen && (
        <div className="mt-2 border-t border-line pt-2" role="group" aria-label="Xác nhận đổi ngày">
          <p className="text-[13px] font-medium">Đổi sang {formatDate(chosen)} và báo khách?</p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setChosen(null)} className="h-8 rounded-sm border border-line-strong px-3 text-[13px] font-medium hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-gold">
              Hủy
            </button>
            <button type="button" autoFocus onClick={() => onPick(chosen)} className="h-8 rounded-sm bg-gold px-3 text-[13px] font-semibold text-white hover:bg-gold-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold">
              Xác nhận
            </button>
          </div>
        </div>
      )}
      {!chosen && (
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-2 text-[11.5px] text-muted-foreground">
        <span>{confirmStep ? 'Chọn ngày mới, rồi xác nhận' : 'Bấm một ngày để chọn'}</span>
        {eventDate && (
          <span className="inline-flex items-center gap-1">
            <i aria-hidden className="size-1.5 rounded-full bg-gold-ink" />
            Ngày thực hiện
          </span>
        )}
      </p>
      )}
    </div>,
    document.body,
  )
}

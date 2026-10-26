import { Clock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { isMock } from '@/api'
import { useAdvanceTime } from '@/features/vendorChat/hooks'
import { clockOffsetHours } from '@/lib/clock'
import { cn } from '@/lib/utils'

const STEPS = [
  { label: 'Tua 1 giờ', hours: 1 },
  { label: 'Tua 6 giờ', hours: 6 },
  { label: 'Tua 1 ngày', hours: 24 },
  { label: 'Tua 8 ngày', hours: 24 * 8 },
]

/** CHỈ CÓ KHI DÙNG DỮ LIỆU GIẢ: nút nhỏ "giả lập thời gian" để thử đơn hết hạn cọc, tự hoàn thành. */
export function TimeTravelMenu() {
  const advance = useAdvanceTime()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!isMock('orders')) return null
  const shift = clockOffsetHours()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Giả lập thời gian (chỉ có khi dùng dữ liệu giả)"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-pill border border-dashed border-info/50 bg-info-soft px-3 text-[12.5px] text-info"
      >
        <Clock className="size-3.5" />
        <span className="max-sm:hidden">Giả lập thời gian</span>
        {shift > 0 && <b className="font-semibold">+{shift >= 48 ? `${Math.round(shift / 24)} ngày` : `${shift} giờ`}</b>}
      </button>
      {open && (
        <div role="menu" className="absolute top-[calc(100%+4px)] right-0 z-30 grid w-[210px] gap-0.5 rounded-lg border border-line bg-surface p-1.5 shadow-portal-lift">
          <p className="px-2.5 pt-1 pb-1.5 text-[11.5px] text-muted-foreground">Tua đồng hồ để thử hết hạn cọc, tự hoàn thành</p>
          {STEPS.map(({ label, hours }) => (
            <button key={label} type="button" role="menuitem" onClick={() => advance(hours)} className="rounded-sm px-2.5 py-2 text-left text-[13px] hover:bg-info-soft hover:text-info">
              {label}
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            disabled={shift === 0}
            onClick={() => advance(0)}
            className={cn('rounded-sm px-2.5 py-2 text-left text-[13px]', shift === 0 ? 'cursor-not-allowed opacity-45' : 'hover:bg-info-soft hover:text-info')}
          >
            Về giờ thật
          </button>
        </div>
      )}
    </div>
  )
}

import { useId, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DonutSlice {
  key: string
  label: ReactNode
  value: number
  /** Màu (biến CSS), ví dụ "var(--c1)" */
  color: string
  /** Chữ phụ ở chú thích, ví dụ số tiền */
  note?: ReactNode
  /** Đánh dấu lát vượt (chú thích ghi "vượt") */
  warn?: boolean
}

interface DonutProps {
  slices: DonutSlice[]
  /** Giữa vòng khi không rê chuột (ví dụ tổng); rê vào một lát thì giữa vòng hiện lát đó */
  center?: ReactNode
  label: string
  size?: number
  /** Dòng phụ trong khung số liệu khi rê chuột, ví dụ "12% tổng ngân sách" */
  detail?: (slice: DonutSlice) => ReactNode
}

const R = 15.915 // chu vi 100 để dùng phần trăm làm độ dài nét
/** Khe nền giữa các lát (đơn vị chu vi 100), để các lát cạnh nhau tách bạch cả khi màu gần nhau */
const GAP = 0.6
const pctText = (p: number) => `${p < 10 ? p.toFixed(1).replace('.', ',') : Math.round(p)}%`

/**
 * Biểu đồ tròn rỗng giữa bằng SVG (không dùng thư viện), kèm chú thích có tên, số và tỉ lệ.
 * Rê chuột / focus vào một lát hoặc một dòng chú thích: lát đó nổi lên, các lát khác mờ đi, giữa vòng và khung nổi cạnh con trỏ hiện số liệu.
 */
export function Donut({ slices, center, label, size = 150, detail }: DonutProps) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0)
  const shown = slices.filter((s) => s.value > 0)
  const [active, setActive] = useState<string | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const tipId = useId()
  const cur = shown.find((s) => s.key === active) ?? null
  const share = (s: DonutSlice) => (total ? (Math.max(0, s.value) / total) * 100 : 0)
  const gap = shown.length > 1 ? GAP : 0

  const track = (e: PointerEvent) => {
    const r = box.current?.getBoundingClientRect()
    if (r) setPos({ x: e.clientX - r.left, y: e.clientY - r.top })
  }
  const leave = () => {
    setActive(null)
    setPos(null)
  }

  let offset = 25 // bắt đầu từ đỉnh
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-4">
      <div ref={box} className="relative flex-none" style={{ width: size, height: size }} onPointerLeave={leave}>
        <svg viewBox="0 0 42 42" role="img" aria-label={label} className="size-full overflow-visible">
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--line)" strokeWidth="6" />
          {total > 0 &&
            shown.map((s) => {
              const pct = share(s)
              const len = Math.max(0.01, pct - gap)
              const el = (
                <circle
                  key={s.key}
                  cx="21"
                  cy="21"
                  r={R}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={active === s.key ? 7.5 : 6}
                  strokeDasharray={`${len} ${100 - len}`}
                  strokeDashoffset={offset - gap / 2}
                  className={cn('cursor-pointer transition-[opacity,stroke-width] duration-150', active && active !== s.key && 'opacity-35')}
                  onPointerEnter={() => setActive(s.key)}
                  onPointerMove={track}
                />
              )
              offset -= pct
              return el
            })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-[18%] text-center text-[13px] leading-tight">
          {cur ? (
            <span>
              <b className="block font-serif text-[22px] leading-tight">{pctText(share(cur))}</b>
              <span className="line-clamp-2 text-muted-foreground">{cur.label}</span>
            </span>
          ) : (
            center
          )}
        </div>
        {/* Khung số liệu cạnh con trỏ (chỉ khi rê chuột lên lát) */}
        {cur && pos && (
          <div
            id={tipId}
            role="tooltip"
            className="pointer-events-none absolute z-10 w-max max-w-[240px] rounded-md border border-line bg-surface px-3 py-2 text-[13px] shadow-card"
            style={{ left: pos.x + 14, top: pos.y + 14 }}
          >
            <div className="flex items-center gap-2 font-semibold text-ink">
              <i className="size-2.5 flex-none rounded-full" style={{ background: cur.color }} aria-hidden />
              {cur.label}
            </div>
            <div className="mt-0.5 font-semibold text-ink tabular-nums">{cur.note ?? cur.value}</div>
            <div className="text-muted-foreground">{pctText(share(cur))} tổng chi phí dự kiến</div>
            {detail && <div className="text-muted-foreground">{detail(cur)}</div>}
            {cur.warn && <div className="font-semibold text-warn">Vượt ngân sách hạng mục</div>}
          </div>
        )}
      </div>

      <ul className="flex min-w-[220px] max-w-[340px] flex-1 flex-col text-[13.5px]" onPointerLeave={leave}>
        {slices.map((s) => (
          <li key={s.key}>
            <button
              type="button"
              aria-describedby={active === s.key && pos ? tipId : undefined}
              onPointerEnter={() => setActive(s.key)}
              onFocus={() => setActive(s.key)}
              onBlur={() => setActive(null)}
              className={cn(
                'grid w-full grid-cols-[auto_minmax(0,1fr)_auto_3.2rem] items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors',
                active === s.key ? 'bg-surface-2' : 'hover:bg-surface-2/60',
                active && active !== s.key && 'opacity-60',
              )}
            >
              <i className="size-2.5 flex-none rounded-full" style={{ background: s.color }} aria-hidden />
              <span className="truncate">
                {s.label}
                {s.warn && <span className="ml-1 font-semibold text-warn">vượt</span>}
              </span>
              <span className={cn('font-medium tabular-nums', s.warn && 'text-warn')}>{s.note ?? s.value}</span>
              <span className="text-right text-muted-foreground tabular-nums">{pctText(share(s))}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

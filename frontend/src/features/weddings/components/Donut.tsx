import type { ReactNode } from 'react'
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

/** Biểu đồ tròn rỗng giữa bằng SVG (như prototype, không dùng thư viện), kèm chú thích. */
export function Donut({ slices, center, label, size = 150 }: { slices: DonutSlice[]; center?: ReactNode; label: string; size?: number }) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0)
  const r = 15.915 // chu vi 100 để dùng phần trăm làm độ dài nét
  let offset = 25 // bắt đầu từ đỉnh
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative flex-none" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" role="img" aria-label={label} className="size-full">
          <circle cx="21" cy="21" r={r} fill="none" stroke="var(--line)" strokeWidth="6" />
          {total > 0 &&
            slices
              .filter((s) => s.value > 0)
              .map((s) => {
                const pct = (s.value / total) * 100
                const el = <circle key={s.key} cx="21" cy="21" r={r} fill="none" stroke={s.color} strokeWidth="6" strokeDasharray={`${pct} ${100 - pct}`} strokeDashoffset={offset} />
                offset -= pct
                return el
              })}
        </svg>
        {center && <div className="absolute inset-0 grid place-items-center text-center text-[13px] leading-tight">{center}</div>}
      </div>
      <ul className="flex min-w-[160px] flex-1 flex-col gap-1.5 text-[13px]">
        {slices.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <i className="size-2.5 flex-none rounded-full" style={{ background: s.color }} aria-hidden />
            <span className="flex-1">
              {s.label}
              {s.warn && <span className="ml-1 font-semibold text-warn">vượt</span>}
            </span>
            <span className={cn('font-medium', s.warn && 'text-warn')}>{s.note ?? s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export const CHART_COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)']

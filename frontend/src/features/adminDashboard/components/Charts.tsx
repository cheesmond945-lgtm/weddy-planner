import { useRef, useState, type MouseEvent } from 'react'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { AdminDashboard } from '@/types/admin'

/**
 * Khung số liệu hiện ngay khi rê chuột vào một phần của biểu đồ, đi theo con trỏ.
 * Dùng: bọc biểu đồ trong <div ref={ref} className="relative"> và gọi show(e, tiêu đề, dòng) ở onMouseMove, hide ở onMouseLeave.
 */
function useChartTip() {
  const ref = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<{ x: number; y: number; flip: boolean; title: string; line: string } | null>(null)
  const show = (e: MouseEvent, title: string, line: string) => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const x = e.clientX - r.left
    // Con trỏ ở nửa phải thì khung hiện bên trái con trỏ để không bị cắt mép
    setTip({ x, y: e.clientY - r.top, flip: x > r.width / 2, title, line })
  }
  const hide = () => setTip(null)
  const node = tip && (
    <div
      role="tooltip"
      style={{ left: tip.x, top: tip.y, transform: `translate(${tip.flip ? 'calc(-100% - 14px)' : '14px'}, 14px)` }}
      className="pointer-events-none absolute z-10 rounded-md bg-ink px-3 py-2 text-[12.5px] whitespace-nowrap text-bg shadow-portal-lift"
    >
      <span className="block text-[11.5px] opacity-75">{tip.title}</span>
      <strong className="block text-[14px] font-semibold tabular-nums">{tip.line}</strong>
    </div>
  )
  return { ref, show, hide, node }
}

/** Làm tròn trần trục tung lên số đẹp (1, 2, 2.5, 5 × 10^n). */
function niceMax(v: number) {
  if (v <= 0) return 1
  const exp = 10 ** Math.floor(Math.log10(v))
  const f = v / exp
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * exp
}

const monthLabel = (period: string) => `Tháng ${period.slice(5)}`
const axisLabel = (v: number) => (v >= 1e6 ? `${(v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} tr` : v.toLocaleString('vi-VN'))

/** Biểu đồ cột hoa hồng 6 tháng gần nhất (SVG thuần, không cần thư viện). */
export function CommissionBars({ data }: { data: AdminDashboard['commissionByMonth'] }) {
  const W = 620
  const H = 280
  const pad = { l: 56, r: 12, t: 14, b: 34 }
  const max = niceMax(Math.max(...data.map((d) => d.amount)))
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * max)
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b
  const slot = innerW / data.length
  const y = (v: number) => pad.t + innerH - (v / max) * innerH
  const tip = useChartTip()

  return (
    <div ref={tip.ref} className="relative">
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Biểu đồ cột hoa hồng 6 tháng gần nhất" className="h-auto w-full">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '4 4'} />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
            {axisLabel(t)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const w = Math.min(54, slot * 0.58)
        const x = pad.l + slot * i + (slot - w) / 2
        return (
          <g key={d.period} className="group" onMouseMove={(e) => tip.show(e, monthLabel(d.period), formatMoney(d.amount))} onMouseLeave={tip.hide}>
            {/* Vùng bắt chuột phủ cả cột của tháng, để bar thấp vẫn rê vào dễ */}
            <rect x={pad.l + slot * i} y={pad.t} width={slot} height={innerH + 22} fill="transparent" />
            <rect x={x} y={y(d.amount)} width={w} height={Math.max(0, y(0) - y(d.amount))} rx="4" fill="var(--sage)" className="opacity-70 transition-opacity group-hover:opacity-100" />
            <text x={x + w / 2} y={H - 12} textAnchor="middle" fontSize="11.5" fill="var(--muted)">
              {monthLabel(d.period)}
            </text>
          </g>
        )
      })}
    </svg>
    {tip.node}
    </div>
  )
}

const SLICE_COLORS = ['var(--sage)', 'var(--gold)', 'var(--info)', 'var(--warn)', 'var(--gold-hi)', 'var(--muted)']

/** Biểu đồ vành khuyên: đơn theo loại dịch vụ, kèm chú giải phần trăm. */
export function CategoryDonut({ data }: { data: AdminDashboard['ordersByCategory'] }) {
  const size = 190
  const r = 70
  const stroke = 26
  const c = 2 * Math.PI * r
  const total = data.reduce((a, d) => a + d.count, 0) || 1
  let offset = 0
  const tip = useChartTip()
  // Phần đang rê chuột (từ biểu đồ hoặc chú giải): các phần còn lại mờ đi
  const [active, setActive] = useState<string | null>(null)
  const dim = (slug: string) => (active && active !== slug ? 'opacity-35' : 'opacity-100')

  return (
    <div className="grid gap-5">
      <div ref={tip.ref} className="relative">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Biểu đồ vành khuyên đơn theo loại dịch vụ" className="mx-auto size-[190px]">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        {data.map((d, i) => {
          const len = (d.count / total) * c
          const dash = `${Math.max(0, len - 2)} ${c - Math.max(0, len - 2)}`
          const el = (
            <circle
              key={d.category.slug}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={SLICE_COLORS[i % SLICE_COLORS.length]}
              strokeWidth={stroke}
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              className={cn('transition-opacity', dim(d.category.slug))}
              onMouseMove={(e) => {
                setActive(d.category.slug)
                tip.show(e, d.category.name, `${d.count} đơn (${d.percent}%)`)
              }}
              onMouseLeave={() => {
                setActive(null)
                tip.hide()
              }}
            />
          )
          offset += len
          return el
        })}
        <text x="50%" y="48%" textAnchor="middle" fontSize="26" fontWeight="600" fill="var(--ink)">
          {total}
        </text>
        <text x="50%" y="62%" textAnchor="middle" fontSize="11" fill="var(--muted)">
          đơn
        </text>
      </svg>
      {tip.node}
      </div>
      <ul className="grid gap-2.5 text-[13.5px]">
        {data.map((d, i) => (
          <li key={d.category.slug} className={cn('flex items-center gap-2.5 transition-opacity', dim(d.category.slug))} onMouseEnter={() => setActive(d.category.slug)} onMouseLeave={() => setActive(null)}>
            <i aria-hidden className="size-2.5 flex-none rounded-full" style={{ background: SLICE_COLORS[i % SLICE_COLORS.length] }} />
            <span className="min-w-0 flex-1 truncate">{d.category.name}</span>
            <strong className="font-semibold tabular-nums">{d.percent}%</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

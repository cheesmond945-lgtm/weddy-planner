import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Thẻ số ở đầu các tab Ngân sách, Khách mời (và trang chia sẻ kế hoạch), theo ảnh tham khảo "aesthetics in the village":
 * số nằm trong ô giấy kem như một tấm ảnh, nhãn là chú thích chữ serif màu kem bên dưới, trên dải nền ô liu (StatGrid).
 * Kiểu ở plan-theme.css (.olive-*).
 */
export function StatCard({
  label,
  value,
  sub,
  tone,
  children,
}: {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  tone?: 'warn' | 'good'
  children?: ReactNode
}) {
  return (
    <div className="olive-stat">
      <div className="olive-tile">
        <div className={cn('olive-value', tone === 'warn' && 'text-warn', tone === 'good' && 'text-sage')}>{value}</div>
        {sub && <div className="text-[12.5px] text-muted-foreground">{sub}</div>}
        {children}
      </div>
      <div className="olive-caption">{label}</div>
    </div>
  )
}

/** Dải nền ô liu chứa các thẻ số: 4 cột, co lại trên màn hình hẹp. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('olive-band mb-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3', className)}>{children}</div>
}

/** Thanh ghép nhiều đoạn (Đã cọc / Chưa cọc / Còn lại...). Tổng các đoạn tối đa 100%. */
export function StackBar({ parts, label }: { parts: { value: number; className: string; title: string }[]; label: string }) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1
  return (
    <div role="img" aria-label={label} className="mt-2 flex h-1.5 overflow-hidden rounded-[9px] bg-line">
      {parts.map((p) => (
        <i key={p.title} title={p.title} className={cn('block h-full', p.className)} style={{ width: `${(Math.max(0, p.value) / total) * 100}%` }} />
      ))}
    </div>
  )
}

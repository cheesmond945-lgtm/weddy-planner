import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Thẻ số ở đầu các tab Ngân sách, Khách mời và Tổng quan (.stat trong prototype). */
export function StatCard({ label, value, sub, tone, children }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: 'warn' | 'good'; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-line bg-surface px-[18px] py-4">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className={cn('font-serif text-[24px] leading-tight font-semibold', tone === 'warn' && 'text-warn', tone === 'good' && 'text-sage')}>{value}</div>
      {sub && <div className="text-[13px] text-muted-foreground">{sub}</div>}
      {children}
    </div>
  )
}

/** Lưới thẻ số: 4 cột, co lại trên màn hình hẹp. */
export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3', className)}>{children}</div>
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

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const th = 'border-y border-line bg-surface-2 px-3 py-[11px] text-left text-[11.5px] font-medium tracking-[0.04em] text-muted-foreground uppercase first:pl-5 last:pr-5'
export const td = 'border-b border-line px-3 py-[14px] align-middle text-[13.5px] first:pl-5 last:pr-5'
export const num = 'text-right whitespace-nowrap tabular-nums'

/** Khung thẻ chứa bảng hoặc danh sách (thanh lọc, bảng, phân trang). */
export function TableCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-portal', className)}>{children}</section>
}

/** Bảng cuộn ngang trên màn hình hẹp. Truyền className="min-w-max" để bảng không co cột mà hiện thanh cuộn ngang khi nội dung dài. */
export function DataTable({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cn('w-full border-collapse', className)}>{children}</table>
    </div>
  )
}

/** Khung chờ tải (skeleton). */
export function TableSkeleton({ label, height = 360 }: { label: string; height?: number }) {
  return <div aria-busy="true" aria-label={label} style={{ height }} className="animate-pulse rounded-md bg-muted" />
}

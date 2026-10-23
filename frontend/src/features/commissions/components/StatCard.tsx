import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: ReactNode
  foot?: ReactNode
  /** Màu số: text-sage, text-gold-ink, text-warn… */
  tone?: string
  icon?: LucideIcon
}

/** Thẻ số liệu (.kpi trong prototype NCC): nhãn, số lớn, dòng chú thích; biểu tượng tùy chọn. */
export function StatCard({ label, value, foot, tone, icon: Icon }: StatCardProps) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface px-5 pt-5 pb-[18px] shadow-portal max-sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12.5px] text-muted-foreground">{label}</p>
        {Icon && (
          <span className="grid size-[34px] flex-none place-items-center rounded-[9px] bg-gold-soft text-gold-ink">
            <Icon className="size-[17px]" />
          </span>
        )}
      </div>
      <p className={cn('mt-2.5 truncate text-[27px] font-semibold tracking-tight tabular-nums max-sm:text-[23px]', tone)}>{value}</p>
      {foot && <p className="mt-1 text-xs text-muted-foreground">{foot}</p>}
    </div>
  )
}

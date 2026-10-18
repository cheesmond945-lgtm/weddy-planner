import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}

/** Khung trống / lỗi có nút hành động (.card.empty trong prototype). */
export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('rounded-lg border border-line bg-surface px-6 py-10 text-center', className)}>
      <h3 className="mb-1.5 text-xl">{title}</h3>
      {description && <p className="mb-4 text-muted-foreground">{description}</p>}
      {action}
    </div>
  )
}

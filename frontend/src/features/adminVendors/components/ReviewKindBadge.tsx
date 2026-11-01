import { cn } from '@/lib/utils'

/** "Duyệt lần đầu" hoặc "Kiểm tra cập nhật", suy từ trạng thái hồ sơ (Pending hay Approved). */
export const REVIEW_KIND_LABEL = { INITIAL: 'Duyệt lần đầu', UPDATE: 'Kiểm tra cập nhật' } as const

export function ReviewKindBadge({ kind }: { kind: keyof typeof REVIEW_KIND_LABEL }) {
  return (
    <span className={cn('rounded-pill px-2.5 py-[3px] text-xs font-medium whitespace-nowrap', kind === 'UPDATE' ? 'bg-info-soft text-info' : 'bg-gold-soft text-gold-ink')}>
      {REVIEW_KIND_LABEL[kind]}
    </span>
  )
}

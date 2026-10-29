import { cn } from '@/lib/utils'

export interface SegmentedTab<T extends string> {
  value: T
  /** Chữ chính, hiện IN HOA đậm */
  label: string
  /** Dòng phụ nhỏ bên dưới (số việc, số dịch vụ, số tiền…) */
  sub?: string
}

interface SegmentedTabsProps<T extends string> {
  tabs: readonly SegmentedTab<T>[]
  value: T
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

/**
 * Sub tab dạng ô chia đều trong khung bo tròn (kiểu "Ví chung / Chú rể / Cô dâu" của "Chi tiết khoản chi"):
 * ô đang chọn nền xanh nhạt, viền xanh nhạt, chữ xanh in hoa đậm; các ô còn lại chữ xám. Dùng chung cho mọi trang cần sub tab.
 */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, ariaLabel, className }: SegmentedTabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('grid auto-cols-fr grid-flow-col gap-1.5 rounded-[22px] border border-line bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] p-1.5 shadow-card', className)}
    >
      {tabs.map((t) => {
        const active = t.value === value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              'rounded-2xl border px-3 py-2.5 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sage',
              active ? 'border-sage/30 bg-sage-soft text-sage' : 'border-transparent text-muted-foreground hover:bg-[color-mix(in_srgb,var(--line)_30%,transparent)]',
            )}
          >
            <span className="block text-[13px] font-extrabold tracking-[0.1em] uppercase">{t.label}</span>
            {t.sub && <span className={cn('mt-0.5 block text-[12px] font-semibold', active ? 'text-sage' : 'text-muted-foreground')}>{t.sub}</span>}
          </button>
        )
      })}
    </div>
  )
}

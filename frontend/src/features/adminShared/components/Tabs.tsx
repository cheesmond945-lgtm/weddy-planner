import { cn } from '@/lib/utils'

export interface TabItem<T extends string> {
  value: T
  label: string
  count?: number
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
}

/** Tab trạng thái có gạch chân vàng và số mục (cùng kiểu với trang Quản lý dịch vụ của NCC). */
export function Tabs<T extends string>({ items, value, onChange, label }: TabsProps<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-line px-3 [scrollbar-width:thin]">
      {items.map((t) => {
        const on = value === t.value
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.value)}
            className={cn(
              'relative -mb-px flex flex-none items-center gap-2 px-3.5 py-3 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-ink',
              'after:absolute after:inset-x-3 after:-bottom-px after:h-0.5 after:origin-center after:scale-x-0 after:bg-(image:--gold-grad) after:transition-transform after:duration-300',
              on && 'font-semibold text-ink after:scale-x-100',
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={cn('rounded-pill border px-[7px] text-[11.5px] tabular-nums', on ? 'border-transparent bg-gold-soft text-gold-ink' : 'border-line bg-surface-2')}>{t.count}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

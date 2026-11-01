import { cn } from '@/lib/utils'

export type ChipTone = 'neutral' | 'wait' | 'warn' | 'done' | 'info'

export interface ChipItem<T extends string> {
  value: T
  label: string
  count: number
  tone: ChipTone
}

const DOT: Record<ChipTone, string> = {
  neutral: 'bg-muted-foreground',
  wait: 'bg-gold',
  warn: 'bg-warn',
  done: 'bg-sage',
  info: 'bg-info',
}

interface StatusChipsProps<T extends string> {
  items: ChipItem<T>[]
  value: T
  onChange: (v: T) => void
  label: string
}

/** Nhãn trạng thái dạng viên thuốc có chấm màu và số mục, nằm dưới thanh tìm kiếm và bộ lọc. */
export function StatusChips<T extends string>({ items, value, onChange, label }: StatusChipsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2 border-b border-line px-5 py-3.5">
      {items.map((c) => {
        const on = value === c.value
        return (
          <button
            key={c.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(c.value)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors',
              on ? 'border-warn bg-warn-soft text-ink' : 'border-line bg-surface text-ink hover:border-line-strong hover:bg-surface-2',
            )}
          >
            {c.value !== 'ALL' && <i aria-hidden className={cn('size-1.5 rounded-full', DOT[c.tone])} />}
            {c.label}
            <b className="font-semibold tabular-nums">{c.count}</b>
          </button>
        )
      })}
    </div>
  )
}

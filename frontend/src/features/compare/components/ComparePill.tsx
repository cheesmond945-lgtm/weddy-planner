import { Check, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComparePillProps {
  state: 'on' | 'off' | 'idle'
  name: string
  onToggle: () => void
}

/** Nút "So sánh" góc trái ảnh thẻ (.cmp-pill / pillInner trong prototype). */
export function ComparePill({ state, name, onToggle }: ComparePillProps) {
  const on = state === 'on'
  const off = state === 'off'
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={off}
      aria-label={on ? `Bỏ chọn so sánh ${name}` : off ? `Đã chọn đủ 3, không chọn thêm ${name}` : `Chọn ${name} để so sánh`}
      onClick={onToggle}
      className={cn(
        'inline-flex min-h-9 items-center gap-1.5 rounded-pill px-[13px] text-[12.5px] font-semibold shadow-fab transition-[background-color,color,transform] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        on ? 'bg-primary text-primary-foreground' : 'bg-surface text-ink',
        off ? 'cursor-not-allowed text-muted-foreground' : 'hover:scale-[1.04]',
      )}
    >
      {on ? <Check className="size-[15px]" strokeWidth={2.4} aria-hidden /> : !off && <Plus className="size-[15px]" strokeWidth={2.2} aria-hidden />}
      {on ? 'Đã chọn' : off ? 'Tối đa 3' : 'So sánh'}
    </button>
  )
}

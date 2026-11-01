import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { SpendingTier } from '@/types/wedding'
import { TIER_HINT, TIER_OPTIONS } from '../tiers'

/** Bốn thẻ chọn một "Mức chi tiêu" trong form thông tin đám cưới (chỉ chỉnh chính thức ở đây). */
export function SpendingTierPicker({ value, onChange, disabled }: { value: SpendingTier; onChange: (t: SpendingTier) => void; disabled?: boolean }) {
  const id = useId()
  return (
    <div>
      <span id={id} className="mb-1.5 block text-[13px] font-medium">
        Mức chi tiêu <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
      </span>
      <div role="radiogroup" aria-labelledby={id} className="grid gap-2 sm:grid-cols-2">
        {TIER_OPTIONS.map((t) => {
          const active = value === t.value
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(t.value)}
              className={cn(
                'rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:opacity-60',
                active ? 'border-gold bg-accent-soft' : 'border-line bg-white/85 hover:border-primary',
              )}
            >
              <span className={cn('block text-sm font-semibold', active && 'text-gold-700')}>{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.description}</span>
            </button>
          )
        })}
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">{TIER_HINT}</p>
    </div>
  )
}

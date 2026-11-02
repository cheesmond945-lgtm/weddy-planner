import { useId } from 'react'
import { cn } from '@/lib/utils'
import type { BudgetPreset } from '@/types/wedding'
import { PRESET_HINT, PRESET_OPTIONS } from '../presets'

/**
 * Thẻ chọn "Mức chia" (Cân bằng / Ưu tiên không gian / Ưu tiên hình ảnh) ở form thông tin đám cưới và tab Ngân sách.
 * Đang ở Tùy chỉnh thì không thẻ nào sáng; chọn một thẻ là bỏ Tùy chỉnh.
 */
export function BudgetPresetPicker({ value, onChange, disabled, hint = true }: { value: BudgetPreset; onChange: (p: Exclude<BudgetPreset, 'CUSTOM'>) => void; disabled?: boolean; hint?: boolean }) {
  const id = useId()
  return (
    <div>
      <span id={id} className="mb-1.5 block text-[13px] font-medium">
        Mức chia ngân sách <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
      </span>
      <div role="radiogroup" aria-labelledby={id} className="grid gap-2 sm:grid-cols-3">
        {PRESET_OPTIONS.map((t) => {
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
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{value === 'CUSTOM' ? 'Đang dùng tỷ lệ Tùy chỉnh (sửa ở tab Ngân sách). Chọn một mức để bỏ Tùy chỉnh.' : PRESET_HINT}</p>}
    </div>
  )
}

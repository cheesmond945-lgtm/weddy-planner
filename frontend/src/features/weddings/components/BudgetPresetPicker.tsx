import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type { BudgetPreset } from '@/types/wedding'
import { PRESET_HINT, PRESET_OPTIONS, type PresetOption } from '../presets'

/** Kiểu một thẻ mức chia (dùng chung cho thẻ "Tùy chỉnh" ở tab Ngân sách) */
export const presetCardClass = (active: boolean, disabled?: boolean) =>
  cn(
    'rounded-xl border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed',
    disabled && !active && 'opacity-45',
    active ? 'border-gold bg-accent-soft' : 'border-line bg-surface/85 hover:border-primary',
  )

/**
 * Thẻ chọn "Mức chia" (Cân bằng / Ưu tiên không gian / Ưu tiên hình ảnh) ở form thông tin đám cưới và tab Ngân sách.
 * Đang ở Tùy chỉnh thì không thẻ nào sáng; chọn một thẻ là bỏ Tùy chỉnh.
 * Bị khóa (disabled): thẻ đang chọn giữ nguyên, chỉ làm nhạt các thẻ còn lại.
 * `extra`: thẻ thứ tư cùng hàng (tab Ngân sách: thẻ "Tùy chỉnh"), dùng `presetCardClass` cho cùng kiểu.
 * `options`: ba mức đã tính theo dịch vụ đang chọn (presetOptionsFor); thẻ có `disabled` bị làm nhạt riêng.
 */
export function BudgetPresetPicker({
  value,
  onChange,
  disabled,
  hint = true,
  optional = true,
  extra,
  options = PRESET_OPTIONS,
}: {
  options?: PresetOption[]
  value: BudgetPreset
  onChange: (p: Exclude<BudgetPreset, 'CUSTOM'>) => void
  disabled?: boolean
  hint?: boolean
  /** Ghi "(không bắt buộc)" cạnh nhãn (form thông tin đám cưới) */
  optional?: boolean
  extra?: ReactNode
}) {
  const id = useId()
  return (
    <div>
      <span id={id} className="mb-1.5 block text-[13px] font-medium">
        Mức chia ngân sách {optional && <span className="font-normal text-muted-foreground">(không bắt buộc)</span>}
      </span>
      <div role="radiogroup" aria-labelledby={id} className={cn('grid gap-2', extra ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3')}>
        {options.map((t) => {
          const active = value === t.value
          const off = disabled || t.disabled
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={off}
              onClick={() => onChange(t.value)}
              className={presetCardClass(active, off)}
            >
              <span className={cn('block text-sm font-semibold', active && 'text-gold-700')}>{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.description}</span>
            </button>
          )
        })}
        {extra}
      </div>
      {hint && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {value === 'CUSTOM' ? 'Đang dùng Tùy chỉnh. Chọn một mức để bỏ Tùy chỉnh.' : PRESET_HINT}
        </p>
      )}
    </div>
  )
}

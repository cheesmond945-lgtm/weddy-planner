import type { BudgetPreset } from '@/types/wedding'

/*
 * Mức chia ngân sách (docs/api/weddings.md mục 7). Hàm thuần, có test ở presets.test.ts.
 * Mức chia chỉ chia phần còn lại cho các dịch vụ chưa chọn; trung tâm tiệc không nằm trong mức chia.
 */

/** Ba mức chọn ở form và tab Ngân sách; "Tùy chỉnh" (thanh kéo) chỉ có ở tab Ngân sách */
export const PRESET_OPTIONS: { value: Exclude<BudgetPreset, 'CUSTOM'>; label: string; description: string }[] = [
  { value: 'BALANCED', label: 'Cân bằng', description: 'Chia theo mặt bằng giá của từng dịch vụ.' },
  { value: 'SPACE', label: 'Ưu tiên không gian', description: 'Dành thêm cho trang trí, hoa cưới.' },
  { value: 'VISUAL', label: 'Ưu tiên hình ảnh', description: 'Dành thêm cho chụp ảnh, trang phục, trang điểm.' },
]

export const PRESET_LABEL: Record<BudgetPreset, string> = { BALANCED: 'Cân bằng', SPACE: 'Ưu tiên không gian', VISUAL: 'Ưu tiên hình ảnh', CUSTOM: 'Tùy chỉnh' }

export const PRESET_HINT = 'Chia phần ngân sách còn lại cho các dịch vụ chưa chọn.'

/** Dịch vụ được dành thêm của hai mức Ưu tiên (slug danh mục, khớp hệ số h > 1 trong budgetSplit.ts) */
export const PRESET_FOCUS: Record<'SPACE' | 'VISUAL', string[]> = {
  SPACE: ['decor', 'hoa-cuoi'],
  VISUAL: ['chup-anh', 'trang-phuc', 'makeup'],
}

export type PresetOption = (typeof PRESET_OPTIONS)[number] & { disabled?: boolean }

/**
 * Ba mức theo các dịch vụ khách đang chọn ở form: mô tả mức Ưu tiên chỉ kể dịch vụ ưu tiên đang được chọn; không còn dịch vụ
 * ưu tiên nào thì mức đó không có tác dụng (chia như Cân bằng) nên khóa thẻ. `nameOf`: tên hiển thị theo slug.
 */
export function presetOptionsFor(selected: string[], nameOf: (slug: string) => string): PresetOption[] {
  const names = (slugs: string[]) => slugs.map((s) => nameOf(s).toLowerCase())
  return PRESET_OPTIONS.map((o) => {
    if (o.value === 'BALANCED') return o
    const focus = PRESET_FOCUS[o.value]
    const picked = focus.filter((s) => selected.includes(s))
    return picked.length
      ? { ...o, description: `Dành thêm cho ${names(picked).join(', ')}.` }
      : { ...o, description: `Cần chọn ${names(focus).slice(0, -1).join(', ')} hoặc ${names(focus).at(-1)}.`, disabled: true }
  })
}

// Tỷ lệ Tùy chỉnh (số nguyên theo 0,01%, tự cân bằng, khóa, bỏ khỏi phần chia): budgetSplit.ts

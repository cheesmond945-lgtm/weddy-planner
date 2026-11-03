import type { BudgetPreset } from '@/types/wedding'

/*
 * Mức chia ngân sách (docs/api/weddings.md mục 7). Hàm thuần, có test ở presets.test.ts.
 * Mức chia chỉ chia phần còn lại cho các dịch vụ chưa chọn; trung tâm tiệc không nằm trong mức chia.
 */

/** Ba mức chọn ở form và tab Ngân sách; "Tùy chỉnh" (thanh kéo) chỉ có ở tab Ngân sách */
export const PRESET_OPTIONS: { value: Exclude<BudgetPreset, 'CUSTOM'>; label: string; description: string }[] = [
  { value: 'BALANCED', label: 'Cân bằng', description: 'Chia theo mặt bằng giá của từng dịch vụ.' },
  { value: 'SPACE', label: 'Ưu tiên không gian', description: 'Dành thêm cho trang trí.' },
  { value: 'VISUAL', label: 'Ưu tiên hình ảnh', description: 'Dành thêm cho chụp ảnh, trang phục, trang điểm.' },
]

export const PRESET_LABEL: Record<BudgetPreset, string> = { BALANCED: 'Cân bằng', SPACE: 'Ưu tiên không gian', VISUAL: 'Ưu tiên hình ảnh', CUSTOM: 'Tùy chỉnh' }

export const PRESET_HINT = 'Dùng để chia phần ngân sách còn lại cho các dịch vụ chưa chọn. Tự đặt tỷ lệ (Tùy chỉnh) ở tab Ngân sách.'

// Tỷ lệ Tùy chỉnh (số nguyên theo 0,01%, tự cân bằng, khóa, bỏ khỏi phần chia): budgetSplit.ts

import type { ConcreteTier, SpendingTier } from '@/types/wedding'

/** Mức chi tiêu: nhãn và mô tả một dòng (thẻ chọn ở form và tab Ngân sách). Hàm thuần, có test ở tiers.test.ts. */
export const TIER_OPTIONS: { value: SpendingTier; label: string; description: string }[] = [
  { value: 'AUTO', label: 'Tự động theo ngân sách', description: 'Chọn mức cao nhất vừa tổng ngân sách của bạn.' },
  { value: 'SAVING', label: 'Tiết kiệm', description: 'Gói giá thấp trong hạng mục.' },
  { value: 'BALANCED', label: 'Cân đối', description: 'Gói giá vừa phải, phổ biến.' },
  { value: 'PREMIUM', label: 'Cao cấp', description: 'Gói giá cao trong hạng mục.' },
]

export const TIER_LABEL: Record<SpendingTier, string> = { AUTO: 'Tự động', SAVING: 'Tiết kiệm', BALANCED: 'Cân đối', PREMIUM: 'Cao cấp' }

/** "Tự động (đang áp dụng Cân đối)" hoặc tên mức khách chọn. */
export function tierText(tier: SpendingTier, effective: ConcreteTier) {
  return tier === 'AUTO' ? `Tự động (đang áp dụng ${TIER_LABEL[effective]})` : TIER_LABEL[tier]
}

export const TIER_HINT = 'Dùng để gợi ý ngân sách từng hạng mục. Bạn vẫn sửa được từng ô và đổi lại sau.'

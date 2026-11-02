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

/** Tỷ lệ giữ 8 chữ số thập phân (để số tiền khách gõ hiện lại đúng), chỉ làm tròn khi hiển thị */
const roundP = (n: number) => Math.round(n * 1e8) / 1e8

/**
 * Kéo một thanh tỷ lệ: thanh đó nhận giá trị mới (0–100), các thanh còn lại co giãn theo tỷ lệ cũ để tổng luôn 100%.
 * Các thanh còn lại đều bằng 0 thì chia đều. Làm tròn 8 chữ số, phần lệch do làm tròn dồn vào thanh lớn nhất còn lại.
 */
export function rebalanceWeights(weights: Record<string, number>, slug: string, value: number): Record<string, number> {
  const v = roundP(Math.min(100, Math.max(0, value)))
  const others = Object.keys(weights).filter((k) => k !== slug)
  if (!others.length) return { [slug]: 100 }
  const rest = 100 - v
  const otherSum = others.reduce((s, k) => s + Math.max(0, weights[k] ?? 0), 0)
  const out: Record<string, number> = { [slug]: v }
  for (const k of others) out[k] = roundP(otherSum > 0 ? (Math.max(0, weights[k] ?? 0) / otherSum) * rest : rest / others.length)
  const drift = roundP(rest - others.reduce((s, k) => s + out[k], 0))
  if (drift !== 0) {
    const biggest = others.reduce((a, b) => (out[b] > out[a] ? b : a))
    out[biggest] = roundP(out[biggest] + drift)
  }
  return out
}

/** Số tiền khách gõ ở thanh kéo → % trên tiền đang chia cho dịch vụ chưa chọn (kẹp 0–100). Không có tiền để chia thì 0. */
export function percentFromAmount(amount: number, pool: number) {
  if (!(pool > 0) || !(amount > 0)) return 0
  return roundP(Math.min(100, (amount / pool) * 100))
}

/** % trên thanh kéo → số tiền tương ứng (làm tròn tới 1.000đ, khớp giới hạn ở backend) */
export const amountFromPercent = (percent: number, pool: number) => Math.round((Math.max(0, pool) * percent) / 100 / 1000) * 1000

/** "3,1%" (hiển thị 1 chữ số) */
export const percentText = (p: number) => `${(Math.round(p * 10) / 10).toLocaleString('vi-VN')}%`

import type { BudgetCostSource, BudgetSuggestionLabel, PlanPackageOption, PlanPackageRef } from '@/types/wedding'

/*
 * Cách hiển thị số liệu ngân sách và gói (hàm thuần, có test ở budgetView.test.ts).
 * Không tính lại ngân sách ở FE: mọi số lấy từ backend (allocation.ts).
 */

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`

/** Nhãn của gói gợi ý: "Vượt phân bổ" (vẫn trong trần cứng) hoặc "Vượt X" (không gói nào vừa, vẫn gợi ý gói rẻ nhất) */
export function suggestionLabelText(label: BudgetSuggestionLabel | null) {
  if (!label) return null
  return label.code === 'OVER_ALLOCATION' ? 'Vượt phân bổ' : `Vượt ${money(label.amount)}`
}

/** Ô tiền khách gõ: bỏ mọi ký tự không phải số. Trống là null. */
export function parseMoneyInput(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

/** Nhãn gói đang tính trên dòng nhà cung cấp. */
export function packageLabel(p: PlanPackageRef | null) {
  if (!p || !p.name) return 'Chưa có gói'
  if (p.source === 'ORDER') return `${p.name} (theo đơn)`
  if (p.source === 'SELECTED') return p.name
  return `Gói dự kiến: ${p.name}, bấm để đổi`
}

/** Nhãn đơn vị giá: "/ bàn" cho gói tính theo bàn, "/ gói" cho trọn gói. */
export const unitLabel = (unit: 'TABLE' | 'PACKAGE' | null | undefined) => (unit === 'TABLE' ? '/ bàn' : '/ gói')

/** Một dòng trong danh sách đổi gói: giá, chi phí theo số bàn, cảnh báo không đủ chỗ. */
export function packageOptionText(p: Pick<PlanPackageOption, 'name' | 'price' | 'cost' | 'minTables' | 'fits'> & { unit: PlanPackageOption['unit'] | null }, guestCount: number, tables: number) {
  const price = `${money(p.price)} ${unitLabel(p.unit)}`
  const cost = p.unit === 'TABLE' ? `, ${Math.max(tables, p.minTables ?? 0, 1)} bàn = ${money(p.cost)}` : ''
  const warn = p.fits ? '' : `. Vượt sức chứa (${guestCount.toLocaleString('vi-VN')} khách)`
  return `${p.name}: ${price}${cost}${warn}`
}

/** Nhãn nguồn của số chi phí dưới mỗi dòng: chưa có đơn là "Dự kiến", có đơn là "Theo đơn", đơn đã cọc là "Đã cọc {x}". */
export const COST_SOURCE_LABEL: Record<BudgetCostSource, string> = { PLANNED: 'Dự kiến', ORDER: 'Theo đơn', DEPOSITED: 'Đã cọc' }

/** "Dự kiến" / "Theo đơn" / "Đã cọc 3.000.000đ" */
export const costSourceText = (source: BudgetCostSource, deposited: number) => (source === 'DEPOSITED' ? `Đã cọc ${money(deposited)}` : COST_SOURCE_LABEL[source])

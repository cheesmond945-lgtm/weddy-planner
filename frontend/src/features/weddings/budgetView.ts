import type { BudgetCategory, PlanPackageOption, PlanPackageRef } from '@/types/wedding'

/*
 * Cách hiển thị số liệu ngân sách và gói (hàm thuần, có test ở budgetView.test.ts).
 * Không tính lại ngân sách ở FE: mọi số lấy từ backend (budget-engine.ts).
 */

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`

/** Chênh lệch: dương "Còn …" (xanh), âm "Vượt …" (đỏ), null "—". */
export function diffView(diff: number | null) {
  if (diff === null) return { text: '—', tone: 'none' as const }
  return diff < 0 ? { text: `Vượt ${money(-diff)}`, tone: 'over' as const } : { text: `Còn ${money(diff)}`, tone: 'left' as const }
}

/** Ô tiền khách gõ: bỏ mọi ký tự không phải số. Trống là null. */
export function parseMoneyInput(text: string): number | null {
  const digits = text.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

/**
 * Lưu ô ngân sách: trống thì bỏ số sửa tay (nếu đang có), trùng số đang hiện thì không làm gì,
 * khác thì đặt số sửa tay.
 */
export function budgetCellAction(c: Pick<BudgetCategory, 'budget' | 'manual'>, text: string): { type: 'none' } | { type: 'clear' } | { type: 'set'; amount: number } {
  const amount = parseMoneyInput(text)
  if (amount === null) return c.manual ? { type: 'clear' } : { type: 'none' }
  if (amount === c.budget) return { type: 'none' }
  return { type: 'set', amount }
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
export function packageOptionText(p: PlanPackageOption, guestCount: number, tables: number) {
  const price = `${money(p.price)} ${unitLabel(p.unit)}`
  const cost = p.unit === 'TABLE' ? `, ${Math.max(tables, p.minTables ?? 0, 1)} bàn = ${money(p.cost)}` : ''
  const warn = p.fits ? '' : `. Không đủ cho ${guestCount.toLocaleString('vi-VN')} khách`
  return `${p.name}: ${price}${cost}${warn}`
}

/**
 * Hằng số của thuật toán phân bổ ngân sách (allocation.ts). Nhóm chỉnh ở đây, không sửa công thức.
 * Đặc tả: docs/api/weddings.md mục 7.
 */
export { GUESTS_PER_TABLE } from './budget.config';

/** Đổi số khách của đơn tiệc đã cọc chỉ trong hạn này trước ngày cưới (giai đoạn 2: OrderAdjustments) */
export const GUEST_CHANGE_CUTOFF_DAYS = 7;

/** Trung tâm tiệc cưới: tính theo bàn, không nằm trong mức chia */
export const VENUE_SLUG = 'nha-hang';

export type BudgetPreset = 'BALANCED' | 'SPACE' | 'VISUAL' | 'CUSTOM';
export const BUDGET_PRESETS: BudgetPreset[] = ['BALANCED', 'SPACE', 'VISUAL', 'CUSTOM'];
export const PRESET_LABEL: Record<BudgetPreset, string> = {
  BALANCED: 'Cân bằng',
  SPACE: 'Ưu tiên không gian',
  VISUAL: 'Ưu tiên hình ảnh',
  CUSTOM: 'Tùy chỉnh',
};

/** Hệ số ưu tiên h của từng phương án (nhân 10, số nguyên) và thứ tự cố định khi xếp hòa: H10, SPLIT_ORDER trong budget-split.ts */

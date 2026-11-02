/**
 * Hằng số của thuật toán phân bổ ngân sách (allocation.ts). Nhóm chỉnh ở đây, không sửa công thức.
 * Đặc tả: docs/api/weddings.md mục 7.
 */
export { GUESTS_PER_TABLE } from './budget.config';

/** Đổi số khách của đơn tiệc đã cọc chỉ trong hạn này trước ngày cưới (giai đoạn 2: OrderAdjustments) */
export const GUEST_CHANGE_CUTOFF_DAYS = 7;

/**
 * Cách chọn "gói tốt nhất" sau bước khu vực:
 * - 'closest': chi phí gần giới hạn của hạng mục hơn xếp trước (tận dụng ngân sách, mặc định)
 * - 'cheapest': chi phí thấp hơn xếp trước
 */
export const BUDGET_FIT_DIRECTION: 'closest' | 'cheapest' = 'closest';

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

/**
 * Hệ số ưu tiên h của từng mức chia (tham số thiết kế, chỉnh được): trọng số w_i = trung vị_i × h_i / Σ(trung vị_j × h_j)
 * trên các dịch vụ chưa chọn. Slug không có trong bảng thì h = 1. "Trang điểm" có slug "trang-diem" (tên cũ "Makeup" là "makeup").
 */
export const PRESET_H: Record<Exclude<BudgetPreset, 'CUSTOM'>, Record<string, number>> = {
  BALANCED: {},
  SPACE: { decor: 1.3 },
  VISUAL: { 'chup-anh': 1.5, 'trang-phuc': 1.3, 'trang-diem': 1.2, makeup: 1.2 },
};

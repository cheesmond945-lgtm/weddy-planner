/**
 * Hằng số của chức năng "Gợi ý cho bạn" (suggest-rules.ts). Nhóm chỉnh ở đây, không sửa công thức.
 * Số khách mỗi bàn dùng chung với tab Ngân sách: GUESTS_PER_TABLE trong budget.config.ts.
 */
export { GUESTS_PER_TABLE } from './budget.config';

/** Số thẻ gợi ý tối đa */
export const SUGGESTION_COUNT = 3;

/** Dưới số lượt đánh giá này: không loại, chỉ gắn nhãn "Ít đánh giá" */
export const MIN_REVIEWS = 3;

/**
 * Cách xếp theo mức khớp ngân sách (sau bước địa điểm):
 * - 'CLOSEST': chi phí ước tính gần ngân sách hạng mục hơn xếp trước (tận dụng ngân sách, mặc định)
 * - 'CHEAPEST': chi phí thấp hơn xếp trước
 */
export const BUDGET_FIT_DIRECTION: 'CLOSEST' | 'CHEAPEST' = 'CLOSEST';

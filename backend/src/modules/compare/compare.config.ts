/**
 * Hằng số của trang So sánh dịch vụ (compare-rules.ts). Nhóm chỉnh ở đây, không sửa công thức.
 * Đặc tả: docs/api/compare.md.
 */
export { GUESTS_PER_TABLE } from '../weddings/budget.config';

/** Hạng mục tính theo bàn và có sức chứa (trung tâm tiệc cưới) */
export const VENUE_SLUG = 'nha-hang';

/** Nhãn "Điểm cao nhất" chỉ gắn khi mọi bên đều có ít nhất số lượt đánh giá này */
export const MIN_REVIEWS = 3;
/** Số bình luận của khách trích nguyên văn ở dòng Đánh giá (mới nhất trước) */
export const MAX_REVIEW_QUOTES = 2;

/** Câu "có sức chứa lớn hơn" chỉ ghi khi chênh lệch từ số khách này trở lên */
export const CAPACITY_NOTABLE_GAP = 50;

/** Số ý tối đa ở dòng "Bao gồm" */
export const MAX_INCLUDES = 4;

/** Cụm tách từ mô tả dài hơn số ký tự này thì bỏ (không đưa vào dòng "Bao gồm") */
export const INCLUDE_MAX_CHARS = 60;

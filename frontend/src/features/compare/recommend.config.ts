/*
 * Hằng số của hàm đề xuất so sánh (recommend.ts). Tách riêng để nhóm chỉnh mà không sửa công thức.
 * BE phải dùng đúng các giá trị này (xem docs/api/compare.md).
 */

/** Điểm trung bình giả định và "số đánh giá ảo" khi hiệu chỉnh Bayes điểm Google Maps */
export const BAYES_PRIOR_RATING = 4.3
export const BAYES_PRIOR_COUNT = 100

/** Trọng số khi KHÔNG có thông tin đám cưới */
export const WEIGHTS_NO_WEDDING = { rating: 0.55, price: 0.45 } as const

/** Trọng số khi có thông tin đám cưới (fit = mức phù hợp với đám cưới) */
export const WEIGHTS_WITH_WEDDING = { rating: 0.4, price: 0.3, fit: 0.3 } as const

/** Nhân điểm khi sức chứa không đủ cho số khách */
export const CAPACITY_PENALTY = 0.7

/** Chênh lệch điểm dưới mức này thì coi là ngang nhau, không đề xuất */
export const TIE_THRESHOLD = 0.03

/** Số lý do hiển thị tối đa */
export const MAX_REASONS = 3

/**
 * TẠM: tỷ lệ ngân sách gợi ý theo hạng mục (chưa có trong database.md), theo slug danh mục.
 * Giống CATS.share trong prototype.
 */
export const CATEGORY_BUDGET_SHARE: Record<string, number> = {
  'nha-hang': 0.22,
  decor: 0.14,
  'trang-phuc': 0.1,
  makeup: 0.08,
  'chup-anh': 0.12,
  'quay-phong-su': 0.08,
  'co-cuoi': 0.14,
  'hoa-cuoi': 0.12,
}

/** Hạng mục có tiêu chí sức chứa (ghi chú Capacity: chỉ áp dụng cho nhà hàng) */
export const CAPACITY_CATEGORIES = ['nha-hang']

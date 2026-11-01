/*
 * Hằng số của hàm đề xuất so sánh (recommend.ts). Tách riêng để nhóm chỉnh mà không sửa công thức.
 * Bản sao của frontend/src/features/compare/recommend.config.ts, hai bên phải giống hệt (docs/api/compare.md).
 */

/** Điểm trung bình giả định và "số đánh giá ảo" khi hiệu chỉnh Bayes điểm Google Maps */
export const BAYES_PRIOR_RATING = 4.3
export const BAYES_PRIOR_COUNT = 100

/** Trọng số khi KHÔNG có ngân sách hạng mục (chưa có thông tin đám cưới hoặc hạng mục chưa chọn) */
export const WEIGHTS_NO_WEDDING = { rating: 0.55, price: 0.45 } as const

/** Trọng số khi có ngân sách hạng mục (fit = min(1, ngân sách hạng mục / chi phí gói)) */
export const WEIGHTS_WITH_WEDDING = { rating: 0.4, price: 0.3, fit: 0.3 } as const

/**
 * Khi có phương án thiếu điểm Google (chưa có điểm hoặc lấy lỗi): bỏ hẳn yếu tố điểm cho cả nhóm,
 * chỉ dùng giá và độ phù hợp (chia lại tỷ lệ của 0.30 giá + 0.30 phù hợp).
 */
export const WEIGHTS_NO_RATING = { price: 1 } as const
export const WEIGHTS_NO_RATING_WITH_WEDDING = { price: 0.5, fit: 0.5 } as const

/** Nhân điểm khi sức chứa không đủ cho số khách */
export const CAPACITY_PENALTY = 0.7

/** Chênh lệch điểm dưới mức này thì coi là ngang nhau, không đề xuất */
export const TIE_THRESHOLD = 0.03

/** Số lý do hiển thị tối đa */
export const MAX_REASONS = 3

/** Hạng mục có tiêu chí sức chứa (ghi chú Capacity: chỉ áp dụng cho nhà hàng) */
export const CAPACITY_CATEGORIES = ['nha-hang']

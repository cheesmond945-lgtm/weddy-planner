/*
 * CHỜ ĐỐI CHIẾU docs/database.md. Đơn vị so sánh là nhà cung cấp (theo quyết định của nhóm),
 * ở FE đang gọi là "service" như module catalog.
 * Điểm Google không nằm trong items: lấy riêng qua GET /vendors/{id}/google-rating (types/googleRating.ts).
 * Hợp đồng: docs/api/compare.md
 */
import type { ServiceDetail } from './catalog'

export interface CompareRecommendation {
  /** NCC được đề xuất; null khi ngang nhau */
  serviceId: string | null
  /** Lý do ngắn, chữ thường, tối đa 3 */
  reasons: string[]
  isTie: boolean
}

export interface CompareResult {
  items: ServiceDetail[]
  /**
   * BE tính (có gọi Google lấy điểm). null ở chế độ dữ liệu giả: FE tự tính bằng
   * features/compare/recommend.ts từ điểm Google đã tải.
   */
  recommendation: CompareRecommendation | null
}

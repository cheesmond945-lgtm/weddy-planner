/*
 * CHỜ ĐỐI CHIẾU docs/database.md. Đơn vị so sánh là nhà cung cấp (theo quyết định của nhóm),
 * ở FE đang gọi là "service" như module catalog.
 * TẠM: rating, reviewCount là điểm Google Maps (thực tế lấy qua PlaceId của NCC).
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
  recommendation: CompareRecommendation
}

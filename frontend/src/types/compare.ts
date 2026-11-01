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
  /** cost: chi phí gói dùng để so (gói rẻ nhất đủ chỗ, nhà hàng = giá bàn × số bàn); không có ở dữ liệu giả */
  items: (ServiceDetail & { cost?: number })[]
  /** Ngân sách hạng mục đang hiển thị trong kế hoạch; null khi chưa có đám cưới hoặc hạng mục chưa chọn */
  categoryBudget?: number | null
  /** Số bàn dùng để tính chi phí nhà hàng */
  tables?: number | null
  /**
   * BE luôn tính (điểm Google thiếu thì bỏ yếu tố điểm). null ở chế độ dữ liệu giả: FE tự tính bằng
   * features/compare/recommend.ts từ điểm Google đã tải.
   */
  recommendation: CompareRecommendation | null
}

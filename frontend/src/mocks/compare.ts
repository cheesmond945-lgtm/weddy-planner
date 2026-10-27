import { ApiError } from '@/api/client'
import type { CompareResult } from '@/types/compare'
import { mockCatalog } from './catalog'

/*
 * So sánh giả (GET /compare). Chỉ trả danh sách nhà cung cấp; recommendation = null để FE tự tính
 * bằng features/compare/recommend.ts từ điểm Google (mode summary) đã tải trên trang so sánh.
 */
export const mockCompare = {
  compare(serviceIds: string[]): CompareResult {
    const ids = [...new Set(serviceIds)]
    if (ids.length < 2 || ids.length > 3) throw new ApiError(400, 'COMPARE_INVALID_COUNT', 'Chọn từ 2 đến 3 nhà cung cấp để so sánh.')
    const items = ids.map((id) => mockCatalog.getService(id))
    if (items.some((s) => s.category.slug !== items[0].category.slug)) {
      throw new ApiError(400, 'COMPARE_MIXED_CATEGORIES', 'Chỉ so sánh được các nhà cung cấp cùng hạng mục.')
    }
    return { items, recommendation: null }
  },
}

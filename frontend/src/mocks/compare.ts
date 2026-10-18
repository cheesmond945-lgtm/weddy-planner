import { ApiError } from '@/api/client'
import { recommend } from '@/features/compare/recommend'
import type { CompareResult } from '@/types/compare'
import { mockCatalog } from './catalog'
import { mockPlanning } from './planning'

/*
 * So sánh giả (GET /compare). Đề xuất do FE tính bằng features/compare/recommend.ts.
 * TẠM: rating, reviewCount (điểm Google Maps) lấy từ dữ liệu giả của catalog.
 * Thông tin đám cưới: của cặp đôi đang đăng nhập (có thể chưa thiết lập).
 */
export const mockCompare = {
  compare(serviceIds: string[]): CompareResult {
    const ids = [...new Set(serviceIds)]
    if (ids.length < 2 || ids.length > 3) throw new ApiError(400, 'COMPARE_INVALID_COUNT', 'Chọn từ 2 đến 3 nhà cung cấp để so sánh.')
    const items = ids.map((id) => mockCatalog.getService(id))
    const slug = items[0].category.slug
    if (items.some((s) => s.category.slug !== slug)) throw new ApiError(400, 'COMPARE_MIXED_CATEGORIES', 'Chỉ so sánh được các nhà cung cấp cùng hạng mục.')

    // Module weddings đang dùng location/styles; đổi sang city/styles cho hàm đề xuất
    const w = mockPlanning.getWedding()
    const rec = recommend(
      items.map((s) => ({ id: s.id, price: s.priceFrom, rating: s.rating, reviewCount: s.reviewCount, styles: s.styles, city: s.location, capacity: s.capacity })),
      w ? { budget: w.budget, guestCount: w.guestCount, city: w.location, styles: w.styles } : null,
      slug,
    )
    return { items, recommendation: { serviceId: rec.recommendedId, reasons: rec.reasons, isTie: rec.isTie } }
  },
}

import { mockGoogleRating } from '@/mocks/googleRating'
import type { GoogleRating, GoogleRatingMode } from '@/types/googleRating'
import { http } from './client'
import { USE_MOCK } from './mock'

/**
 * Điểm và đánh giá Google Maps của nhà cung cấp. FE KHÔNG gọi thẳng Google và không chứa khóa API:
 * chỉ gọi BE, BE gọi Places API. Hợp đồng: docs/api/vendors.md
 */
export function getGoogleRating(vendorId: string, mode: GoogleRatingMode): Promise<GoogleRating> {
  if (USE_MOCK) return mockGoogleRating.get(vendorId, mode)
  return http.get(`/vendors/${vendorId}/google-rating`, { query: { fields: mode } })
}

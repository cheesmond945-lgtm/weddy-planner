import type { GoogleRating, GoogleRatingMode } from '@/types/googleRating'
import { http } from './client'

/**
 * Điểm và đánh giá Google Maps của nhà cung cấp. FE KHÔNG gọi thẳng Google và không chứa khóa API:
 * chỉ gọi BE, BE gọi Places API. Hợp đồng: docs/api/vendors.md
 */
export function getGoogleRating(vendorId: string, mode: GoogleRatingMode): Promise<GoogleRating> {
  return http.get(`/vendors/${vendorId}/google-rating`, { query: { fields: mode } })
}

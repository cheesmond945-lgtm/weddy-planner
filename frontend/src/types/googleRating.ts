/*
 * TẠM, chờ BE chốt: điểm và đánh giá Google Maps của nhà cung cấp.
 * Lấy từ Google lúc gọi qua PlaceId của VendorProfiles, KHÔNG lưu vào database.
 * FE chỉ giữ trong bộ nhớ (cache React Query), không ghi vào localStorage/sessionStorage/IndexedDB.
 * Hợp đồng: docs/api/vendors.md, mục GET /vendors/{vendorId}/google-rating
 */

export type GoogleRatingMode = 'summary' | 'reviews'

export interface GoogleReview {
  authorName: string
  /** Trang hồ sơ người đánh giá trên Google Maps */
  authorUri?: string
  authorPhotoUri?: string
  /** 1–5 */
  rating: number
  text: string
  /** Thời điểm đăng, ISO 8601 */
  publishTime: string
  /** Mô tả thời gian Google trả sẵn (có thể không phải tiếng Việt); FE ưu tiên tự tính từ publishTime */
  relativeTime?: string
  languageCode?: string
}

export interface GoogleRating {
  placeId: string
  /** null khi địa điểm chưa có điểm */
  rating: number | null
  userRatingCount: number
  /** Mở địa điểm trên Google Maps */
  googleMapsUri: string
  /** Tối đa 5 đánh giá (giới hạn của Places API); chỉ có khi mode = reviews */
  reviews?: GoogleReview[]
  reviewsSortedBy?: 'relevance'
}

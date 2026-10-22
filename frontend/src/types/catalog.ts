/*
 * CHỜ ĐỐI CHIẾU docs/database.md: tên thực thể và trường đang suy từ prototype (mục 2.1, 2.2).
 * Hợp đồng: docs/api/catalog.md
 */

export interface CategoryRef {
  id: string
  /** Mã danh mục dùng trên URL và để FE chọn icon */
  slug: string
  name: string
}

export interface Category extends CategoryRef {
  imageUrl: string
  serviceCount: number
}

/** Dịch vụ dạng thẻ trong danh sách. */
export interface ServiceSummary {
  id: string
  name: string
  category: CategoryRef
  location: string
  /** Giá thấp nhất trong các gói, đơn vị đồng */
  priceFrom: number
  /** Điểm đánh giá lấy từ Google Maps */
  rating: number
  reviewCount: number
  coverImageUrl: string
}

export interface ServicePackage {
  id: string
  name: string
  description: string
  price: number
}

export interface ServiceAlbum {
  id: string
  title: string
  imageCount: number
  previewImageUrls: string[]
  /** Toàn bộ ảnh của album (mở khi bấm vào album). Dữ liệu giả có thể không có: khi đó dùng ảnh của cả dịch vụ */
  imageUrls?: string[]
}

export interface ServiceDetail extends ServiceSummary {
  /** Giá cao nhất trong các gói, đơn vị đồng */
  priceTo: number
  address: string
  description: string
  highlights: string[]
  /** Sức chứa tối đa (khách), chỉ có ở nhà hàng */
  capacity: number | null
  styles: string[]
  workingHours: string
  isVerified: boolean
  isGuaranteed: boolean
  images: string[]
  packages: ServicePackage[]
  albums: ServiceAlbum[]
}

export interface ServiceListQuery {
  q?: string
  /** slug danh mục */
  category?: string
  location?: string
  priceMin?: number
  /** Không bao gồm giá trị này (giá < priceMax) */
  priceMax?: number
  page?: number
  pageSize?: number
}

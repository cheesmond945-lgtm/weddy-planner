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
  /** Địa chỉ đầy đủ (số nhà, phường, tỉnh/thành); dữ liệu giả có thể không có */
  address?: string
  /** Giá thấp nhất trong các gói, đơn vị đồng */
  priceFrom: number
  /** Giá cao nhất trong các gói, đồng (dữ liệu giả có thể không có) */
  priceTo?: number
  /** Điểm trung bình đánh giá của khách trên web (0 khi chưa có), 1 chữ số thập phân */
  rating?: number
  /** Số lượt đánh giá trên web */
  reviewCount?: number
  /** TABLE: giá mỗi bàn 10 khách, đã gồm sảnh (trung tâm sự kiện); PACKAGE: giá trọn gói. Thiếu thì coi là PACKAGE */
  priceUnit?: 'TABLE' | 'PACKAGE'
  /** Giá theo bàn: số bàn tối thiểu của gói rẻ nhất để được kèm sảnh */
  minTables?: number | null
  coverImageUrl: string
  /** Link Google Maps của NCC (vendor_profiles.google_maps_url): mở bản đồ từ dòng địa chỉ */
  googleMapsUrl?: string | null
  /** NCC đang bị Admin ẩn nhưng bạn đã có đơn với họ: tạm ngừng nhận đơn mới */
  paused?: boolean
}

export interface ServicePackage {
  id: string
  name: string
  description: string
  price: number
  /** Sức chứa tối đa của gói (khách), null khi gói không ghi */
  capacity?: number | null
  /** Ảnh bìa của gói; dữ liệu giả có thể không có (khi đó lấy ảnh album cùng id hoặc ảnh dịch vụ) */
  imageUrl?: string | null
  /** Thẻ của gói do NCC nhập (Hiện đại, Pha lê...): chỉ để tìm kiếm và lọc */
  tags?: string[]
  /** Số bàn tối thiểu phải đặt (nhà hàng), null khi gói không ghi */
  minTables?: number | null
  /** Đơn vị hiển thị: "bàn" (giá một bàn) hoặc "gói" (trọn gói) */
  unit?: string
  /** Đơn vị tính: TABLE (giá × số bàn) hoặc PACKAGE (trọn gói) */
  pricingUnit?: 'TABLE' | 'PACKAGE'
  /** Nhãn ưu đãi trên ảnh gói (CSDL chưa có, để sẵn cho sau) */
  promotion?: string | null
  /** Gói nổi bật: ô lớn ở layout tiles (CSDL chưa có: mặc định gói đầu tiên) */
  featured?: boolean
  /** Danh sách "Bao gồm" trong drawer chi tiết gói (CSDL chưa có) */
  includes?: string[]
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
  /** Thẻ của các gói (chỉ hiện ở trang chi tiết, dùng cho tìm kiếm), không so với đám cưới */
  styles: string[]
  workingHours: string
  /** Cách hiện gói: "tiles" mỗi gói một ô ảnh (chụp ảnh, váy, trang điểm), "album" card ảnh ghép (mặc định) */
  packageLayout?: 'tiles' | 'album'
  /** Số điện thoại NCC (dùng khi nhắn qua Zalo, VITE_CHAT_MODE=zalo) */
  contactPhone?: string | null
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
  /** Khu vực: phường/xã chính thức có tiền tố, lấy từ GET /services/areas; lọc cứng AND với từ khóa */
  area?: string
  /** Phong cách, nối bằng dấu phẩy (bộ lọc AI đã hiểu) */
  styles?: string
  priceMin?: number
  /** Không bao gồm giá trị này (giá < priceMax) */
  priceMax?: number
  page?: number
  pageSize?: number
}

/** Bộ lọc AI đã hiểu từ câu gõ (đã được backend kiểm tra) */
export interface NlFilters {
  /** slug hạng mục */
  category: string | null
  area: string | null
  styles: string[]
  priceMin: number | null
  priceMax: number | null
}

/** GET /services/search (docs/api/catalog.md) */
export interface ServiceSearchResult {
  /** EMPTY: câu rỗng; GUIDE: hướng dẫn; TEXT: tầng 1; NEEDS_AI: cần gọi lại kèm ai=1; AI: tầng 2 */
  mode: 'EMPTY' | 'GUIDE' | 'TEXT' | 'NEEDS_AI' | 'AI'
  query: string
  items: (ServiceSummary & { estimatedCost?: number })[]
  total: number
  page: number
  pageSize: number
  sort?: 'CHEAP' | 'RATING' | null
  /** Tab đang chọn không có kết quả, hạng mục khác có */
  hint?: { tab: string; categorySlug: string; categoryName: string; count: number } | null
  guide?: { message: string; categories: { slug: string; name: string }[]; styles: string[] }
  ai?: {
    filters?: NlFilters
    overridden?: { area: boolean; price: boolean }
    priceRejected?: boolean
    error?: 'UNAVAILABLE' | 'TIMEOUT' | 'LIMIT' | 'FAILED'
  }
  empty?: { cheapestFrom?: number; noServicesInArea?: string }
}

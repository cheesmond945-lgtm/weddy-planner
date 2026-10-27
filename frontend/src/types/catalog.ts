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
  // Điểm Google Maps không thuộc catalog (CSDL không có cột điểm): lấy riêng qua GET /vendors/{id}/google-rating
  coverImageUrl: string
  /** Link Google Maps của NCC (vendor_profiles.google_maps_url); hiện thay điểm khi chưa lấy được điểm Google */
  googleMapsUrl?: string | null
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
  /** Thẻ phong cách của gói (Hiện đại, Pha lê...) */
  tags?: string[]
  /** Số bàn tối thiểu phải đặt (nhà hàng), null khi gói không ghi */
  minTables?: number | null
  /** Đơn vị tính giá: "gói" (mặc định), "bàn"... */
  unit?: string
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
  priceMin?: number
  /** Không bao gồm giá trị này (giá < priceMax) */
  priceMax?: number
  page?: number
  pageSize?: number
}

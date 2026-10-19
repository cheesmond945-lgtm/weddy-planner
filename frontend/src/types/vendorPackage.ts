/*
 * Gói dịch vụ phía NCC, theo docs/api/catalog.md (phần NCC, bản nháp).
 * CHỜ ĐỐI CHIẾU docs/database.md: trường mở rộng và enum đang suy từ prototype NCC (màn Quản lý dịch vụ).
 *
 * Cùng thực thể với ServicePackage mà phía cặp đôi đang hiển thị: giữ nguyên id, name, description, price
 * (price = giá tối thiểu, tức "giá từ"), chỉ thêm các trường NCC cần.
 */
import type { CategoryRef, ServicePackage } from './catalog'
import type { VendorFile } from './vendor'

/** Trạng thái gói. Nhãn tiếng Việt ở features/vendorPackages/constants.ts. */
export const PACKAGE_STATUSES = ['DRAFT', 'PENDING', 'PUBLISHED', 'HIDDEN'] as const
export type PackageStatus = (typeof PACKAGE_STATUSES)[number]

/**
 * Bản nháp có thể chưa nhập giá, nên price ở đây cho phép null.
 * Gói đã đăng luôn có price (phía cặp đôi nhận đúng kiểu ServicePackage).
 */
export interface VendorPackage extends Omit<ServicePackage, 'price'> {
  /** Giá tối thiểu, đơn vị đồng. null khi bản nháp chưa nhập */
  price: number | null
  /** Giá tối đa, đơn vị đồng */
  maxPrice: number | null
  /** Lĩnh vực của gói, lấy từ hồ sơ NCC lúc tạo, không đổi sau đó */
  category: CategoryRef
  status: PackageStatus
  tags: string[]
  /** Sức chứa tối đa (khách), chỉ dùng cho nhà hàng */
  capacity: number | null
  note: string | null
  /** Bộ ảnh của gói, theo thứ tự hiển thị */
  photos: VendorFile[]
  /** publicId của ảnh bìa; null thì dùng ảnh đầu tiên */
  coverPublicId: string | null
  updatedAt: string
}

/** Body của POST /vendors/me/packages, PATCH /vendors/me/packages/:id. */
export interface SavePackageRequest {
  name: string
  description: string | null
  price: number | null
  maxPrice: number | null
  tags: string[]
  capacity: number | null
  note: string | null
  photos: VendorFile[]
  coverPublicId: string | null
}

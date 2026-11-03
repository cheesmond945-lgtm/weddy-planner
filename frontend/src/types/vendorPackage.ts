/*
 * Gói dịch vụ phía NCC, theo docs/api/catalog.md (phần NCC, bản nháp).
 * CHỜ ĐỐI CHIẾU docs/database.md: trường mở rộng và enum đang suy từ prototype NCC (màn Quản lý dịch vụ).
 *
 * Cùng thực thể với ServicePackage mà phía cặp đôi đang hiển thị: giữ nguyên id, name, description, price
 * (price = "giá từ"), chỉ thêm các trường NCC cần.
 */
import type { CategoryRef, ServicePackage } from './catalog'
import type { VendorFile } from './vendor'

/** Trạng thái gói. Nhãn tiếng Việt ở features/vendorPackages/constants.ts. */
export const PACKAGE_STATUSES = ['DRAFT', 'PENDING', 'NEEDS_REVISION', 'PUBLISHED', 'HIDDEN'] as const
export type PackageStatus = (typeof PACKAGE_STATUSES)[number]

/** Mọi gói (kể cả bản nháp) đều có giá: price là giá "từ", đơn vị đồng. */
export interface VendorPackage extends ServicePackage {
  /** Lĩnh vực của gói, lấy từ hồ sơ NCC lúc tạo, không đổi sau đó */
  category: CategoryRef
  status: PackageStatus
  /** Lý do Admin yêu cầu chỉnh sửa (gói NEEDS_REVISION, hoặc bản cập nhật NEEDS_REVISION của gói đã đăng) */
  reviewNote: string | null
  /** Gói HIDDEN: ai ẩn. Admin ẩn thì NCC không tự khôi phục được, hiddenReason là lý do Admin nhập */
  hiddenBy?: 'ADMIN' | 'VENDOR' | null
  hiddenReason?: string | null
  /**
   * Bản cập nhật của gói đã đăng (hoặc đang ẩn). Các trường của gói vẫn là bản khách đang thấy;
   * bản này chỉ thay vào khi Admin duyệt. null: không có bản cập nhật.
   */
  pendingUpdate: PackageUpdate | null
  tags: string[]
  /** Sức chứa tối đa (khách), chỉ dùng cho nhà hàng */
  capacity: number | null
  /** Trung tâm sự kiện: số mâm tối thiểu để được kèm sảnh (giá gói là giá mỗi mâm 10 khách) */
  minTables?: number | null
  /** Bộ ảnh của gói, theo thứ tự hiển thị */
  photos: VendorFile[]
  /** publicId của ảnh bìa; null thì dùng ảnh đầu tiên */
  coverPublicId: string | null
  updatedAt: string
  /** Số công việc NCC đã khai cho gói (chưa xóa). API NCC luôn trả; bản Admin dựng lại gói thì không có */
  taskCount?: number
  /** Thời gian trong ngày cưới (docs/LICH_TRINH_NGAY_CUOI.md). API NCC luôn trả; bản Admin dựng lại gói thì không có */
  dayPlan?: PackageDayPlan
}

/** Thời gian NCC cần trong ngày cưới, khai theo gói (không qua Admin duyệt). null là chưa khai, dùng mặc định theo lĩnh vực. */
export interface PackageDayPlan {
  /** Có mặt trước giờ chính của khách bao nhiêu phút */
  leadMinutes: number | null
  /** Làm trong bao nhiêu phút kể từ lúc có mặt */
  durationMinutes: number | null
  /** Chỉ gói sảnh: giờ sớm nhất đơn vị khác được vào setup "HH:mm" */
  setupOpenTime: string | null
  /** Gói của Nhà hàng / Trung tâm tiệc cưới (có ô giờ cho vào setup) */
  isVenue: boolean
  /** Mặc định theo lĩnh vực khi chưa khai */
  defaults: { leadMinutes: number; durationMinutes: number }
}

export type SavePackageDayPlanRequest = Pick<PackageDayPlan, 'leadMinutes' | 'durationMinutes' | 'setupOpenTime'>

/** Ai làm một công việc của gói. */
export type PackageTaskOwner = 'CUSTOMER' | 'VENDOR' | 'BOTH'

/** Công việc NCC khai cho gói; offsetDays so với ngày thực hiện của đơn (âm = trước, 0 = đúng ngày, dương = sau). */
export interface PackageTask {
  id: string
  title: string
  note: string | null
  owner: PackageTaskOwner
  offsetDays: number
  sortOrder: number
}

/** Body của PUT /vendors/me/packages/:id/tasks: thay toàn bộ danh sách (có id: sửa, không id: thêm, vắng mặt: xóa mềm). */
export interface SavePackageTasksRequest {
  tasks: { id?: string; title: string; note: string | null; owner: PackageTaskOwner; offsetDays: number }[]
}

/** Trạng thái bản cập nhật: nháp chưa gửi, chờ Admin duyệt, bị yêu cầu chỉnh sửa. */
export type PackageUpdateStatus = 'DRAFT' | 'PENDING' | 'NEEDS_REVISION'

export interface PackageUpdate {
  status: PackageUpdateStatus
  name: string
  description: string
  price: number
  tags: string[]
  capacity: number | null
  minTables?: number | null
  photos: VendorFile[]
  coverPublicId: string | null
  savedAt: string
}

/** Body của POST /vendors/me/packages, PATCH /vendors/me/packages/:id. */
export interface SavePackageRequest {
  name: string
  description: string | null
  price: number
  tags: string[]
  capacity: number | null
  minTables: number | null
  photos: VendorFile[]
  coverPublicId: string | null
}

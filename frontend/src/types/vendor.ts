/*
 * Kiểu dữ liệu module vendors, theo docs/api/vendors.md (bản nháp).
 * CHỜ ĐỐI CHIẾU docs/database.md: tên trường và enum đang suy từ prototype NCC (màn Hồ sơ nhà cung cấp).
 * Khi database.md được chốt, sửa ở đây trước rồi sửa docs/api/vendors.md theo.
 */
import type { CategoryRef } from './catalog'

/** Trạng thái hồ sơ NCC. Nhãn tiếng Việt ở features/vendors/constants.ts. */
export const VENDOR_PROFILE_STATUSES = ['NOT_SUBMITTED', 'PENDING', 'NEEDS_REVISION', 'VERIFIED'] as const
export type VendorProfileStatus = (typeof VENDOR_PROFILE_STATUSES)[number]

/** Loại giấy tờ: kinh doanh, phòng cháy chữa cháy, an toàn thực phẩm, chứng chỉ tay nghề (tùy chọn). Mỗi loại một tệp. */
export const VENDOR_DOCUMENT_TYPES = ['BUSINESS_LICENSE', 'FIRE_SAFETY', 'FOOD_SAFETY', 'SKILL_CERTIFICATE'] as const
export type VendorDocumentType = (typeof VENDOR_DOCUMENT_TYPES)[number]

/** Loại ảnh cơ sở: mặt tiền. Mỗi loại nhiều ảnh. */
export const VENDOR_PHOTO_TYPES = ['FRONT'] as const
export type VendorPhotoType = (typeof VENDOR_PHOTO_TYPES)[number]

/** Tệp đã upload lên Cloudinary (xem docs/api/README.md mục 9). */
export interface VendorFile {
  url: string
  publicId: string
  fileName: string
  /** Byte */
  size: number
  mimeType: string
}

export interface VendorDocument extends VendorFile {
  type: VendorDocumentType
}

export interface VendorPhoto extends VendorFile {
  type: VendorPhotoType
}

export interface VendorProfile {
  id: string
  status: VendorProfileStatus
  businessName: string | null
  taxCode: string | null
  representativeName: string | null
  /**
   * Lĩnh vực cung cấp (dùng chung danh mục với phía cặp đôi, GET /categories). Admin gán khi tạo tài khoản NCC,
   * NCC chỉ xem, không đổi được. null chỉ khi tài khoản chưa được gán (dữ liệu lỗi).
   */
  category: CategoryRef | null
  /** Lĩnh vực đã được Admin xác minh. null khi chưa xác minh lần nào */
  verifiedCategory: CategoryRef | null
  /** Tỉnh / thành phố (cột city), NCC tự nhập */
  province: string | null
  /** Phường / xã (cột ward) */
  ward: string | null
  address: string | null
  googleMapsUrl: string | null
  /** Giờ mở và đóng cửa (HH:mm); BE nối thành chuỗi "09:00–21:00" khi lưu */
  openTime: string | null
  closeTime: string | null
  /** Giới thiệu hiển thị cho cặp đôi */
  description: string | null
  documents: VendorDocument[]
  photos: VendorPhoto[]
  /** Lý do Admin yêu cầu bổ sung (khi NEEDS_REVISION) */
  reviewNote: string | null
  /** Đã xác minh và đã gửi cập nhật, đang chờ Admin kiểm tra: hồ sơ chỉ đọc */
  pendingReview: boolean
  /** Đã xác minh (vẫn hiển thị) nhưng bản cập nhật gần nhất bị Admin yêu cầu chỉnh sửa; lý do ở reviewNote */
  revisionRequested: boolean
  /** Lần gửi xác minh gần nhất */
  submittedAt: string | null
  updatedAt: string
}

// ---- Request / response theo docs/api/vendors.md ----

/** Body của PATCH /vendors/me/profile (lưu nháp) và POST /vendors/me/profile/submit (gửi xác minh). Không có lĩnh vực (chỉ đọc). */
export interface UpdateVendorProfileRequest {
  businessName: string | null
  taxCode: string | null
  representativeName: string | null
  province: string | null
  ward: string | null
  address: string | null
  googleMapsUrl: string | null
  openTime: string | null
  closeTime: string | null
  description: string | null
  documents: VendorDocument[]
  photos: VendorPhoto[]
}

/** Mục đích upload, quyết định thư mục và định dạng được nhận. */
export type VendorUploadPurpose = 'VENDOR_DOCUMENT' | 'VENDOR_PHOTO' | 'PACKAGE_PHOTO' | 'PAYMENT_PROOF'

/** Response của POST /vendors/me/uploads/signature: tham số để FE upload thẳng lên Cloudinary. */
export interface UploadSignature {
  uploadUrl: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
}

/** Thông báo của NCC (chuông ở header): duyệt hồ sơ và gói, đơn hàng, hoa hồng. */
export interface VendorNotification {
  id: string
  type: string
  title: string
  content: string
  isRead: boolean
  /** ISO */
  createdAt: string
  refType: string | null
  refId: string | null
}

export interface VendorNotificationList {
  /** Tổng số chưa đọc (không chỉ trong danh sách trả về) */
  unread: number
  items: VendorNotification[]
}

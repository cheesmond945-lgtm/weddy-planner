/*
 * Kiểu dữ liệu module vendors, theo docs/api/vendors.md (bản nháp).
 * CHỜ ĐỐI CHIẾU docs/database.md: tên trường và enum đang suy từ prototype NCC (màn Hồ sơ nhà cung cấp).
 * Khi database.md được chốt, sửa ở đây trước rồi sửa mocks/ và docs/api/vendors.md theo.
 */
import type { CategoryRef } from './catalog'

/** Trạng thái hồ sơ NCC. Nhãn tiếng Việt ở features/vendors/constants.ts. */
export const VENDOR_PROFILE_STATUSES = ['NOT_SUBMITTED', 'PENDING', 'NEEDS_REVISION', 'VERIFIED'] as const
export type VendorProfileStatus = (typeof VENDOR_PROFILE_STATUSES)[number]

/** Loại giấy tờ: kinh doanh, phòng cháy chữa cháy, an toàn thực phẩm. Mỗi loại một tệp. */
export const VENDOR_DOCUMENT_TYPES = ['BUSINESS_LICENSE', 'FIRE_SAFETY', 'FOOD_SAFETY'] as const
export type VendorDocumentType = (typeof VENDOR_DOCUMENT_TYPES)[number]

/** Loại ảnh cơ sở: mặt tiền. Mỗi loại nhiều ảnh. */
export const VENDOR_PHOTO_TYPES = ['FRONT'] as const
export type VendorPhotoType = (typeof VENDOR_PHOTO_TYPES)[number]

export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const
export type Weekday = (typeof WEEKDAYS)[number]

/** Một khung giờ chung: từ ngày đến ngày, giờ mở và đóng cửa (HH:mm). */
export interface BusinessHours {
  fromDay: Weekday
  toDay: Weekday
  openTime: string
  closeTime: string
}

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
  /** Hiện chỉ phục vụ Hà Nội, BE luôn trả "Hà Nội" */
  province: string
  district: string | null
  address: string | null
  googleMapsUrl: string | null
  businessHours: BusinessHours | null
  documents: VendorDocument[]
  photos: VendorPhoto[]
  /** Lý do Admin yêu cầu bổ sung (khi NEEDS_REVISION) */
  reviewNote: string | null
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
  district: string | null
  address: string | null
  googleMapsUrl: string | null
  businessHours: BusinessHours | null
  documents: VendorDocument[]
  photos: VendorPhoto[]
}

/** Mục đích upload, quyết định thư mục và định dạng được nhận. */
export type VendorUploadPurpose = 'VENDOR_DOCUMENT' | 'VENDOR_PHOTO' | 'PACKAGE_PHOTO'

/** Response của POST /vendors/me/uploads/signature: tham số để FE upload thẳng lên Cloudinary. */
export interface UploadSignature {
  uploadUrl: string
  apiKey: string
  timestamp: number
  signature: string
  folder: string
}

import type { BadgeTone } from '@/components/Badge'
import type { VendorDocumentType, VendorPhotoType, VendorProfile, VendorProfileStatus } from '@/types/vendor'

/** Nhãn và màu trạng thái hồ sơ (góc phải trang Hồ sơ): Draft, Pending, NeedRevision, Approved. */
export const PROFILE_STATUS: Record<VendorProfileStatus, { label: string; tone: BadgeTone }> = {
  NOT_SUBMITTED: { label: 'Bản nháp', tone: 'wait' },
  PENDING: { label: 'Chờ duyệt', tone: 'info' },
  NEEDS_REVISION: { label: 'Cần chỉnh sửa / bổ sung', tone: 'warn' },
  VERIFIED: { label: 'Đã duyệt', tone: 'done' },
}

/** Chờ duyệt lần đầu, hoặc đã duyệt mà đang chờ Admin kiểm tra bản cập nhật: hồ sơ chỉ đọc, không có nút nào. */
export const isProfileReadOnly = (p: Pick<VendorProfile, 'status' | 'pendingReview'>) =>
  p.status === 'PENDING' || (p.status === 'VERIFIED' && p.pendingReview)

/** Lĩnh vực nhà hàng (slug danh mục) cần thêm giấy ATTP và bắt buộc ảnh cơ sở. */
export const RESTAURANT_SLUG = 'nha-hang'

export interface FileSlot<T extends string> {
  type: T
  label: string
  /** Bắt buộc khi gửi xác minh */
  required: boolean
}

/** Bộ giấy tờ theo lĩnh vực: GPKD + PCCC; nhà hàng thêm ATTP; chứng chỉ tay nghề tùy chọn với mọi lĩnh vực. */
export function documentSlotsOf(categorySlug: string | null | undefined): FileSlot<VendorDocumentType>[] {
  return [
    { type: 'BUSINESS_LICENSE', label: 'Giấy phép kinh doanh', required: true },
    { type: 'FIRE_SAFETY', label: 'Giấy phòng cháy chữa cháy', required: true },
    ...(categorySlug === RESTAURANT_SLUG ? [{ type: 'FOOD_SAFETY' as const, label: 'Giấy an toàn vệ sinh thực phẩm', required: true }] : []),
    { type: 'SKILL_CERTIFICATE', label: 'Chứng chỉ tay nghề (nếu có)', required: false },
  ]
}

/** Ảnh cơ sở: nhà hàng bắt buộc, lĩnh vực khác tùy chọn. */
export const PHOTO_TYPE: VendorPhotoType = 'FRONT'
export const PHOTO_LABEL = 'Ảnh cơ sở'
export const MAX_PHOTOS = 20

export const photosRequired = (categorySlug: string | null | undefined) => categorySlug === RESTAURANT_SLUG

/** Mốc giờ gợi ý cách nhau 30 phút: 00:00 … 23:30 (vẫn gõ tự do được). */
export const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

/** Giới hạn tệp upload (như prototype). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf']

/** 1536000 -> "1.5 MB", 412000 -> "402 KB" (như prototype). */
export function formatFileSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

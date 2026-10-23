import type { BadgeTone } from '@/components/Badge'
import type { VendorDocumentType, VendorPhotoType, VendorProfileStatus, Weekday } from '@/types/vendor'

/** Nhãn và màu trạng thái hồ sơ theo prototype NCC. */
export const PROFILE_STATUS: Record<VendorProfileStatus, { label: string; tone: BadgeTone }> = {
  NOT_SUBMITTED: { label: 'Chưa gửi xác minh', tone: 'wait' },
  PENDING: { label: 'Chờ duyệt', tone: 'info' },
  NEEDS_REVISION: { label: 'Cần bổ sung', tone: 'warn' },
  VERIFIED: { label: 'Đã xác minh', tone: 'done' },
}

/** Đang chờ duyệt hoặc đã xác minh thì hồ sơ chỉ đọc. */
export const isProfileLocked = (status: VendorProfileStatus) => status === 'PENDING' || status === 'VERIFIED'

/** Lĩnh vực nhà hàng (slug danh mục) cần thêm giấy ATTP và bắt buộc ảnh mặt tiền. */
export const RESTAURANT_SLUG = 'nha-hang'

export interface FileSlot<T extends string> {
  type: T
  label: string
}

/** Bộ giấy tờ theo lĩnh vực: nhà hàng thêm ATTP, còn lại GPKD + PCCC. */
export function documentSlotsOf(categorySlug: string | null | undefined): FileSlot<VendorDocumentType>[] {
  return [
    { type: 'BUSINESS_LICENSE', label: 'Giấy tờ kinh doanh' },
    { type: 'FIRE_SAFETY', label: 'Giấy tờ PCCC' },
    ...(categorySlug === RESTAURANT_SLUG ? [{ type: 'FOOD_SAFETY' as const, label: 'Giấy tờ ATTP' }] : []),
  ]
}

/** Ảnh cơ sở theo lĩnh vực: chỉ ảnh mặt tiền, nhà hàng bắt buộc, lĩnh vực khác tùy chọn. */
export function photoSlotsOf(categorySlug: string | null | undefined): FileSlot<VendorPhotoType>[] {
  return [{ type: 'FRONT', label: categorySlug === RESTAURANT_SLUG ? 'Ảnh mặt tiền' : 'Ảnh mặt tiền / cơ sở hoạt động' }]
}

export const photosRequired = (categorySlug: string | null | undefined) => categorySlug === RESTAURANT_SLUG

/** Hiện chỉ phục vụ Hà Nội (như prototype). */
export const PROVINCE = 'Hà Nội'

export const DISTRICTS = [
  'Ba Đình',
  'Bắc Từ Liêm',
  'Cầu Giấy',
  'Đống Đa',
  'Hà Đông',
  'Hai Bà Trưng',
  'Hoàn Kiếm',
  'Hoàng Mai',
  'Long Biên',
  'Nam Từ Liêm',
  'Tây Hồ',
  'Thanh Xuân',
].sort((a, b) => a.localeCompare(b, 'vi'))

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: 'Thứ 2',
  TUESDAY: 'Thứ 3',
  WEDNESDAY: 'Thứ 4',
  THURSDAY: 'Thứ 5',
  FRIDAY: 'Thứ 6',
  SATURDAY: 'Thứ 7',
  SUNDAY: 'Chủ nhật',
}

/** Mốc giờ cách nhau 30 phút: 00:00 … 23:30. */
export const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)

/** Giới hạn tệp upload (như prototype). */
export const MAX_FILE_SIZE = 10 * 1024 * 1024
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const DOCUMENT_TYPES = [...IMAGE_TYPES, 'application/pdf']

/** 1536000 -> "1.5 MB", 412000 -> "402 KB" (như prototype). */
export function formatFileSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
}

import type { BadgeTone } from '@/components/Badge'
import { RESTAURANT_SLUG } from '@/features/vendors/constants'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { PackageStatus } from '@/types/vendorPackage'

/** Nhãn và màu trạng thái gói theo prototype NCC. */
export const PACKAGE_STATUS: Record<PackageStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Bản nháp', tone: 'wait' },
  PENDING: { label: 'Chờ duyệt', tone: 'info' },
  NEEDS_REVISION: { label: 'Cần chỉnh sửa', tone: 'warn' },
  PUBLISHED: { label: 'Đã đăng', tone: 'done' },
  HIDDEN: { label: 'Ẩn', tone: 'neutral' },
}

/** Gói còn sửa được: bản nháp, hoặc đã bị Admin yêu cầu chỉnh sửa. */
export const isEditablePackage = (status: PackageStatus) => status === 'DRAFT' || status === 'NEEDS_REVISION'

/** Thông báo đầu trang chi tiết gói (gói không còn sửa được thì chỉ xem). */
export const PACKAGE_NOTICE: Partial<Record<PackageStatus, { tone: 'ok' | 'info'; text: string }>> = {
  PENDING: { tone: 'info', text: 'Dịch vụ đang chờ duyệt. Nội dung không thể chỉnh sửa trong thời gian này.' },
  PUBLISHED: { tone: 'ok', text: 'Dịch vụ đang hiển thị công khai với khách. Nội dung chỉ xem.' },
  HIDDEN: { tone: 'info', text: 'Dịch vụ đang ẩn khỏi danh sách và tìm kiếm công khai. Đăng lại sẽ khôi phục đúng phiên bản đã được duyệt.' },
}

export const isVenue = (category: CategoryRef | null | undefined) => category?.slug === RESTAURANT_SLUG

/** Lĩnh vực cho gói mới: lĩnh vực đã xác minh (chỉ NCC có hồ sơ đã duyệt mới thêm được gói). */
export const packageCategoryOf = (profile: VendorProfile) => (profile.status === 'VERIFIED' ? profile.verifiedCategory : profile.category)

/** Được gửi duyệt khi hồ sơ đã xác minh đúng lĩnh vực của gói. */
export const canSubmitPackage = (profile: VendorProfile | undefined, category: CategoryRef | null | undefined) =>
  !!profile && !!category && profile.status === 'VERIFIED' && profile.verifiedCategory?.id === category.id

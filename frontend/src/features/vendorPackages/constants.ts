import type { BadgeTone } from '@/components/Badge'
import { RESTAURANT_SLUG } from '@/features/vendors/constants'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { PackageStatus, VendorPackage } from '@/types/vendorPackage'

/** Nhãn và màu trạng thái gói theo prototype NCC. */
export const PACKAGE_STATUS: Record<PackageStatus, { label: string; tone: BadgeTone }> = {
  DRAFT: { label: 'Bản nháp', tone: 'neutral' },
  PENDING: { label: 'Chờ duyệt', tone: 'info' },
  PUBLISHED: { label: 'Đã đăng', tone: 'done' },
  HIDDEN: { label: 'Ẩn', tone: 'neutral' },
}

/** Thông báo đầu trang chi tiết gói (gói không còn là bản nháp thì chỉ xem). */
export const PACKAGE_NOTICE: Partial<Record<PackageStatus, { tone: 'ok' | 'info'; text: string }>> = {
  PENDING: { tone: 'info', text: 'Dịch vụ đang chờ duyệt. Nội dung không thể chỉnh sửa trong thời gian này.' },
  PUBLISHED: { tone: 'ok', text: 'Dịch vụ đang hiển thị công khai với khách. Nội dung chỉ xem.' },
  HIDDEN: { tone: 'info', text: 'Dịch vụ đang ẩn khỏi danh sách và tìm kiếm công khai. Đăng lại sẽ khôi phục đúng phiên bản đã được duyệt.' },
}

export const isVenue = (category: CategoryRef | null | undefined) => category?.slug === RESTAURANT_SLUG

/** Lĩnh vực cho gói mới: lĩnh vực đã xác minh, chưa xác minh thì lĩnh vực đang khai trong hồ sơ (như prototype). */
export const packageCategoryOf = (profile: VendorProfile) => (profile.status === 'VERIFIED' ? profile.verifiedCategory : profile.category)

/** Được gửi duyệt khi hồ sơ đã xác minh đúng lĩnh vực của gói. */
export const canSubmitPackage = (profile: VendorProfile | undefined, category: CategoryRef | null | undefined) =>
  !!profile && !!category && profile.status === 'VERIFIED' && profile.verifiedCategory?.id === category.id

/** Ảnh bìa: ảnh được chọn, không có thì ảnh đầu. */
export const coverOf = (p: Pick<VendorPackage, 'photos' | 'coverPublicId'>) =>
  p.photos.find((x) => x.publicId === p.coverPublicId) ?? p.photos[0] ?? null

/** Tag gợi ý theo lĩnh vực (slug danh mục), chép từ prototype NCC. Lĩnh vực khác thì không gợi ý. */
export const TAG_SUGGESTIONS: Record<string, string[]> = {
  'nha-hang': ['Tiệc cưới', 'Menu A', 'Menu B', 'Cho thuê sảnh trống', 'Sảnh ngoài trời', 'Tiệc 300 khách', 'Trọn gói'],
  decor: ['Decor', 'Trang trí gia tiên', 'Trang trí tiệc cưới', 'Cho thuê sảnh trống', 'Decor wedding'],
  'chup-anh': ['Pre-wedding', 'Phóng sự cưới', 'Quay phim cinematic', 'Ngoại cảnh Đà Lạt', 'Album cưới'],
  'trang-phuc': ['Váy cưới', 'Áo dài cưới', 'Vest chú rể', 'Cho thuê', 'May đo'],
  makeup: ['Makeup cô dâu', 'Làm tóc', 'Trang điểm tự nhiên', 'Makeup tại nhà'],
  'hoa-cuoi': ['Hoa cầm tay', 'Hoa tươi', 'Hoa cài áo', 'Hoa trang trí'],
}

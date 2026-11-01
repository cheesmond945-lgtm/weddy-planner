import { Heart, ListChecks, Zap } from 'lucide-react'
import type { AiStyleOption } from '@/components/AiWriteDialog'
import type { BadgeTone } from '@/components/Badge'
import { RESTAURANT_SLUG } from '@/features/vendors/constants'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { PackageStatus, PackageUpdateStatus, VendorPackage } from '@/types/vendorPackage'

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

/** Gói đã đăng có bản cập nhật đang sửa (nháp hoặc bị Admin yêu cầu chỉnh sửa). */
export const hasEditableUpdate = (p: VendorPackage) => p.status === 'PUBLISHED' && (p.pendingUpdate?.status === 'DRAFT' || p.pendingUpdate?.status === 'NEEDS_REVISION')

/** Nội dung NCC đang làm: gói đã đăng có bản cập nhật thì là bản cập nhật, còn lại là chính gói. */
export function workingCopy(p: VendorPackage): VendorPackage {
  const u = p.status === 'PUBLISHED' ? p.pendingUpdate : null
  return u ? { ...p, name: u.name, description: u.description, price: u.price, tags: u.tags, capacity: u.capacity, minTables: u.minTables ?? null, photos: u.photos, coverPublicId: u.coverPublicId } : p
}

/** Nhãn phụ cạnh "Đã đăng" khi gói có bản cập nhật. */
export const UPDATE_LABEL: Record<PackageUpdateStatus, { label: string; className: string }> = {
  DRAFT: { label: 'Có bản cập nhật nháp', className: 'bg-surface-2 text-muted-foreground' },
  PENDING: { label: 'Cập nhật chờ duyệt', className: 'bg-info-soft text-info' },
  NEEDS_REVISION: { label: 'Cập nhật cần chỉnh sửa', className: 'bg-gold-soft text-gold-ink' },
}

export const isVenue = (category: CategoryRef | null | undefined) => category?.slug === RESTAURANT_SLUG

/** Lĩnh vực cho gói mới: lĩnh vực đã xác minh (chỉ NCC có hồ sơ đã duyệt mới thêm được gói). */
export const packageCategoryOf = (profile: VendorProfile) => (profile.status === 'VERIFIED' ? profile.verifiedCategory : profile.category)

/** Được gửi duyệt khi hồ sơ đã xác minh đúng lĩnh vực của gói. */
export const canSubmitPackage = (profile: VendorProfile | undefined, category: CategoryRef | null | undefined) =>
  !!profile && !!category && profile.status === 'VERIFIED' && profile.verifiedCategory?.id === category.id

/** Giọng văn cho phần Mô tả gói (mô tả hàng bán). Id khớp PACKAGE_STYLES ở backend. */
export const PACKAGE_AI_STYLES: AiStyleOption[] = [
  { id: 'clear', label: 'Rõ ràng', hint: 'Gọn, thực tế, dễ so sánh với gói khác', icon: ListChecks },
  { id: 'romantic', label: 'Lãng mạn', hint: 'Giàu cảm xúc, nhắc tới ngày trọng đại', icon: Heart },
  { id: 'youthful', label: 'Trẻ trung', hint: 'Năng động, thoải mái, gần gũi với cặp đôi trẻ', icon: Zap },
]

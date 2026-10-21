import { ApiError } from '@/api/client'
import { documentSlotsOf, isProfileLocked, photoSlotsOf, photosRequired, PROVINCE } from '@/features/vendors/constants'
import type { CategoryRef } from '@/types/catalog'
import type { UpdateVendorProfileRequest, VendorFile, VendorProfile, VendorUploadPurpose } from '@/types/vendor'
import { mockCatalog } from './catalog'

/*
 * Hồ sơ NCC giả, lưu theo từng tài khoản NCC trong localStorage.
 * Tài khoản mẫu u-vendor-1 dùng dữ liệu "Mây Palace" của prototype NCC, đang ở trạng thái Cần bổ sung
 * để thử được cả luồng sửa và gửi xác minh lại. Tài khoản u-vendor-2 "Studio Mây Wedding" đã xác minh
 * (để thử Gửi duyệt gói). Tài khoản NCC khác bắt đầu bằng hồ sơ trống.
 * Lĩnh vực gắn với tài khoản (Admin gán khi tạo): Mây Palace = Nhà hàng, Studio Mây = Chụp ảnh; lưu hồ sơ không đổi được.
 * Chưa có phần Admin duyệt: muốn làm lại từ đầu thì xóa khóa localStorage bên dưới.
 *
 * Tệp upload giả dùng URL.createObjectURL, chỉ xem được tới khi tải lại trang.
 */
const STORAGE_KEY = 'weddy.mock.vendorProfiles.v3'

const photo = (id: string, w = 900) => `https://images.unsplash.com/${id}?auto=format&q=80&w=${w}&fit=crop`

/** Tệp mẫu không có nội dung (url rỗng): giao diện báo "tệp mẫu, chưa xem trước được". */
const sampleFile = (fileName: string, size: number, mimeType = 'application/pdf'): VendorFile => ({
  url: '',
  publicId: `mock/sample/${fileName}`,
  fileName,
  size,
  mimeType,
})

function categoryRef(slug: string): CategoryRef | null {
  const c = mockCatalog.listCategories().find((x) => x.slug === slug)
  return c ? { id: c.id, slug: c.slug, name: c.name } : null
}

/** u-vendor-2 "Studio Mây Wedding" (theo prototype NCC): hồ sơ đã xác minh lĩnh vực Chụp ảnh, dùng để thử Gửi duyệt gói. */
function seedVerifiedStudio(): VendorProfile {
  const category = categoryRef('chup-anh')
  return {
    id: 'vp-2',
    status: 'VERIFIED',
    businessName: 'Hộ kinh doanh Studio Mây',
    taxCode: '0318765432',
    representativeName: 'Nguyễn Minh Phương',
    category,
    verifiedCategory: category,
    province: PROVINCE,
    district: 'Cầu Giấy',
    address: '12 Trần Thái Tông',
    googleMapsUrl: null,
    businessHours: { fromDay: 'MONDAY', toDay: 'SUNDAY', openTime: '09:00', closeTime: '21:00' },
    documents: [
      { type: 'BUSINESS_LICENSE', ...sampleFile('GPKD-StudioMay.pdf', 500_000) },
      { type: 'FIRE_SAFETY', ...sampleFile('PCCC-StudioMay.pdf', 420_000) },
    ],
    photos: [
      { type: 'FRONT', url: photo('photo-1537633552985-df8429e8048b'), publicId: 'mock/sample/studio.jpg', fileName: 'studio.jpg', size: 300_000, mimeType: 'image/jpeg' },
    ],
    reviewNote: null,
    submittedAt: '2026-08-20T03:00:00.000Z',
    updatedAt: '2026-08-22T03:00:00.000Z',
  }
}

function seedProfile(userId: string): VendorProfile {
  const now = new Date().toISOString()
  if (userId === 'u-vendor-2') return seedVerifiedStudio()
  if (userId !== 'u-vendor-1') {
    return {
      id: `vp-${userId}`,
      status: 'NOT_SUBMITTED',
      businessName: null,
      taxCode: null,
      representativeName: null,
      category: null,
      verifiedCategory: null,
      province: PROVINCE,
      district: null,
      address: null,
      googleMapsUrl: null,
      businessHours: null,
      documents: [],
      photos: [],
      reviewNote: null,
      submittedAt: null,
      updatedAt: now,
    }
  }
  return {
    id: 'vp-1',
    status: 'NEEDS_REVISION',
    businessName: 'Công ty TNHH Mây Palace',
    taxCode: '0312345678',
    representativeName: 'Trần Thu Mây',
    category: categoryRef('nha-hang'),
    verifiedCategory: null,
    province: PROVINCE,
    district: 'Hai Bà Trưng',
    address: '128 Bà Triệu',
    googleMapsUrl: 'https://maps.app.goo.gl/mayPalaceDemo',
    businessHours: { fromDay: 'MONDAY', toDay: 'SUNDAY', openTime: '09:00', closeTime: '21:00' },
    documents: [
      { type: 'BUSINESS_LICENSE', ...sampleFile('GPKD-MayPalace.pdf', 820_000) },
      { type: 'FIRE_SAFETY', ...sampleFile('PCCC-2024.pdf', 610_000) },
    ],
    photos: [
      { type: 'FRONT', url: photo('photo-1519167758481-83f550bb49b3'), publicId: 'mock/sample/mat-tien.jpg', fileName: 'mat-tien.jpg', size: 412_000, mimeType: 'image/jpeg' },
    ],
    reviewNote: 'Giấy PCCC đã hết hạn, vui lòng tải bản còn hiệu lực. Bổ sung giấy ATTP của bếp trung tâm.',
    submittedAt: '2026-10-10T02:30:00.000Z',
    updatedAt: '2026-10-12T08:15:00.000Z',
  }
}

function load(): Record<string, VendorProfile> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, VendorProfile>
  } catch {
    return {}
  }
}

const save = (data: Record<string, VendorProfile>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // bỏ qua
  }
}

function getOrSeed(userId: string) {
  const data = load()
  data[userId] ??= seedProfile(userId)
  return { data, profile: data[userId] }
}

/** Ghi các trường của request vào hồ sơ, kiểm tra như BE (409 khi đang khóa). Lĩnh vực giữ nguyên, có gửi kèm cũng bỏ qua. */
function apply(profile: VendorProfile, req: UpdateVendorProfileRequest): VendorProfile {
  if (isProfileLocked(profile.status)) {
    throw new ApiError(409, 'VENDOR_PROFILE_LOCKED', 'Hồ sơ đang chờ duyệt hoặc đã xác minh nên không sửa được.')
  }
  const { categoryId: _ignored, ...fields } = req as UpdateVendorProfileRequest & { categoryId?: unknown }
  return { ...profile, ...fields, category: profile.category, verifiedCategory: profile.verifiedCategory, updatedAt: new Date().toISOString() }
}

/** Kiểm tra đủ điều kiện gửi xác minh (bản rút gọn của luật BE). */
function assertSubmittable(p: VendorProfile) {
  const missing: string[] = []
  if (!p.category) throw new ApiError(400, 'VALIDATION_ERROR', 'Tài khoản chưa được gán lĩnh vực. Liên hệ WebPlan.')
  if (!p.businessName || !p.taxCode || !p.representativeName || !p.address || !p.district) missing.push('thông tin doanh nghiệp')
  const slug = p.category?.slug
  if (documentSlotsOf(slug).some((s) => !p.documents.some((d) => d.type === s.type))) missing.push('giấy tờ')
  if (photosRequired(slug) && photoSlotsOf(slug).some((s) => !p.photos.some((x) => x.type === s.type))) missing.push('ảnh cơ sở')
  if (missing.length) throw new ApiError(400, 'VALIDATION_ERROR', `Hồ sơ còn thiếu ${missing.join(', ')}.`)
}

export const mockVendors = {
  getMyProfile(userId: string): VendorProfile {
    const { data, profile } = getOrSeed(userId)
    save(data)
    return profile
  },

  updateMyProfile(userId: string, req: UpdateVendorProfileRequest): VendorProfile {
    const { data, profile } = getOrSeed(userId)
    const next = apply(profile, req)
    data[userId] = next
    save(data)
    return next
  },

  submitMyProfile(userId: string, req: UpdateVendorProfileRequest): VendorProfile {
    const { data, profile } = getOrSeed(userId)
    const next = apply(profile, req)
    assertSubmittable(next)
    const now = new Date().toISOString()
    data[userId] = { ...next, status: 'PENDING', submittedAt: now, updatedAt: now }
    save(data)
    return data[userId]
  },

  uploadFile(file: File, purpose: VendorUploadPurpose): VendorFile {
    return {
      url: URL.createObjectURL(file),
      publicId: `mock/${purpose.toLowerCase()}/${Date.now()}-${file.name}`,
      fileName: file.name,
      size: file.size,
      mimeType: file.type,
    }
  },
}

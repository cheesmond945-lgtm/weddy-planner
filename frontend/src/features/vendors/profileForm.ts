import type { Category } from '@/types/catalog'
import type {
  UpdateVendorProfileRequest,
  VendorDocument,
  VendorDocumentType,
  VendorPhoto,
  VendorPhotoType,
  VendorProfile,
  Weekday,
} from '@/types/vendor'
import { DISTRICTS, documentSlotsOf, photoSlotsOf, photosRequired } from './constants'

/** Giá trị đang sửa trên form Hồ sơ. Ô trống là chuỗi rỗng; đổi sang null khi gửi lên (toRequest). */
export interface ProfileFormValues {
  businessName: string
  taxCode: string
  representativeName: string
  categoryId: string
  district: string
  address: string
  googleMapsUrl: string
  hours: { fromDay: Weekday | ''; toDay: Weekday | ''; openTime: string; closeTime: string }
  documents: VendorDocument[]
  photos: VendorPhoto[]
}

export type ProfileErrorKey =
  | 'businessName'
  | 'taxCode'
  | 'representativeName'
  | 'categoryId'
  | 'district'
  | 'address'
  | 'googleMapsUrl'
  | 'hours'
  | `document:${VendorDocumentType}`
  | `photo:${VendorPhotoType}`

export type ProfileErrors = Partial<Record<ProfileErrorKey, string>>

export function toFormValues(p: VendorProfile): ProfileFormValues {
  return {
    businessName: p.businessName ?? '',
    taxCode: p.taxCode ?? '',
    representativeName: p.representativeName ?? '',
    categoryId: p.category?.id ?? '',
    district: p.district ?? '',
    address: p.address ?? '',
    googleMapsUrl: p.googleMapsUrl ?? '',
    hours: p.businessHours ?? { fromDay: '', toDay: '', openTime: '', closeTime: '' },
    documents: p.documents,
    photos: p.photos,
  }
}

const orNull = (s: string) => s.trim() || null

export function toRequest(v: ProfileFormValues): UpdateVendorProfileRequest {
  const { fromDay, toDay, openTime, closeTime } = v.hours
  return {
    businessName: orNull(v.businessName),
    taxCode: orNull(v.taxCode),
    representativeName: orNull(v.representativeName),
    categoryId: v.categoryId || null,
    district: v.district || null,
    address: orNull(v.address),
    googleMapsUrl: orNull(v.googleMapsUrl),
    businessHours: fromDay && toDay && openTime && closeTime ? { fromDay, toDay, openTime, closeTime } : null,
    documents: v.documents,
    photos: v.photos,
  }
}

/** Đổi lĩnh vực: bỏ giấy tờ và ảnh không còn thuộc bộ của lĩnh vực mới. */
export function changeCategory(v: ProfileFormValues, next: Category): ProfileFormValues {
  const docTypes = documentSlotsOf(next.slug).map((s) => s.type)
  const photoTypes = photoSlotsOf(next.slug).map((s) => s.type)
  return {
    ...v,
    categoryId: next.id,
    documents: v.documents.filter((d) => docTypes.includes(d.type)),
    photos: v.photos.filter((p) => photoTypes.includes(p.type)),
  }
}

/** Nhãn các mục đã có tệp sẽ bị bỏ khi đổi sang lĩnh vực mới (để hỏi lại người dùng). */
export function filesLostOnCategoryChange(v: ProfileFormValues, currentSlug: string | undefined, nextSlug: string) {
  const nextDocs = documentSlotsOf(nextSlug).map((s) => s.type)
  const nextPhotos = photoSlotsOf(nextSlug).map((s) => s.type)
  return [
    ...documentSlotsOf(currentSlug).filter((s) => !nextDocs.includes(s.type) && v.documents.some((d) => d.type === s.type)),
    ...photoSlotsOf(currentSlug).filter((s) => !nextPhotos.includes(s.type) && v.photos.some((p) => p.type === s.type)),
  ].map((s) => s.label)
}

// Quy tắc và câu báo lỗi lấy theo prototype NCC (hàm kiểm tra hồ sơ)
const TAX_CODE_RE = /^\d{10}(-?\d{3})?$/
const MAPS_URL_RE = /^https:\/\/((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)\S*$/i

function checkOptional(v: ProfileFormValues, errors: ProfileErrors) {
  const url = v.googleMapsUrl.trim()
  if (url && !MAPS_URL_RE.test(url)) errors.googleMapsUrl = 'Link Google Maps chưa hợp lệ (vd: https://maps.app.goo.gl/…).'

  const { fromDay, toDay, openTime, closeTime } = v.hours
  const filled = [fromDay, toDay, openTime, closeTime].filter(Boolean).length
  if (filled > 0 && filled < 4) errors.hours = 'Chọn đủ Từ ngày, Đến ngày, giờ mở và giờ đóng cửa (hoặc để trống cả nhóm).'
  else if (filled === 4 && closeTime <= openTime) errors.hours = 'Giờ đóng cửa phải sau giờ mở cửa.'
}

/**
 * Kiểm tra hồ sơ.
 * - 'draft' (Lưu nháp): chỉ chặn link Google Maps và giờ hoạt động sai, còn lại được để trống.
 * - 'submit' (Gửi xác minh): đủ trường bắt buộc, giấy tờ và ảnh theo lĩnh vực.
 */
export function validateProfile(v: ProfileFormValues, categorySlug: string | undefined, mode: 'draft' | 'submit'): ProfileErrors {
  const errors: ProfileErrors = {}
  checkOptional(v, errors)
  if (mode === 'draft') return errors

  const required: [keyof ProfileFormValues & ProfileErrorKey, string][] = [
    ['businessName', 'tên doanh nghiệp'],
    ['taxCode', 'mã số thuế'],
    ['representativeName', 'tên người đại diện'],
    ['address', 'địa chỉ cụ thể'],
  ]
  for (const [key, label] of required) {
    if (!String(v[key]).trim()) errors[key] = `Nhập ${label}.`
  }
  if (v.taxCode.trim() && !TAX_CODE_RE.test(v.taxCode.trim())) errors.taxCode = 'Mã số thuế gồm 10 chữ số (hoặc 10 + 3 số chi nhánh).'
  if (!v.categoryId) errors.categoryId = 'Chọn lĩnh vực cung cấp.'
  if (!v.district) errors.district = 'Chọn quận.'
  else if (!DISTRICTS.includes(v.district)) errors.district = 'Quận không thuộc danh mục, chọn lại từ danh sách.'

  for (const slot of documentSlotsOf(categorySlug)) {
    if (!v.documents.some((d) => d.type === slot.type)) errors[`document:${slot.type}`] = `Cần tải lên: ${slot.label}.`
  }
  if (photosRequired(categorySlug)) {
    for (const slot of photoSlotsOf(categorySlug)) {
      if (!v.photos.some((p) => p.type === slot.type)) errors[`photo:${slot.type}`] = `Cần tải lên: ${slot.label}.`
    }
  }
  return errors
}

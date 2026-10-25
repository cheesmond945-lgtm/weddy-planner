import type { UpdateVendorProfileRequest, VendorDocument, VendorDocumentType, VendorPhoto, VendorProfile } from '@/types/vendor'
import { documentSlotsOf, photosRequired } from './constants'

/** Giá trị đang sửa trên form Hồ sơ. Ô trống là chuỗi rỗng; đổi sang null khi gửi lên (toRequest). Lĩnh vực chỉ đọc nên không có ở đây. */
export interface ProfileFormValues {
  businessName: string
  taxCode: string
  representativeName: string
  province: string
  ward: string
  address: string
  googleMapsUrl: string
  openTime: string
  closeTime: string
  description: string
  documents: VendorDocument[]
  photos: VendorPhoto[]
}

export type ProfileErrorKey =
  | 'businessName'
  | 'taxCode'
  | 'representativeName'
  | 'categoryId'
  | 'province'
  | 'ward'
  | 'address'
  | 'googleMapsUrl'
  | 'openTime'
  | 'closeTime'
  | 'description'
  | 'photos'
  | `document:${VendorDocumentType}`

export type ProfileErrors = Partial<Record<ProfileErrorKey, string>>

export const MAX_DESCRIPTION = 3000

export function toFormValues(p: VendorProfile): ProfileFormValues {
  return {
    businessName: p.businessName ?? '',
    taxCode: p.taxCode ?? '',
    representativeName: p.representativeName ?? '',
    province: p.province ?? '',
    ward: p.ward ?? '',
    address: p.address ?? '',
    googleMapsUrl: p.googleMapsUrl ?? '',
    openTime: p.openTime ?? '',
    closeTime: p.closeTime ?? '',
    description: p.description ?? '',
    documents: p.documents,
    photos: p.photos,
  }
}

const orNull = (s: string) => s.trim() || null

export function toRequest(v: ProfileFormValues): UpdateVendorProfileRequest {
  return {
    businessName: orNull(v.businessName),
    taxCode: orNull(v.taxCode),
    representativeName: orNull(v.representativeName),
    province: orNull(v.province),
    ward: orNull(v.ward),
    address: orNull(v.address),
    googleMapsUrl: orNull(v.googleMapsUrl),
    openTime: orNull(v.openTime),
    closeTime: orNull(v.closeTime),
    description: orNull(v.description),
    documents: v.documents,
    photos: v.photos,
  }
}

// Quy tắc và câu báo lỗi lấy theo prototype NCC (hàm kiểm tra hồ sơ)
const TAX_CODE_RE = /^\d{10}(-?\d{3})?$/
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/
const MAPS_URL_RE = /^https:\/\/((www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|goo\.gl\/maps)\S*$/i

/** Giới thiệu, giờ làm việc, link Google Maps: luôn kiểm tra định dạng, kể cả khi lưu nháp. */
function checkDisplay(v: ProfileFormValues, errors: ProfileErrors) {
  const url = v.googleMapsUrl.trim()
  if (url && !MAPS_URL_RE.test(url)) errors.googleMapsUrl = 'Link Google Maps chưa hợp lệ (vd: https://maps.app.goo.gl/…).'
  const open = v.openTime.trim()
  const close = v.closeTime.trim()
  if (open && !TIME_RE.test(open)) errors.openTime = 'Giờ có dạng HH:mm, ví dụ 08:30.'
  if (close && !TIME_RE.test(close)) errors.closeTime = 'Giờ có dạng HH:mm, ví dụ 21:00.'
  if (open && !close) errors.closeTime ??= 'Nhập giờ đóng cửa.'
  if (close && !open) errors.openTime ??= 'Nhập giờ mở cửa.'
  if (!errors.openTime && !errors.closeTime && open && close && close.padStart(5, '0') <= open.padStart(5, '0')) errors.closeTime = 'Giờ đóng cửa phải sau giờ mở cửa.'
  if (v.description.trim().length > MAX_DESCRIPTION) errors.description = `Tối đa ${MAX_DESCRIPTION} ký tự.`
}

/**
 * Kiểm tra hồ sơ.
 * - 'draft' (Lưu nháp, Lưu): chỉ chặn link Google Maps, giờ làm việc và giới thiệu sai, còn lại được để trống.
 * - 'submit' (Gửi xác minh, Gửi cập nhật): đủ trường bắt buộc, giấy tờ và ảnh theo lĩnh vực (categorySlug: lĩnh vực của tài khoản).
 */
export function validateProfile(v: ProfileFormValues, categorySlug: string | undefined, mode: 'draft' | 'submit'): ProfileErrors {
  const errors: ProfileErrors = {}
  checkDisplay(v, errors)
  if (mode === 'draft') return errors

  const required: [keyof ProfileFormValues & ProfileErrorKey, string][] = [
    ['businessName', 'tên doanh nghiệp'],
    ['taxCode', 'mã số thuế'],
    ['representativeName', 'tên người đại diện'],
    ['address', 'địa chỉ cụ thể'],
    ['province', 'tỉnh/thành phố'],
    ['ward', 'phường/xã'],
  ]
  for (const [key, label] of required) {
    if (!String(v[key]).trim()) errors[key] = `Nhập ${label}.`
  }
  if (v.taxCode.trim() && !TAX_CODE_RE.test(v.taxCode.trim())) errors.taxCode = 'Mã số thuế gồm 10 chữ số (hoặc 10 + 3 số chi nhánh).'
  if (!categorySlug) errors.categoryId = 'Tài khoản chưa được gán lĩnh vực. Liên hệ WebPlan.'

  for (const slot of documentSlotsOf(categorySlug)) {
    if (slot.required && !v.documents.some((d) => d.type === slot.type)) errors[`document:${slot.type}`] = `Cần tải lên: ${slot.label}.`
  }
  if (photosRequired(categorySlug) && !v.photos.length) errors.photos = 'Cần tải lên ít nhất một ảnh cơ sở.'
  return errors
}

/** Link tìm kiếm Google Maps từ địa chỉ cụ thể, phường/xã, tỉnh/thành phố; null khi chưa nhập đủ. Không cần API key. */
export function mapsUrlFromAddress(v: Pick<ProfileFormValues, 'address' | 'ward' | 'province'>): string | null {
  const parts = [v.address, v.ward, v.province].map((x) => x.trim())
  if (parts.some((x) => !x)) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(', '))}`
}

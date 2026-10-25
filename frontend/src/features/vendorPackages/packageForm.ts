import type { VendorFile } from '@/types/vendor'
import type { SavePackageRequest, VendorPackage } from '@/types/vendorPackage'

/** Giá trị đang sửa trên form gói. Giá và sức chứa 0 nghĩa là chưa nhập (ô tiền MoneyInput dùng 0 cho ô trống). */
export interface PackageFormValues {
  name: string
  description: string
  tags: string[]
  price: number
  capacity: string
  photos: VendorFile[]
}

export type PackageErrorKey = 'name' | 'description' | 'price' | 'capacity' | 'photos' | 'permission'
export type PackageErrors = Partial<Record<PackageErrorKey, string>>

export const EMPTY_PACKAGE: PackageFormValues = {
  name: '',
  description: '',
  tags: [],
  price: 0,
  capacity: '',
  photos: [],
}

export function toFormValues(p: VendorPackage): PackageFormValues {
  return {
    name: p.name,
    description: p.description,
    tags: p.tags,
    price: p.price,
    capacity: p.capacity ? String(p.capacity) : '',
    photos: p.photos,
  }
}

export function toRequest(v: PackageFormValues, venue: boolean): SavePackageRequest {
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    price: v.price,
    tags: v.tags,
    capacity: venue && v.capacity.trim() ? Number(v.capacity) : null,
    photos: v.photos,
    // Ảnh đầu tiên là ảnh đại diện của gói
    coverPublicId: v.photos[0]?.publicId ?? null,
  }
}

/** Viết hoa chữ cái đầu của tag, phần còn lại giữ nguyên ("tiệc cưới" -> "Tiệc cưới"). */
export const capitalizeTag = (t: string) => t.charAt(0).toLocaleUpperCase('vi') + t.slice(1)

/** Thêm tag (bỏ khoảng trắng thừa, viết hoa chữ cái đầu, không trùng không phân biệt hoa thường). */
export function addTag(tags: string[], raw: string) {
  const t = capitalizeTag(raw.replace(/\s+/g, ' ').trim())
  return !t || tags.some((x) => x.toLowerCase() === t.toLowerCase()) ? tags : [...tags, t]
}

/**
 * Kiểm tra gói (như prototype NCC).
 * - 'draft' (Lưu nháp): cần tên gói và giá; sức chứa nếu đã nhập thì phải hợp lệ.
 * - 'submit' (Gửi duyệt): thêm mô tả, ít nhất một ảnh, và hồ sơ đã xác minh đúng lĩnh vực.
 */
export function validatePackage(v: PackageFormValues, opts: { mode: 'draft' | 'submit'; venue: boolean; canSubmit: boolean }): PackageErrors {
  const errors: PackageErrors = {}
  if (!v.name.trim()) errors.name = 'Nhập tên gói.'
  if (!v.price) errors.price = 'Nhập giá.'
  if (opts.venue && v.capacity.trim() && !(Number.isInteger(Number(v.capacity)) && Number(v.capacity) > 0)) {
    errors.capacity = 'Sức chứa là số nguyên dương.'
  }
  if (opts.mode === 'draft') return errors

  if (!opts.canSubmit) errors.permission = 'Hồ sơ nhà cung cấp chưa được duyệt nên chưa gửi duyệt được gói.'
  if (!v.description.trim()) errors.description = 'Nhập mô tả.'
  if (!v.photos.length) errors.photos = 'Cần ít nhất một ảnh dịch vụ.'
  return errors
}

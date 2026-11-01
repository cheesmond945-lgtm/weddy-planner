import type { VendorFile } from '@/types/vendor'
import type { SavePackageRequest, VendorPackage } from '@/types/vendorPackage'

/** Giá trị đang sửa trên form gói. Giá và sức chứa 0 nghĩa là chưa nhập (ô tiền MoneyInput dùng 0 cho ô trống). */
export interface PackageFormValues {
  name: string
  description: string
  tags: string[]
  price: number
  capacity: string
  /** Nhà hàng: TABLE (giá một bàn) hoặc PACKAGE (trọn gói). Hạng mục khác luôn PACKAGE */
  unit: 'TABLE' | 'PACKAGE'
  /** Số bàn tối thiểu (chỉ gói tính theo bàn), chuỗi rỗng là không yêu cầu */
  minTables: string
  photos: VendorFile[]
  coverPublicId: string | null
}

export type PackageErrorKey = 'name' | 'description' | 'price' | 'capacity' | 'minTables' | 'photos' | 'permission'
export type PackageErrors = Partial<Record<PackageErrorKey, string>>

export const EMPTY_PACKAGE: PackageFormValues = {
  name: '',
  description: '',
  tags: [],
  price: 0,
  capacity: '',
  unit: 'TABLE',
  minTables: '',
  photos: [],
  coverPublicId: null,
}

export function toFormValues(p: VendorPackage): PackageFormValues {
  return {
    name: p.name,
    description: p.description,
    tags: p.tags,
    price: p.price,
    capacity: p.capacity ? String(p.capacity) : '',
    unit: p.pricingUnit ?? 'TABLE',
    minTables: p.minTables ? String(p.minTables) : '',
    photos: p.photos,
    coverPublicId: p.coverPublicId,
  }
}

export function toRequest(v: PackageFormValues, venue: boolean): SavePackageRequest {
  const cover = v.photos.some((p) => p.publicId === v.coverPublicId) ? v.coverPublicId : (v.photos[0]?.publicId ?? null)
  return {
    name: v.name.trim(),
    description: v.description.trim() || null,
    price: v.price,
    tags: v.tags,
    capacity: venue && v.capacity.trim() ? Number(v.capacity) : null,
    unit: venue ? v.unit : 'PACKAGE',
    minTables: venue && v.unit === 'TABLE' && v.minTables.trim() ? Number(v.minTables) : null,
    photos: v.photos,
    coverPublicId: cover,
  }
}

/** Thêm tag (bỏ khoảng trắng thừa, không trùng không phân biệt hoa thường). */
export function addTag(tags: string[], raw: string) {
  const t = raw.replace(/\s+/g, ' ').trim()
  return !t || tags.some((x) => x.toLowerCase() === t.toLowerCase()) ? tags : [...tags, t]
}

/**
 * Kiểm tra gói (như prototype NCC).
 * - 'draft' (Lưu nháp): chỉ cần tên gói; sức chứa nếu đã nhập thì phải hợp lệ.
 * - 'submit' (Gửi duyệt): thêm mô tả, giá, ít nhất một ảnh, và hồ sơ đã xác minh đúng lĩnh vực.
 */
export function validatePackage(v: PackageFormValues, opts: { mode: 'draft' | 'submit'; venue: boolean; canSubmit: boolean }): PackageErrors {
  const errors: PackageErrors = {}
  if (!v.name.trim()) errors.name = 'Nhập tên gói.'
  if (opts.venue && v.capacity.trim() && !(Number.isInteger(Number(v.capacity)) && Number(v.capacity) > 0)) {
    errors.capacity = 'Sức chứa là số nguyên dương.'
  }
  if (opts.venue && v.unit === 'TABLE' && v.minTables.trim() && !(Number.isInteger(Number(v.minTables)) && Number(v.minTables) >= 1 && Number(v.minTables) <= 500)) {
    errors.minTables = 'Số bàn tối thiểu là số nguyên từ 1 đến 500.'
  }
  if (opts.mode === 'draft') return errors

  if (!opts.canSubmit) errors.permission = 'Hồ sơ nhà cung cấp chưa được xác minh cho lĩnh vực này. Bạn vẫn có thể lưu nháp.'
  if (!v.description.trim()) errors.description = 'Nhập mô tả ngắn.'
  if (!v.price) errors.price = 'Nhập giá.'
  if (!v.photos.length) errors.photos = 'Cần ít nhất một ảnh dịch vụ.'
  return errors
}

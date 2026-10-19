import { ApiError } from '@/api/client'
import { canSubmitPackage, packageCategoryOf } from '@/features/vendorPackages/constants'
import type { CategoryRef } from '@/types/catalog'
import type { VendorFile } from '@/types/vendor'
import type { PackageStatus, SavePackageRequest, VendorPackage } from '@/types/vendorPackage'
import { mockCatalog } from './catalog'
import { mockVendors } from './vendors'

/*
 * Gói dịch vụ giả của NCC, lưu theo từng tài khoản NCC trong localStorage.
 * Tài khoản u-vendor-1 có 4 gói "Mây Palace" chép từ prototype NCC (đủ 4 trạng thái).
 * Hồ sơ mẫu của u-vendor-1 đang Cần bổ sung nên chưa gửi duyệt được (như prototype khi hồ sơ chưa xác minh).
 * Chưa có phần Admin duyệt: muốn làm lại từ đầu thì xóa khóa localStorage bên dưới.
 */
const STORAGE_KEY = 'weddy.mock.vendorPackages'

const photo = (id: string, name: string, crop = ''): VendorFile => ({
  url: `https://images.unsplash.com/${id}?auto=format&q=80&w=900&h=640&fit=crop${crop}`,
  publicId: `mock/sample/${name}`,
  fileName: name,
  size: 480_000,
  mimeType: 'image/jpeg',
})
const HALL = 'photo-1519167758481-83f550bb49b3'
const FEAST = 'photo-1414235077428-338989a2e8c0'
const DECOR = 'photo-1519225421980-715cb0215aed'
const zoom = (x: number, y: number) => `&crop=focalpoint&fp-x=${x}&fp-y=${y}&fp-z=1.7`

function categoryRef(slug: string): CategoryRef {
  const c = mockCatalog.listCategories().find((x) => x.slug === slug)!
  return { id: c.id, slug: c.slug, name: c.name }
}

function seed(userId: string): VendorPackage[] {
  if (userId !== 'u-vendor-1') return []
  const category = categoryRef('nha-hang')
  const base = { category, note: null, capacity: null, coverPublicId: null }
  return [
    {
      ...base,
      id: 'DV101',
      name: 'Tiệc cưới – Menu A',
      description:
        'Tiệc cưới tại sảnh Mây với thực đơn 8 món Menu A, bao gồm trang trí sân khấu cơ bản, âm thanh ánh sáng và đội ngũ phục vụ trọn buổi.',
      tags: ['Tiệc cưới', 'Menu A', 'Trọn gói'],
      price: 3_500_000,
      maxPrice: 4_500_000,
      capacity: 500,
      note: 'Giá tính theo bàn 10 khách, chưa gồm đồ uống.',
      photos: [photo(HALL, 'sanh-may-toi.jpg'), photo(HALL, 'san-khau.jpg', zoom(0.2, 0.3)), photo(FEAST, 'ban-tiec.jpg'), photo(HALL, 'loi-di.jpg', zoom(0.8, 0.7))],
      status: 'PUBLISHED',
      updatedAt: '2026-10-08T03:00:00.000Z',
    },
    {
      ...base,
      id: 'DV102',
      name: 'Cho thuê sảnh trống',
      description: 'Thuê sảnh Ngân Hà để tự tổ chức tiệc, bao gồm bàn ghế, âm thanh cơ bản và thời gian sử dụng 5 giờ.',
      tags: ['Cho thuê sảnh trống', 'Tiệc 300 khách'],
      price: 30_000_000,
      maxPrice: 45_000_000,
      capacity: 300,
      photos: [photo(HALL, 'sanh-ngan-ha.jpg', zoom(0.6, 0.4)), photo(FEAST, 'sanh-ngan-ha-2.jpg', zoom(0.3, 0.6))],
      status: 'PENDING',
      updatedAt: '2026-10-15T03:00:00.000Z',
    },
    {
      ...base,
      id: 'DV103',
      name: 'Tiệc cưới – Menu B',
      description: '',
      tags: ['Menu B'],
      price: null,
      maxPrice: null,
      photos: [],
      status: 'DRAFT',
      updatedAt: '2026-10-16T03:00:00.000Z',
    },
    {
      ...base,
      id: 'DV104',
      name: 'Tiệc ngoài trời sân vườn',
      description: 'Tiệc cưới ngoài trời tại sân vườn với đèn dây, sân khấu nhỏ và thực đơn buffet.',
      tags: ['Sảnh ngoài trời', 'Tiệc cưới'],
      price: 2_800_000,
      maxPrice: 3_800_000,
      capacity: 200,
      note: 'Phụ thuộc thời tiết, có phương án mái che.',
      photos: [photo(DECOR, 'san-vuon.jpg'), photo(DECOR, 'san-vuon-2.jpg', zoom(0.7, 0.3))],
      status: 'HIDDEN',
      updatedAt: '2026-09-20T03:00:00.000Z',
    },
  ]
}

function load(): Record<string, VendorPackage[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, VendorPackage[]>
  } catch {
    return {}
  }
}

const save = (data: Record<string, VendorPackage[]>) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // bỏ qua
  }
}

/** Đọc danh sách gói của NCC, lần đầu thì tạo dữ liệu mẫu. mutate trả về giá trị cần trả cho API. */
function withPackages<T>(userId: string, mutate: (list: VendorPackage[]) => T): T {
  const data = load()
  data[userId] ??= seed(userId)
  const result = mutate(data[userId])
  save(data)
  return result
}

function find(list: VendorPackage[], id: string) {
  const p = list.find((x) => x.id === id)
  if (!p) throw new ApiError(404, 'PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.')
  return p
}

function changeStatus(p: VendorPackage, from: PackageStatus, to: PackageStatus) {
  if (p.status !== from) throw new ApiError(409, 'CONFLICT', 'Trạng thái gói đã thay đổi, vui lòng tải lại trang.')
  p.status = to
  p.updatedAt = new Date().toISOString()
  return { ...p }
}

/** Ghi các trường của request, kiểm tra như BE. */
function apply(p: VendorPackage, req: SavePackageRequest) {
  if (!req.name.trim()) throw new ApiError(400, 'VALIDATION_ERROR', 'Nhập tên gói.')
  if (req.price !== null && req.maxPrice !== null && req.maxPrice < req.price) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Giá tối đa phải ≥ giá tối thiểu.')
  }
  Object.assign(p, {
    ...req,
    description: req.description ?? '',
    capacity: p.category.slug === 'nha-hang' ? req.capacity : null,
    updatedAt: new Date().toISOString(),
  })
}

export const mockVendorPackages = {
  list(userId: string): VendorPackage[] {
    return withPackages(userId, (list) => [...list])
  },

  get(userId: string, id: string): VendorPackage {
    return withPackages(userId, (list) => ({ ...find(list, id) }))
  },

  create(userId: string, req: SavePackageRequest): VendorPackage {
    const category = packageCategoryOf(mockVendors.getMyProfile(userId))
    if (!category) {
      throw new ApiError(422, 'VENDOR_CATEGORY_REQUIRED', 'Chọn lĩnh vực cung cấp trong Hồ sơ nhà cung cấp trước khi tạo gói.')
    }
    return withPackages(userId, (list) => {
      // Gồm cả list hiện tại (dữ liệu mẫu có thể chưa được lưu) để không trùng id
      const all = [...list, ...Object.values(load()).flat()]
      const n = Math.max(100, ...all.map((x) => Number(x.id.replace(/\D/g, '')) || 0)) + 1
      const p = { id: `DV${n}`, category, status: 'DRAFT' } as VendorPackage
      apply(p, req)
      list.push(p)
      return { ...p }
    })
  },

  update(userId: string, id: string, req: SavePackageRequest): VendorPackage {
    return withPackages(userId, (list) => {
      const p = find(list, id)
      if (p.status !== 'DRAFT') throw new ApiError(409, 'PACKAGE_NOT_EDITABLE', 'Gói không còn ở trạng thái Bản nháp nên không thể lưu đè.')
      apply(p, req)
      return { ...p }
    })
  },

  remove(userId: string, id: string) {
    withPackages(userId, (list) => {
      const p = find(list, id)
      if (p.status !== 'DRAFT') throw new ApiError(409, 'PACKAGE_NOT_EDITABLE', 'Chỉ xóa được gói ở trạng thái Bản nháp.')
      list.splice(list.indexOf(p), 1)
    })
  },

  submit(userId: string, id: string): VendorPackage {
    const profile = mockVendors.getMyProfile(userId)
    return withPackages(userId, (list) => {
      const p = find(list, id)
      if (!canSubmitPackage(profile, p.category)) {
        throw new ApiError(409, 'VENDOR_NOT_VERIFIED', 'Hồ sơ nhà cung cấp chưa được xác minh cho lĩnh vực này.')
      }
      if (!p.description || p.price === null || p.maxPrice === null || !p.photos.length) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Gói còn thiếu mô tả, giá hoặc ảnh.')
      }
      return changeStatus(p, 'DRAFT', 'PENDING')
    })
  },

  hide(userId: string, id: string): VendorPackage {
    return withPackages(userId, (list) => changeStatus(find(list, id), 'PUBLISHED', 'HIDDEN'))
  },

  republish(userId: string, id: string): VendorPackage {
    return withPackages(userId, (list) => changeStatus(find(list, id), 'HIDDEN', 'PUBLISHED'))
  },
}

import { useSearchParams } from 'react-router'
import { PACKAGE_STATUSES, type PackageStatus, type VendorPackage } from '@/types/vendorPackage'

export const SORTS = [
  { value: 'updated', label: 'Mới cập nhật' },
  { value: 'price-asc', label: 'Giá tăng dần' },
  { value: 'price-desc', label: 'Giá giảm dần' },
] as const
export type PackageSort = (typeof SORTS)[number]['value']

export interface PackageFilters {
  /** '' là tab Tất cả */
  status: PackageStatus | ''
  q: string
  tags: string[]
  sort: PackageSort
  /** Trang hiện tại của danh sách (từ 1) */
  page: number
}

/** Tìm theo tên gói hoặc tag, không phân biệt hoa thường. */
const matchesQuery = (p: VendorPackage, q: string) => {
  const k = q.trim().toLowerCase()
  return !k || p.name.toLowerCase().includes(k) || p.tags.some((t) => t.toLowerCase().includes(k))
}

/** Gói khớp từ khóa và tag (chưa lọc theo tab), dùng để đếm số trên từng tab. */
export function matchPackages(list: VendorPackage[], f: Pick<PackageFilters, 'q' | 'tags'>) {
  return list.filter((p) => matchesQuery(p, f.q) && (!f.tags.length || p.tags.some((t) => f.tags.includes(t))))
}

/** Lọc theo tab rồi sắp xếp. Sắp theo giá dùng giá tối thiểu, gói chưa có giá xếp cuối. */
export function sortPackages(list: VendorPackage[], f: Pick<PackageFilters, 'status' | 'sort'>) {
  return list
    .filter((p) => !f.status || p.status === f.status)
    .sort((a, b) => {
      if (f.sort === 'updated') return b.updatedAt.localeCompare(a.updatedAt)
      if (a.price === null) return 1
      if (b.price === null) return -1
      return f.sort === 'price-asc' ? a.price - b.price : b.price - a.price
    })
}

/** Tất cả tag đang dùng, xếp theo bảng chữ cái tiếng Việt. */
export const allTagsOf = (list: VendorPackage[]) => [...new Set(list.flatMap((p) => p.tags))].sort((a, b) => a.localeCompare(b, 'vi'))

/** Bộ lọc nằm trên URL (?status=&q=&tags=a,b&sort=&trang=) để quay lại từ trang chi tiết vẫn giữ nguyên. */
export function usePackageFilters() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') as PackageStatus | null
  const sort = params.get('sort') as PackageSort | null
  const filters: PackageFilters = {
    status: status && PACKAGE_STATUSES.includes(status) ? status : '',
    q: params.get('q') ?? '',
    tags: params.get('tags')?.split(',').filter(Boolean) ?? [],
    sort: sort && SORTS.some((s) => s.value === sort) ? sort : 'updated',
    page: Math.max(1, Number(params.get('trang')) || 1),
  }

  function update(patch: Partial<PackageFilters>) {
    // Đổi bộ lọc thì về trang 1; chỉ đổi trang thì giữ bộ lọc
    const next = { ...filters, ...patch, page: patch.page ?? 1 }
    const p = new URLSearchParams()
    if (next.status) p.set('status', next.status)
    if (next.q) p.set('q', next.q)
    if (next.tags.length) p.set('tags', next.tags.join(','))
    if (next.sort !== 'updated') p.set('sort', next.sort)
    if (next.page > 1) p.set('trang', String(next.page))
    setParams(p, { replace: true })
  }

  return { filters, update, reset: () => update({ q: '', tags: [], sort: 'updated' }) }
}

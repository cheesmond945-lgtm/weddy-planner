import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { ServiceListQuery } from '@/types/catalog'

// Mức giá như bộ lọc trong prototype. Mã mức giá chỉ dùng trên URL của FE, gửi BE dạng priceMin/priceMax.
export const PRICE_RANGES = [
  { value: 'lt10', label: 'Dưới 10 triệu', max: 10_000_000 },
  { value: '10_30', label: '10 đến 30 triệu', min: 10_000_000, max: 30_000_000 },
  { value: '30_100', label: '30 đến 100 triệu', min: 30_000_000, max: 100_000_000 },
  { value: 'gt100', label: 'Trên 100 triệu', min: 100_000_000 },
] as const satisfies readonly { value: string; label: string; min?: number; max?: number }[]

export interface ServiceFilters {
  q: string
  category: string
  location: string
  price: string
}

const KEYS: (keyof ServiceFilters)[] = ['q', 'category', 'location', 'price']

/** Bộ lọc danh sách dịch vụ lưu trên URL (?q=&category=&location=&price=), quay lại từ trang chi tiết vẫn giữ. */
export function useServiceFilters() {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<ServiceFilters>(
    () => ({
      q: params.get('q') ?? '',
      category: params.get('category') ?? '',
      location: params.get('location') ?? '',
      price: params.get('price') ?? '',
    }),
    [params],
  )

  const setFilters = useCallback(
    (patch: Partial<ServiceFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          // Đổi hạng mục thì đóng khung gợi ý AI (setCat trong prototype)
          if ('category' in patch && patch.category !== prev.get('category')) next.delete('ai')
          for (const key of KEYS) {
            if (!(key in patch)) continue
            const v = patch[key]?.trim()
            if (v) next.set(key, patch[key]!)
            else next.delete(key)
          }
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  const clearFilters = useCallback(() => setFilters({ q: '', category: '', location: '', price: '' }), [setFilters])

  return { filters, setFilters, clearFilters }
}

/** Đổi bộ lọc trên URL thành query gửi API. */
export function toServiceQuery(f: ServiceFilters): ServiceListQuery {
  const range = PRICE_RANGES.find((r) => r.value === f.price)
  return {
    q: f.q.trim() || undefined,
    category: f.category || undefined,
    location: f.location || undefined,
    priceMin: range && 'min' in range ? range.min : undefined,
    priceMax: range && 'max' in range ? range.max : undefined,
  }
}

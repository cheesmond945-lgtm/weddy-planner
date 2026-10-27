import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router'
import type { ServiceListQuery } from '@/types/catalog'

const MILLION = 1_000_000

/** Các mức giá chọn nhanh trong popover "Mức giá" (đơn vị đồng). Đổi mức giá chỉ cần sửa mảng này. */
export const PRICE_PRESETS = [
  { label: 'Dưới 10 triệu', max: 10 * MILLION },
  { label: '10 - 20 triệu', min: 10 * MILLION, max: 20 * MILLION },
  { label: '20 - 30 triệu', min: 20 * MILLION, max: 30 * MILLION },
  { label: 'Trên 30 triệu', min: 30 * MILLION },
] as const satisfies readonly { label: string; min?: number; max?: number }[]

/** Khoảng giá đang lọc (đồng). Thiếu một đầu là không giới hạn đầu đó. */
export interface PriceRange {
  min?: number
  max?: number
}

/**
 * Bộ lọc danh sách dịch vụ lưu trên URL (?q=&category=&priceMin=&priceMax=), quay lại từ trang chi tiết vẫn giữ.
 * Danh mục, mức giá, từ khóa là 3 bộ lọc cộng dồn. Không còn lọc khu vực: gõ tên quận / đường vào ô từ khóa.
 */
export interface ServiceFilters {
  q: string
  category: string
  price: PriceRange
}

const num = (v: string | null) => (v && Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : undefined)

const millions = (n: number) => (n / MILLION).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

/** Nhãn hiển thị của khoảng giá: đúng mức chọn nhanh thì dùng nhãn đó, không thì "Từ 12 triệu", "15 - 25 triệu"... */
export function priceLabel({ min, max }: PriceRange) {
  const preset = PRICE_PRESETS.find((p) => ('min' in p ? p.min : undefined) === min && ('max' in p ? p.max : undefined) === max)
  if (preset) return preset.label
  if (min !== undefined && max !== undefined) return `${millions(min)} - ${millions(max)} triệu`
  if (min !== undefined) return `Từ ${millions(min)} triệu`
  if (max !== undefined) return `Đến ${millions(max)} triệu`
  return ''
}

export const hasPrice = (p: PriceRange) => p.min !== undefined || p.max !== undefined

export function useServiceFilters() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const category = params.get('category') ?? ''
  const priceMin = num(params.get('priceMin'))
  const priceMax = num(params.get('priceMax'))

  const filters = useMemo<ServiceFilters>(() => ({ q, category, price: { min: priceMin, max: priceMax } }), [q, category, priceMin, priceMax])

  const setFilters = useCallback(
    (patch: Partial<ServiceFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          // Đổi hạng mục thì đóng khung gợi ý AI (setCat trong prototype)
          if ('category' in patch && patch.category !== prev.get('category')) next.delete('ai')
          const set = (key: string, v: string | number | undefined) => {
            if (v === undefined || v === '') next.delete(key)
            else next.set(key, String(v))
          }
          if ('q' in patch) set('q', patch.q?.trim())
          if ('category' in patch) set('category', patch.category)
          if ('price' in patch) {
            set('priceMin', patch.price?.min)
            set('priceMax', patch.price?.max)
          }
          return next
        },
        { replace: true, preventScrollReset: true },
      )
    },
    [setParams],
  )

  const clearFilters = useCallback(() => setFilters({ q: '', category: '', price: {} }), [setFilters])

  return { filters, setFilters, clearFilters }
}

/** Đổi bộ lọc trên URL thành query gửi API. */
export function toServiceQuery(f: ServiceFilters): ServiceListQuery {
  return {
    q: f.q.trim() || undefined,
    category: f.category || undefined,
    priceMin: f.price.min,
    priceMax: f.price.max,
  }
}

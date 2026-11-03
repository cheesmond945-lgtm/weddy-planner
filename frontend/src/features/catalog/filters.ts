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
 * Bộ lọc danh sách dịch vụ lưu trên URL (?q=&category=&area=&priceMin=&priceMax=), quay lại từ trang chi tiết vẫn giữ.
 * Danh mục, khu vực, mức giá, từ khóa cộng dồn (AND). Từ khóa chỉ khớp tên và mô tả; khu vực là bộ lọc cứng riêng.
 */
export interface ServiceFilters {
  q: string
  category: string
  /** Phường/xã chính thức ("Phường Đống Đa"); rỗng là chưa chọn, ALL_AREAS là người dùng chọn "Tất cả khu vực" */
  area: string
  price: PriceRange
  /** Bộ lọc AI đã hiểu từ câu gõ (tham số nl*): ưu tiên hơn dropdown; bỏ chip thì dropdown quay về giá trị người dùng đã chọn */
  nl: NlState | null
}

/** Giới hạn độ dài câu tìm kiếm, khớp QUERY_MAX_LENGTH ở backend (search.config.ts) */
export const QUERY_MAX_LENGTH = 100

/** Người dùng chủ động chọn "Tất cả khu vực" (để không chọn sẵn khu vực đám cưới lần nữa) */
export const ALL_AREAS = 'all'

export interface NlState {
  /** Câu đã gõ (hiện cạnh nhãn "Hiểu theo ngôn ngữ tự nhiên") */
  text: string
  category: string
  area: string
  styles: string[]
  price: PriceRange
}

const NL_KEYS = ['nlq', 'nlCategory', 'nlArea', 'nlStyles', 'nlMin', 'nlMax']

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
  const area = params.get('area') ?? ''
  const priceMin = num(params.get('priceMin'))
  const priceMax = num(params.get('priceMax'))

  const nlKey = NL_KEYS.map((k) => params.get(k) ?? '').join('\u0001')
  const filters = useMemo<ServiceFilters>(() => {
    const [text, nlCategory, nlArea, nlStyles, nlMin, nlMax] = nlKey.split('\u0001')
    const nl = nlKey.replace(/\u0001/g, '')
      ? { text, category: nlCategory, area: nlArea, styles: nlStyles ? nlStyles.split(',') : [], price: { min: num(nlMin), max: num(nlMax) } }
      : null
    return { q, category, area, price: { min: priceMin, max: priceMax }, nl }
  }, [q, category, area, priceMin, priceMax, nlKey])

  const setFilters = useCallback(
    (patch: Partial<ServiceFilters>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          // Đổi hạng mục, tìm kiếm hoặc lọc giá thì bỏ "Gợi ý cho bạn": danh sách xếp theo kết quả lọc
          next.delete('ai')
          // Người dùng tự chọn lại thì bỏ phần AI tương ứng; tìm câu mới thì bỏ hết bộ lọc AI cũ
          if ('q' in patch) for (const k of NL_KEYS) next.delete(k)
          if ('category' in patch) next.delete('nlCategory')
          if ('area' in patch) next.delete('nlArea')
          if ('price' in patch) {
            next.delete('nlMin')
            next.delete('nlMax')
          }
          const set = (key: string, v: string | number | undefined) => {
            if (v === undefined || v === '') next.delete(key)
            else next.set(key, String(v))
          }
          if ('q' in patch) set('q', patch.q?.trim())
          if ('category' in patch) set('category', patch.category)
          if ('area' in patch) set('area', patch.area)
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

  const clearFilters = useCallback(() => setFilters({ q: '', category: '', area: ALL_AREAS, price: {} }), [setFilters])

  /** Ghi bộ lọc AI đã hiểu lên URL (thay câu gõ): từ đây bỏ chip là lọc lại bằng GET /services, không gọi AI nữa */
  const applyNl = useCallback(
    (text: string, f: { category: string | null; area: string | null; styles: string[]; priceMin: number | null; priceMax: number | null }) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          next.delete('q')
          for (const k of NL_KEYS) next.delete(k)
          const set = (k: string, v: string | number | null | undefined) => v !== null && v !== undefined && v !== '' && next.set(k, String(v))
          set('nlq', text)
          set('nlCategory', f.category)
          set('nlArea', f.area)
          set('nlStyles', f.styles.join(','))
          set('nlMin', f.priceMin)
          set('nlMax', f.priceMax)
          return next
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  )

  /** Bỏ một chip AI (nlCategory, nlArea, nlStyles, nlPrice) hoặc bỏ hết */
  const removeNl = useCallback(
    (key: 'category' | 'area' | 'styles' | 'price' | 'all', style?: string) =>
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (key === 'all') for (const k of NL_KEYS) next.delete(k)
          if (key === 'category') next.delete('nlCategory')
          if (key === 'area') next.delete('nlArea')
          if (key === 'price') {
            next.delete('nlMin')
            next.delete('nlMax')
          }
          if (key === 'styles') {
            const rest = (next.get('nlStyles') ?? '').split(',').filter((s) => s && s !== style)
            if (rest.length) next.set('nlStyles', rest.join(','))
            else next.delete('nlStyles')
          }
          // Không còn chip nào thì bỏ luôn câu đã hiểu
          if (!['nlCategory', 'nlArea', 'nlStyles', 'nlMin', 'nlMax'].some((k) => next.get(k))) next.delete('nlq')
          return next
        },
        { replace: true, preventScrollReset: true },
      ),
    [setParams],
  )

  return { filters, setFilters, clearFilters, applyNl, removeNl }
}

/** Khu vực dropdown thực sự dùng để lọc (ALL_AREAS / rỗng là mọi khu vực) */
export const dropdownArea = (f: Pick<ServiceFilters, 'area'>) => (f.area && f.area !== ALL_AREAS ? f.area : undefined)

/**
 * Đổi bộ lọc trên URL thành query gửi API: bộ lọc AI (nl) ưu tiên hơn dropdown; không mâu thuẫn thì kết hợp AND.
 * Không gửi q: tìm theo câu gõ đi đường /services/search riêng.
 */
export function toServiceQuery(f: ServiceFilters): ServiceListQuery {
  const nlPrice = f.nl && hasPrice(f.nl.price)
  return {
    category: f.nl?.category || f.category || undefined,
    area: f.nl?.area || dropdownArea(f),
    styles: f.nl?.styles.length ? f.nl.styles.join(',') : undefined,
    priceMin: nlPrice ? f.nl!.price.min : f.price.min,
    priceMax: nlPrice ? f.nl!.price.max : f.price.max,
  }
}

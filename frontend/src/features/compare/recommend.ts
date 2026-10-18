/*
 * Đề xuất một phương án trong bảng so sánh (recommendCompare trong prototype).
 *
 * TRUNG LẬP: công thức chỉ dùng điểm Google Maps, giá và độ phù hợp với thông tin đám cưới của
 * cặp đôi. KHÔNG có bất kỳ yếu tố nào ưu tiên nhà cung cấp trả phí, quảng cáo hay hoa hồng.
 * Không thêm yếu tố như vậy vào đây.
 *
 * Hàm thuần, không phụ thuộc React hay alias "@/": FE dùng ở chế độ dữ liệu giả, BE phải tính
 * giống hệt (docs/api/compare.md). Hằng số nằm trong recommend.config.ts.
 */
import {
  BAYES_PRIOR_COUNT,
  BAYES_PRIOR_RATING,
  CAPACITY_CATEGORIES,
  CAPACITY_PENALTY,
  CATEGORY_BUDGET_SHARE,
  MAX_REASONS,
  TIE_THRESHOLD,
  WEIGHTS_NO_WEDDING,
  WEIGHTS_WITH_WEDDING,
} from './recommend.config.ts'

export interface RecommendItem {
  id: string
  /** Giá từ, đồng */
  price: number
  rating: number
  reviewCount: number
  styles: string[]
  city: string
  capacity?: number | null
}

export interface RecommendWedding {
  budget: number | null
  guestCount: number | null
  city: string | null
  styles: string[]
}

export interface Recommendation {
  /** Phương án được đề xuất; null khi ngang nhau hoặc không đủ 2 phương án */
  recommendedId: string | null
  /** Lý do ngắn (chữ thường, chưa viết hoa đầu câu), tối đa 3 */
  reasons: string[]
  isTie: boolean
}

interface Scored {
  item: RecommendItem
  score: number
  inBudget: number | null
  styleOverlap: number | null
  /** true: đủ chỗ; false: thiếu chỗ; null: không xét */
  capacityOk: boolean | null
}

const average = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length

export function recommend(items: RecommendItem[], wedding: RecommendWedding | null, categorySlug: string): Recommendation {
  if (items.length < 2) return { recommendedId: null, reasons: [], isTie: false }

  const minPrice = Math.min(...items.map((i) => i.price))
  const maxRating = Math.max(...items.map((i) => i.rating))
  const maxReviews = Math.max(...items.map((i) => i.reviewCount))
  const share = CATEGORY_BUDGET_SHARE[categorySlug] ?? 0
  const categoryBudget = wedding?.budget && share ? wedding.budget * share : null
  const hasCapacity = CAPACITY_CATEGORIES.includes(categorySlug)

  const scored: Scored[] = items
    .map((item) => {
      // Điểm Google Maps hiệu chỉnh theo số đánh giá (ít đánh giá thì kéo về mức trung bình)
      const bayes = (item.rating * item.reviewCount + BAYES_PRIOR_RATING * BAYES_PRIOR_COUNT) / (item.reviewCount + BAYES_PRIOR_COUNT)
      const R = bayes / 5
      const P = minPrice / item.price

      let F: number | null = null
      let inBudget: number | null = null
      let styleOverlap: number | null = null
      if (wedding) {
        const parts: number[] = []
        if (categoryBudget) parts.push((inBudget = Math.min(1, categoryBudget / item.price)))
        if (wedding.styles.length) parts.push((styleOverlap = item.styles.filter((s) => wedding.styles.includes(s)).length / wedding.styles.length))
        if (wedding.city) parts.push(item.city === wedding.city ? 1 : 0)
        F = parts.length ? average(parts) : null
      }

      let score = F === null ? WEIGHTS_NO_WEDDING.rating * R + WEIGHTS_NO_WEDDING.price * P : WEIGHTS_WITH_WEDDING.rating * R + WEIGHTS_WITH_WEDDING.price * P + WEIGHTS_WITH_WEDDING.fit * F

      const capacityOk = hasCapacity && wedding?.guestCount && item.capacity != null ? item.capacity >= wedding.guestCount : null
      if (capacityOk === false) score *= CAPACITY_PENALTY

      return { item, score, inBudget, styleOverlap, capacityOk }
    })
    .sort((a, b) => b.score - a.score)

  if (scored[0].score - scored[1].score < TIE_THRESHOLD) return { recommendedId: null, reasons: [], isTie: true }

  // Lý do: chỉ nêu khi phương án đề xuất thật sự hơn các phương án còn lại
  const [top, ...others] = scored
  const t = top.item
  const reasons: string[] = []
  if (top.capacityOk === true && others.some((o) => o.capacityOk === false)) reasons.push(`đủ chỗ cho ${wedding!.guestCount} khách`)
  const fits = (s: Scored) => s.inBudget !== null && s.inBudget >= 1
  if (fits(top) && others.some((o) => !fits(o))) reasons.push('nằm trong ngân sách hạng mục')
  if (top.styleOverlap && others.every((o) => (o.styleOverlap ?? 0) < top.styleOverlap!)) {
    reasons.push(`hợp phong cách ${t.styles.filter((s) => wedding!.styles.includes(s)).join(', ').toLowerCase()}`)
  }
  if (t.price === minPrice && items.filter((i) => i.price === minPrice).length === 1) reasons.push('giá thấp nhất')
  if (t.rating === maxRating && items.filter((i) => i.rating === maxRating).length === 1) reasons.push('điểm Google Maps cao nhất')
  if (!reasons.length) reasons.push(t.reviewCount === maxReviews ? 'nhiều đánh giá nhất' : 'cân bằng tốt giữa giá và đánh giá')

  return { recommendedId: t.id, reasons: reasons.slice(0, MAX_REASONS), isTie: false }
}

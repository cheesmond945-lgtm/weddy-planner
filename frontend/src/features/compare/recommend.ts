/*
 * Đề xuất một phương án trong bảng so sánh.
 *
 * TRUNG LẬP: công thức chỉ dùng điểm Google Maps, chi phí gói và độ phù hợp với ngân sách hạng mục của
 * cặp đôi. KHÔNG có bất kỳ yếu tố nào ưu tiên nhà cung cấp trả phí, quảng cáo hay hoa hồng.
 * Không thêm yếu tố như vậy vào đây. Không xét phong cách.
 *
 * Điểm Google có thể thiếu: khi đó bỏ yếu tố điểm cho cả nhóm, chỉ so giá và độ phù hợp.
 *
 * Hàm thuần, không phụ thuộc React hay alias "@/". Bản sao ở backend/src/modules/compare/recommend.ts
 * phải giống hệt (docs/api/compare.md). Hằng số nằm trong recommend.config.ts. Test: recommend.test.ts.
 */
import {
  BAYES_PRIOR_COUNT,
  BAYES_PRIOR_RATING,
  CAPACITY_CATEGORIES,
  CAPACITY_PENALTY,
  MAX_REASONS,
  TIE_THRESHOLD,
  WEIGHTS_NO_RATING,
  WEIGHTS_NO_RATING_WITH_WEDDING,
  WEIGHTS_NO_WEDDING,
  WEIGHTS_WITH_WEDDING,
} from './recommend.config.ts'

export interface RecommendItem {
  id: string
  /** Chi phí gói (nhà hàng: giá bàn × số bàn), đồng */
  price: number
  /** Điểm Google; null khi chưa có điểm hoặc lấy lỗi */
  rating: number | null
  reviewCount: number | null
  capacity?: number | null
}

export interface RecommendWedding {
  /** Ngân sách hạng mục đang hiển thị trong kế hoạch (sau khi khách sửa tay); null khi chưa có */
  categoryBudget: number | null
  guestCount: number | null
}

export interface Recommendation {
  /** Phương án được đề xuất; null khi ngang nhau hoặc không đủ 2 phương án */
  recommendedId: string | null
  /** Lý do ngắn (chữ thường, chưa viết hoa đầu câu), tối đa 3 */
  reasons: string[]
  isTie: boolean
  /** false khi có phương án thiếu điểm Google nên không dùng yếu tố điểm */
  usedRating: boolean
}

interface Scored {
  item: RecommendItem
  score: number
  /** min(1, ngân sách hạng mục / chi phí gói); null khi không có ngân sách hạng mục */
  fit: number | null
  /** true: đủ chỗ; false: thiếu chỗ; null: không xét */
  capacityOk: boolean | null
}

export function recommend(items: RecommendItem[], wedding: RecommendWedding | null, categorySlug: string): Recommendation {
  const useRating = items.every((i) => i.rating !== null && i.reviewCount !== null)
  if (items.length < 2) return { recommendedId: null, reasons: [], isTie: false, usedRating: useRating }

  const minPrice = Math.min(...items.map((i) => i.price))
  const categoryBudget = wedding?.categoryBudget ? wedding.categoryBudget : null
  const hasCapacity = CAPACITY_CATEGORIES.includes(categorySlug)

  const scored: Scored[] = items
    .map((item) => {
      const P = minPrice / item.price
      // Phù hợp: chỉ còn mức nằm trong ngân sách hạng mục
      const F = categoryBudget === null ? null : Math.min(1, categoryBudget / item.price)

      let score: number
      if (useRating) {
        // Điểm Google hiệu chỉnh theo số đánh giá (ít đánh giá thì kéo về mức trung bình)
        const bayes = (item.rating! * item.reviewCount! + BAYES_PRIOR_RATING * BAYES_PRIOR_COUNT) / (item.reviewCount! + BAYES_PRIOR_COUNT)
        const R = bayes / 5
        score = F === null ? WEIGHTS_NO_WEDDING.rating * R + WEIGHTS_NO_WEDDING.price * P : WEIGHTS_WITH_WEDDING.rating * R + WEIGHTS_WITH_WEDDING.price * P + WEIGHTS_WITH_WEDDING.fit * F
      } else {
        score = F === null ? WEIGHTS_NO_RATING.price * P : WEIGHTS_NO_RATING_WITH_WEDDING.price * P + WEIGHTS_NO_RATING_WITH_WEDDING.fit * F
      }

      const capacityOk = hasCapacity && wedding?.guestCount && item.capacity != null ? item.capacity >= wedding.guestCount : null
      if (capacityOk === false) score *= CAPACITY_PENALTY

      return { item, score, fit: F, capacityOk }
    })
    .sort((a, b) => b.score - a.score)

  if (scored[0].score - scored[1].score < TIE_THRESHOLD) return { recommendedId: null, reasons: [], isTie: true, usedRating: useRating }

  // Lý do: chỉ nêu khi phương án đề xuất thật sự hơn các phương án còn lại
  const [top, ...others] = scored
  const t = top.item
  const reasons: string[] = []
  if (top.capacityOk === true && others.some((o) => o.capacityOk === false)) reasons.push(`đủ chỗ cho ${wedding!.guestCount} khách`)
  const fits = (s: Scored) => s.fit !== null && s.fit >= 1
  if (fits(top) && others.some((o) => !fits(o))) reasons.push('nằm trong ngân sách hạng mục')
  if (t.price === minPrice && items.filter((i) => i.price === minPrice).length === 1) reasons.push('giá thấp nhất')
  if (useRating) {
    const maxRating = Math.max(...items.map((i) => i.rating!))
    if (t.rating === maxRating && items.filter((i) => i.rating === maxRating).length === 1) reasons.push('điểm Google Maps cao nhất')
  }
  if (!reasons.length) {
    if (!useRating) reasons.push('cân bằng tốt giữa giá và nhu cầu của bạn')
    else reasons.push(t.reviewCount === Math.max(...items.map((i) => i.reviewCount!)) ? 'nhiều đánh giá nhất' : 'cân bằng tốt giữa giá và đánh giá')
  }

  return { recommendedId: t.id, reasons: reasons.slice(0, MAX_REASONS), isTie: false, usedRating: useRating }
}

/*
 * Đề xuất một phương án trong bảng so sánh. Bản sao của frontend/src/features/compare/recommend.ts
 * (+ recommend.config.ts); hai bên phải giữ giống hệt nhau (docs/api/compare.md).
 * TRUNG LẬP: chỉ dùng điểm Google Maps, giá và độ phù hợp với đám cưới; không có yếu tố trả phí hay hoa hồng.
 */
const BAYES_PRIOR_RATING = 4.3;
const BAYES_PRIOR_COUNT = 100;
const WEIGHTS_NO_WEDDING = { rating: 0.55, price: 0.45 } as const;
const WEIGHTS_WITH_WEDDING = { rating: 0.4, price: 0.3, fit: 0.3 } as const;
const CAPACITY_PENALTY = 0.7;
const TIE_THRESHOLD = 0.03;
const MAX_REASONS = 3;
const CATEGORY_BUDGET_SHARE: Record<string, number> = {
  'nha-hang': 0.22,
  decor: 0.14,
  'trang-phuc': 0.1,
  makeup: 0.08,
  'chup-anh': 0.12,
  'quay-phong-su': 0.08,
  'co-cuoi': 0.14,
  'hoa-cuoi': 0.12,
};
const CAPACITY_CATEGORIES = ['nha-hang'];

export interface RecommendItem {
  id: string;
  price: number;
  rating: number;
  reviewCount: number;
  styles: string[];
  city: string;
  capacity?: number | null;
}

export interface RecommendWedding {
  budget: number | null;
  guestCount: number | null;
  city: string | null;
  styles: string[];
}

export interface Recommendation {
  recommendedId: string | null;
  reasons: string[];
  isTie: boolean;
}

interface Scored {
  item: RecommendItem;
  score: number;
  inBudget: number | null;
  styleOverlap: number | null;
  capacityOk: boolean | null;
}

const average = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;

export function recommend(items: RecommendItem[], wedding: RecommendWedding | null, categorySlug: string): Recommendation {
  if (items.length < 2) return { recommendedId: null, reasons: [], isTie: false };

  const minPrice = Math.min(...items.map((i) => i.price));
  const maxRating = Math.max(...items.map((i) => i.rating));
  const maxReviews = Math.max(...items.map((i) => i.reviewCount));
  const share = CATEGORY_BUDGET_SHARE[categorySlug] ?? 0;
  const categoryBudget = wedding?.budget && share ? wedding.budget * share : null;
  const hasCapacity = CAPACITY_CATEGORIES.includes(categorySlug);

  const scored: Scored[] = items
    .map((item) => {
      const bayes = (item.rating * item.reviewCount + BAYES_PRIOR_RATING * BAYES_PRIOR_COUNT) / (item.reviewCount + BAYES_PRIOR_COUNT);
      const R = bayes / 5;
      const P = minPrice / item.price;

      let F: number | null = null;
      let inBudget: number | null = null;
      let styleOverlap: number | null = null;
      if (wedding) {
        const parts: number[] = [];
        if (categoryBudget) parts.push((inBudget = Math.min(1, categoryBudget / item.price)));
        if (wedding.styles.length) parts.push((styleOverlap = item.styles.filter((s) => wedding.styles.includes(s)).length / wedding.styles.length));
        if (wedding.city) parts.push(item.city === wedding.city ? 1 : 0);
        F = parts.length ? average(parts) : null;
      }

      let score =
        F === null
          ? WEIGHTS_NO_WEDDING.rating * R + WEIGHTS_NO_WEDDING.price * P
          : WEIGHTS_WITH_WEDDING.rating * R + WEIGHTS_WITH_WEDDING.price * P + WEIGHTS_WITH_WEDDING.fit * F;

      const capacityOk = hasCapacity && wedding?.guestCount && item.capacity != null ? item.capacity >= wedding.guestCount : null;
      if (capacityOk === false) score *= CAPACITY_PENALTY;

      return { item, score, inBudget, styleOverlap, capacityOk };
    })
    .sort((a, b) => b.score - a.score);

  if (scored[0].score - scored[1].score < TIE_THRESHOLD) return { recommendedId: null, reasons: [], isTie: true };

  const [top, ...others] = scored;
  const t = top.item;
  const reasons: string[] = [];
  if (top.capacityOk === true && others.some((o) => o.capacityOk === false)) reasons.push(`đủ chỗ cho ${wedding!.guestCount} khách`);
  const fits = (s: Scored) => s.inBudget !== null && s.inBudget >= 1;
  if (fits(top) && others.some((o) => !fits(o))) reasons.push('nằm trong ngân sách hạng mục');
  if (top.styleOverlap && others.every((o) => (o.styleOverlap ?? 0) < top.styleOverlap!)) {
    reasons.push(`hợp phong cách ${t.styles.filter((s) => wedding!.styles.includes(s)).join(', ').toLowerCase()}`);
  }
  if (t.price === minPrice && items.filter((i) => i.price === minPrice).length === 1) reasons.push('giá thấp nhất');
  if (t.rating === maxRating && items.filter((i) => i.rating === maxRating).length === 1) reasons.push('điểm Google Maps cao nhất');
  if (!reasons.length) reasons.push(t.reviewCount === maxReviews ? 'nhiều đánh giá nhất' : 'cân bằng tốt giữa giá và đánh giá');

  return { recommendedId: t.id, reasons: reasons.slice(0, MAX_REASONS), isTie: false };
}

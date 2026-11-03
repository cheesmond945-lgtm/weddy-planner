/**
 * Hàm thuần của chức năng "Gợi ý cho bạn" (không DB, không Nest, không gọi AI). Unit test: backend/test/suggest-rules.test.cjs.
 * Thứ tự: estimateCost (chi phí ước tính) → hardFilter (lọc cứng) → rankSuggestions (xếp hạng) → buildReasons (lý do trên thẻ).
 * Hằng số: suggest.config.ts.
 */
import { fitsGuests, packageCost, type EnginePackage } from './budget-engine';
import { BUDGET_FIT_DIRECTION, MIN_REVIEWS } from './suggest.config';

export interface SuggestCandidate {
  id: string;
  name: string;
  /** Tỉnh/thành của nhà cung cấp */
  city: string | null;
  /** Phường/xã của nhà cung cấp (có thể không có tiền tố "Phường") */
  ward: string | null;
  /** Gói đã duyệt đang bán */
  packages: EnginePackage[];
  /** Điểm trung bình đánh giá của khách trên web; null khi chưa có */
  rating: number | null;
  reviewCount: number;
  /** Thẻ phong cách của các gói */
  styles: string[];
  /** Đã có trong kế hoạch của khách */
  inPlan: boolean;
}

export interface SuggestContext {
  slug: string;
  categoryName: string;
  city: string | null;
  /** Phường/xã nơi tổ chức ("Phường Cầu Giấy"); null khi chưa có dữ liệu thì bỏ bước xếp theo địa điểm */
  ward: string | null;
  guestCount: number;
  /** Số bàn dự kiến (số khách / 10 hoặc số khách tự nhập) */
  tables: number;
  /** Ngân sách hạng mục */
  budget: number;
  /** Phong cách khách chọn; rỗng thì bỏ bước xếp theo phong cách */
  styles: string[];
}

export interface CostEstimate {
  package: EnginePackage;
  /** Chi phí ước tính thấp nhất của dịch vụ */
  cost: number;
  /** Gói theo bàn: số bàn tính phí = max(số bàn dự kiến, số bàn tối thiểu của gói, 1); gói trọn gói: null */
  chargedTables: number | null;
  /** Số bàn tối thiểu vượt số bàn dự kiến (0 nếu không vượt) */
  extraTables: number;
}

export type Estimated = SuggestCandidate & { estimate: CostEstimate };

/**
 * Chi phí ước tính thấp nhất của một dịch vụ: dịch vụ thường = giá gói thấp nhất; nhà hàng = min các gói đủ chỗ của
 * đơn giá/bàn × max(số bàn dự kiến, số bàn tối thiểu). null khi không có gói nào (nhà hàng: không sảnh nào đủ chỗ).
 */
export function estimateCost(packages: EnginePackage[], slug: string, guestCount: number, tables: number): CostEstimate | null {
  let best: CostEstimate | null = null;
  for (const p of packages) {
    if (!fitsGuests(p, slug, guestCount)) continue;
    const cost = packageCost(p, tables);
    if (best && cost >= best.cost) continue;
    const byTable = p.unit === 'mâm';
    best = {
      package: p,
      cost,
      chargedTables: byTable ? Math.max(tables, p.minTables ?? 0, 1) : null,
      extraTables: byTable ? Math.max(0, (p.minTables ?? 0) - tables) : 0,
    };
  }
  return best;
}

/** "Phường Cầu Giấy" / "cầu giấy" → "cau giay" để so phường/xã (dữ liệu NCC không có tiền tố). */
export const normalizePlace = (s: string | null | undefined) =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/^\s*(phuong|xa|thi tran|quan|huyen)\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();

/** Cùng phường/xã với nơi tổ chức (chỉ khi đám cưới có dữ liệu nơi tổ chức) */
export const sameWard = (c: Pick<SuggestCandidate, 'ward'>, ctx: Pick<SuggestContext, 'ward'>) =>
  !!ctx.ward && !!c.ward && normalizePlace(c.ward) === normalizePlace(ctx.ward);

export interface FilterResult {
  /** Qua mọi điều kiện lọc cứng, kèm chi phí ước tính */
  passed: Estimated[];
  /** Qua mọi điều kiện trừ ngân sách (chi phí ước tính > ngân sách hạng mục) */
  overBudget: Estimated[];
  /** Nhà hàng cùng khu vực, chưa trong kế hoạch nhưng không có sảnh đủ chỗ */
  noCapacity: number;
}

/**
 * Lọc cứng (không đạt thì loại): cùng tỉnh/thành; chưa có trong kế hoạch; có gói (nhà hàng: sảnh đủ chỗ);
 * chi phí ước tính thấp nhất ≤ ngân sách hạng mục. Cùng hạng mục và đang hiển thị do nơi gọi bảo đảm.
 */
export function hardFilter(candidates: SuggestCandidate[], ctx: SuggestContext): FilterResult {
  const passed: Estimated[] = [];
  const overBudget: Estimated[] = [];
  let noCapacity = 0;
  for (const c of candidates) {
    if (ctx.city && normalizePlace(c.city) !== normalizePlace(ctx.city)) continue;
    if (c.inPlan) continue;
    const estimate = estimateCost(c.packages, ctx.slug, ctx.guestCount, ctx.tables);
    if (!estimate) {
      if (c.packages.length) noCapacity++;
      continue;
    }
    (estimate.cost <= ctx.budget ? passed : overBudget).push({ ...c, estimate });
  }
  return { passed, overBudget, noCapacity };
}

const styleOverlap = (c: SuggestCandidate, ctx: SuggestContext) => {
  if (!ctx.styles.length) return 0;
  const want = new Set(ctx.styles.map((s) => normalizePlace(s)));
  return new Set(c.styles.map((s) => normalizePlace(s)).filter((s) => want.has(s))).size;
};

/**
 * Xếp hạng (sau lọc cứng), lần lượt:
 * a. địa điểm: cùng phường/xã với nơi tổ chức trước (đám cưới chưa có nơi tổ chức thì bỏ bước này);
 * b. mức khớp ngân sách: 'CLOSEST' chi phí gần ngân sách hơn trước, 'CHEAPEST' chi phí thấp hơn trước;
 * c. điểm đánh giá giảm dần (chưa có đánh giá xếp sau), rồi số lượt đánh giá giảm dần;
 * d. số phong cách trùng với phong cách khách chọn (nếu có dữ liệu);
 * cuối cùng theo tên để thứ tự ổn định.
 */
export function rankSuggestions(list: Estimated[], ctx: SuggestContext, direction: 'CLOSEST' | 'CHEAPEST' = BUDGET_FIT_DIRECTION): Estimated[] {
  const place = (c: Estimated) => (ctx.ward ? (sameWard(c, ctx) ? 0 : 1) : 0);
  const fit = (c: Estimated) => (direction === 'CLOSEST' ? ctx.budget - c.estimate.cost : c.estimate.cost);
  return [...list].sort(
    (a, b) =>
      place(a) - place(b) ||
      fit(a) - fit(b) ||
      (b.rating ?? -1) - (a.rating ?? -1) ||
      b.reviewCount - a.reviewCount ||
      styleOverlap(b, ctx) - styleOverlap(a, ctx) ||
      a.name.localeCompare(b.name, 'vi') ||
      a.id.localeCompare(b.id),
  );
}

/** 1250000 → "1.250.000đ" (làm tròn tới đồng, dấu chấm ngăn cách nghìn) */
export const formatVnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

export interface SuggestionCopy {
  /**
   * Dòng ngắn dưới giá, chỉ từ dữ liệu thật: điểm đánh giá khi đủ MIN_REVIEWS lượt. Không ghi "giá từ", "nằm trong ngân sách",
   * "cùng khu vực", "ít đánh giá" (căn cứ chung đã nằm ở dòng tiêu đề). Dòng khoảng cách cần tọa độ, chưa có dữ liệu nên chưa sinh.
   */
  reasons: string[];
  /** Nhà hàng có số bàn tối thiểu cao hơn dự kiến */
  warning: string | null;
  /** Dưới MIN_REVIEWS lượt đánh giá */
  fewReviews: boolean;
}

/** Dòng của một thẻ gợi ý (trước khi bỏ dòng trùng giữa các thẻ, xem dropSharedReasons). */
export function buildReasons(c: Estimated, _ctx: SuggestContext): SuggestionCopy {
  const fewReviews = c.reviewCount < MIN_REVIEWS || c.rating === null;
  const reasons = fewReviews ? [] : [`${c.rating!.toFixed(1)}/5 từ ${c.reviewCount} lượt`];
  const { estimate } = c;
  const warning = estimate.extraTables > 0 ? `Gói này tối thiểu ${estimate.package.minTables} bàn, nhiều hơn dự kiến ${estimate.extraTables} bàn` : null;
  return { reasons, warning, fewReviews };
}

/** Chỉ giữ dòng khác nhau giữa các thẻ: dòng giống hệt ở mọi thẻ (từ 2 thẻ trở lên) thì bỏ. Cảnh báo luôn giữ. */
export function dropSharedReasons<T extends SuggestionCopy>(copies: T[]): T[] {
  if (copies.length < 2) return copies;
  const shared = (line: string) => copies.every((c) => c.reasons.includes(line));
  return copies.map((c) => ({ ...c, reasons: c.reasons.filter((r) => !shared(r)) }));
}

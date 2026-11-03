/**
 * Hàm thuần của tìm kiếm dịch vụ (không DB, không gọi AI). Unit test: backend/test/search-rules.test.cjs. Hằng số: search.config.ts.
 * Luồng: normalizeQuery (chuẩn hóa câu gõ) → tầng 1 matchTier1 / sortTier1 (khớp chặt tên + mô tả)
 * → không có kết quả và đủ điều kiện (shouldCallAi) thì tầng 2: AI trả JSON bộ lọc, kiểm tra bằng parseAiFilters, gộp với dropdown bằng mergeFilters.
 */
import {
  CATEGORY_SYNONYMS,
  CHEAP_WORDS,
  GENERIC_WORDS,
  KEEP_PHRASES,
  PRICE_SANE_MAX,
  PRICE_TOLERANCE,
  PRICE_WORDS,
  QUERY_MAX_LENGTH,
  STOP_WORDS,
} from './search.config';

/** Chữ thường, bỏ dấu tiếng Việt (đ → d) */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();

/** Bỏ dấu, ký tự đặc biệt và emoji (chỉ giữ chữ, số, khoảng trắng), gộp khoảng trắng */
export const cleanText = (s: string) =>
  fold(s)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export interface NormalizedQuery {
  /** Câu đã chuẩn hóa (dùng làm khóa cache AI) */
  text: string;
  /** Từ / cụm còn lại phải khớp tên hoặc mô tả (tầng 1) */
  tokens: string[];
  /** Tên hạng mục chuẩn (đã bỏ dấu) nhận ra từ CATEGORY_SYNONYMS: hiểu là lọc theo hạng mục */
  categories: string[];
  /** Có từ về chất lượng (đẹp, uy tín...): xếp theo điểm đánh giá */
  quality: boolean;
  /** Có từ chỉ rẻ: xếp theo chi phí ước tính tăng dần */
  cheap: boolean;
  /** Có số hoặc từ chỉ giá: bỏ qua tầng 1, chuyển tầng 2 */
  priceLike: boolean;
  /** Số từ của câu sau khi làm sạch */
  wordCount: number;
  /** Câu rỗng hoặc chỉ có ký tự đặc biệt / emoji */
  empty: boolean;
}

const byLengthDesc = (a: string, b: string) => b.length - a.length;

/** Lấy các cụm có trong câu (khớp nguyên từ), bỏ chúng khỏi câu */
function takePhrases(work: string, phrases: string[]) {
  const found: string[] = [];
  for (const p of [...phrases].sort(byLengthDesc)) {
    while (work.includes(` ${p} `)) {
      found.push(p);
      work = work.replace(` ${p} `, ' ');
    }
  }
  return { work, found };
}

/** Chuẩn hóa câu gõ: cắt QUERY_MAX_LENGTH, bỏ dấu và ký tự đặc biệt, nhận hạng mục, từ rẻ, từ chất lượng, bỏ từ nối. */
export function normalizeQuery(raw: string): NormalizedQuery {
  const text = cleanText((raw ?? '').slice(0, QUERY_MAX_LENGTH));
  const words = text ? text.split(' ') : [];
  const priceLike = /\d/.test(text) || words.some((w) => PRICE_WORDS.includes(w));
  let work = ` ${text} `;
  const cat = takePhrases(work, Object.keys(CATEGORY_SYNONYMS));
  work = cat.work;
  const cheap = takePhrases(work, CHEAP_WORDS);
  work = cheap.work;
  const keep = takePhrases(work, KEEP_PHRASES);
  work = keep.work;
  const generic = takePhrases(work, GENERIC_WORDS);
  work = generic.work;
  const rest = work
    .split(' ')
    .filter(Boolean)
    .filter((w) => !STOP_WORDS.includes(w));
  return {
    text,
    tokens: [...keep.found, ...rest],
    categories: [...new Set(cat.found.map((p) => CATEGORY_SYNONYMS[p]))],
    quality: generic.found.length > 0,
    cheap: cheap.found.length > 0,
    priceLike,
    wordCount: words.length,
    empty: !text,
  };
}

/** Câu không còn từ để tìm (ví dụ chỉ gõ "đẹp"): không tìm, không gọi AI, hiện hướng dẫn */
export const needsGuide = (q: NormalizedQuery) => !q.empty && !q.tokens.length && !q.categories.length && !q.priceLike;

/** Gọi AI khi tầng 1 không có kết quả VÀ câu có ít nhất hai từ hoặc có số / từ chỉ giá */
export const shouldCallAi = (q: NormalizedQuery, tier1Count: number) => !q.empty && tier1Count === 0 && (q.wordCount >= 2 || q.priceLike);

export interface SearchItem {
  id: string;
  name: string;
  description: string;
  categoryName: string;
  /** Điểm trung bình đánh giá trên web (0 khi chưa có) */
  rating: number;
  reviewCount: number;
  /** Chi phí ước tính (dịch vụ thường: gói thấp nhất; nhà hàng: đơn giá × max(số bàn dự kiến, tối thiểu)) */
  cost: number;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (haystack: string, token: string) => new RegExp(`(^| )${escapeRe(token)}( |$)`).test(haystack);

export interface Tier1Match<T extends SearchItem> {
  item: T;
  /** Mọi từ đều có trong tên (xếp trước khớp mô tả) */
  inName: boolean;
}

/**
 * Tầng 1, khớp chặt (AND): dịch vụ khớp khi MỌI từ còn lại đều có trong TÊN hoặc MÔ TẢ (khớp nguyên từ, không dấu).
 * KHÔNG khớp khu vực / địa chỉ (đã có dropdown Khu vực). Hạng mục nhận ra từ câu gõ thì lọc theo hạng mục.
 * Câu có số / từ chỉ giá thì bỏ qua tầng 1 (trả rỗng để chuyển tầng 2).
 */
export function matchTier1<T extends SearchItem>(items: T[], q: NormalizedQuery): Tier1Match<T>[] {
  if (q.priceLike || (!q.tokens.length && !q.categories.length)) return [];
  const out: Tier1Match<T>[] = [];
  for (const item of items) {
    if (q.categories.length && !q.categories.includes(cleanText(item.categoryName))) continue;
    const name = cleanText(item.name);
    const desc = cleanText(item.description);
    if (!q.tokens.every((t) => hasWord(name, t) || hasWord(desc, t))) continue;
    out.push({ item, inName: q.tokens.every((t) => hasWord(name, t)) });
  }
  return out;
}

/** Thứ tự tầng 1: khớp tên trước, khớp mô tả sau; câu có từ rẻ thì chi phí tăng dần, có từ chất lượng thì điểm đánh giá giảm dần. */
export function sortTier1<T extends SearchItem>(matches: Tier1Match<T>[], q: Pick<NormalizedQuery, 'quality' | 'cheap'>): T[] {
  return [...matches]
    .sort(
      (a, b) =>
        Number(b.inName) - Number(a.inName) ||
        (q.cheap ? a.item.cost - b.item.cost : 0) ||
        (q.quality ? b.item.rating - a.item.rating || b.item.reviewCount - a.item.reviewCount : 0) ||
        a.item.name.localeCompare(b.item.name, 'vi'),
    )
    .map((m) => m.item);
}

/**
 * Tab hạng mục đang chọn không có kết quả mà hạng mục khác có: trả hạng mục có nhiều kết quả nhất để báo
 * "Không có trong {tab}, có {n} kết quả ở {hạng mục khác}". Tab có kết quả hoặc không chọn tab thì null.
 */
export function tabHint<T extends SearchItem>(results: T[], tabCategoryName: string | null) {
  if (!tabCategoryName || results.some((r) => r.categoryName === tabCategoryName)) return null;
  const counts = new Map<string, number>();
  for (const r of results) counts.set(r.categoryName, (counts.get(r.categoryName) ?? 0) + 1);
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  return best ? { categoryName: best[0], count: best[1], total: results.length } : null;
}

// ---------- Tầng 2: kiểm tra JSON bộ lọc AI trả về ----------

export interface AiFilters {
  /** slug hạng mục */
  category: string | null;
  /** Khu vực (phường/xã chính thức, có trong dropdown) */
  area: string | null;
  styles: string[];
  priceMin: number | null;
  priceMax: number | null;
}

export interface AiParseResult {
  understood: boolean;
  filters: AiFilters;
  /** AI trả giá vô lý (âm, không phải số, min > max...): đã bỏ bộ lọc giá, báo "không hiểu phần giá" */
  priceRejected: boolean;
}

export interface AiContext {
  categories: { slug: string; name: string }[];
  areas: string[];
  styles: string[];
}

const placeKey = (s: string) => cleanText(s).replace(/^(phuong|xa) /, '');

/** Số nguyên dương hợp lý (đồng); không thì null. invalid = có giá trị nhưng sai. */
function price(v: unknown): { value: number | null; invalid: boolean } {
  if (v === null || v === undefined) return { value: null, invalid: false };
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v.trim()) ? Number(v) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > PRICE_SANE_MAX) return { value: null, invalid: true };
  return { value: n, invalid: false };
}

/**
 * Kiểm tra JSON AI trả về. Không tin chuỗi AI: hạng mục phải có trong danh mục, khu vực trong danh sách dropdown,
 * phong cách trong danh sách phong cách; giá là số nguyên > 0, min ≤ max ("tầm X" = X ± PRICE_TOLERANCE). Giá trị lạ thì bỏ.
 * understood = false hoặc mọi trường rỗng: coi như không hiểu.
 */
export function parseAiFilters(json: unknown, ctx: AiContext): AiParseResult {
  const empty: AiFilters = { category: null, area: null, styles: [], priceMin: null, priceMax: null };
  if (!json || typeof json !== 'object' || Array.isArray(json)) return { understood: false, filters: empty, priceRejected: false };
  const o = json as Record<string, unknown>;

  const catRaw = typeof o.category === 'string' ? o.category : null;
  const catKey = catRaw ? cleanText(catRaw) : null;
  const canonical = catKey ? (CATEGORY_SYNONYMS[catKey] ?? catKey) : null;
  const category = canonical ? (ctx.categories.find((c) => c.slug === catRaw || cleanText(c.name) === canonical)?.slug ?? null) : null;

  const areaRaw = typeof o.area === 'string' ? o.area : null;
  const area = areaRaw ? (ctx.areas.find((a) => placeKey(a) === placeKey(areaRaw)) ?? null) : null;

  const styles = Array.isArray(o.styles)
    ? [...new Set(o.styles.flatMap((s) => (typeof s === 'string' ? (ctx.styles.find((x) => cleanText(x) === cleanText(s)) ?? []) : [])))]
    : [];

  // Định dạng KHỐI 2: min_price / max_price ở cấp ngoài; vẫn nhận dạng lồng { price: { min, max, approx } } nếu AI trả như vậy
  const p = o.price && typeof o.price === 'object' && !Array.isArray(o.price) ? (o.price as Record<string, unknown>) : {};
  const min = price(o.min_price ?? p.min);
  const max = price(o.max_price ?? p.max);
  const approx = price(p.approx);
  let priceMin = min.value;
  let priceMax = max.value;
  if (priceMin === null && priceMax === null && approx.value !== null) {
    priceMin = Math.round(approx.value * (1 - PRICE_TOLERANCE));
    priceMax = Math.round(approx.value * (1 + PRICE_TOLERANCE));
  }
  let priceRejected = min.invalid || max.invalid || approx.invalid;
  if (priceMin !== null && priceMax !== null && priceMin > priceMax) priceRejected = true;
  if (priceRejected) {
    priceMin = null;
    priceMax = null;
  }

  const filters: AiFilters = { category, area, styles, priceMin, priceMax };
  const anything = !!(category || area || styles.length || priceMin !== null || priceMax !== null);
  return { understood: o.understood !== false && anything, filters, priceRejected };
}

export interface DropdownFilters {
  area?: string | null;
  priceMin?: number | null;
  priceMax?: number | null;
}

/**
 * Gộp dropdown với bộ lọc AI: AI trích ra khu vực / giá khác dropdown thì ưu tiên điều vừa gõ (overridden = true,
 * dropdown hiện "Tùy chỉnh"); không mâu thuẫn thì kết hợp AND.
 */
export function mergeFilters(drop: DropdownFilters, ai: AiFilters) {
  const aiHasPrice = ai.priceMin !== null || ai.priceMax !== null;
  const dropHasPrice = (drop.priceMin ?? null) !== null || (drop.priceMax ?? null) !== null;
  return {
    category: ai.category,
    styles: ai.styles,
    area: ai.area ?? drop.area ?? null,
    priceMin: aiHasPrice ? ai.priceMin : (drop.priceMin ?? null),
    priceMax: aiHasPrice ? ai.priceMax : (drop.priceMax ?? null),
    overridden: {
      area: !!ai.area && !!drop.area && ai.area !== drop.area,
      price: aiHasPrice && dropHasPrice && (ai.priceMin !== (drop.priceMin ?? null) || ai.priceMax !== (drop.priceMax ?? null)),
    },
  };
}

/** Promise quá `ms` thì lỗi "AI_TIMEOUT" (gọi AI không bao giờ làm trang treo). */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('AI_TIMEOUT')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

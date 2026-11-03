import { Injectable } from '@nestjs/common';
import { GUIDE_MESSAGE } from './search.config';
import { SearchAiService } from './search-ai.service';
import { cleanText, matchTier1, mergeFilters, needsGuide, normalizeQuery, parseAiFilters, shouldCallAi, sortTier1, tabHint, type AiContext } from './search-rules';
import { ServicesService } from './services.service';

export interface SearchParams {
  q: string;
  /** Tab hạng mục đang chọn (slug) */
  category?: string;
  /** Dropdown Khu vực */
  area?: string;
  /** Dropdown Mức giá (so với chi phí ước tính, priceMax không bao gồm) */
  priceMin?: number;
  priceMax?: number;
  page?: number;
  pageSize?: number;
  /** Cho phép gọi AI (tầng 2). FE gọi lần đầu không có cờ này: nếu cần AI thì nhận mode NEEDS_AI, hiện "Đang hiểu yêu cầu…" rồi gọi lại kèm ai=1 */
  allowAi?: boolean;
}

type Item = Awaited<ReturnType<ServicesService['catalogItems']>>[number];

/**
 * Tìm kiếm dịch vụ 2 tầng (docs/api/catalog.md, GET /services/search). Hàm thuần ở search-rules.ts.
 * - Tầng 1: khớp chặt mọi từ trong tên / mô tả (không khớp khu vực), trên toàn bộ hạng mục; có kết quả thì trả luôn, không gọi AI.
 * - Tầng 2: tầng 1 rỗng và câu có ≥ 2 từ hoặc có giá: AI trích JSON bộ lọc, backend kiểm tra rồi tự lọc (AI không chọn NCC).
 * Dropdown Khu vực / Mức giá là bộ lọc cứng AND; AI trích khu vực / giá khác dropdown thì ưu tiên điều vừa gõ.
 */
@Injectable()
export class SearchService {
  constructor(
    private readonly services: ServicesService,
    private readonly ai: SearchAiService,
  ) {}

  async search(p: SearchParams, who: { userId?: string | null; ip: string }) {
    const page = Math.max(1, Math.trunc(p.page ?? 1) || 1);
    const pageSize = Math.min(100, Math.max(1, Math.trunc(p.pageSize ?? 24) || 24));
    const norm = normalizeQuery(p.q);
    const base = { query: norm.text, page, pageSize };

    // Câu rỗng / chỉ ký tự đặc biệt: FE giữ nguyên danh sách hiện tại
    if (norm.empty) return { ...base, mode: 'EMPTY' as const, items: [], total: 0 };
    if (needsGuide(norm)) return { ...base, mode: 'GUIDE' as const, items: [], total: 0, guide: await this.guide() };

    const expected = (await this.services.expectedFor(who.userId)) ?? { guestCount: null, tables: 0 };
    // Tải NCC một lần; hạng mục và khu vực lấy luôn từ dữ liệu này (không tải lại)
    const all = await this.services.catalogItems(expected);
    const categories = [...new Map(all.map((i) => [i.category.slug, { slug: i.category.slug, name: i.category.name }])).values()];
    const inPrice = (i: Item, min?: number | null, max?: number | null) => (min == null || i.cost >= min) && (max == null || i.cost < max);
    const byDropdown = all.filter((i) => (!p.area || i.area === p.area) && inPrice(i, p.priceMin, p.priceMax));
    const sort = norm.cheap ? ('CHEAP' as const) : norm.quality ? ('RATING' as const) : null;

    // Tầng 1 (bỏ qua khi câu có số / từ chỉ giá)
    if (!norm.priceLike) {
      const tier1 = sortTier1(matchTier1(byDropdown, norm), norm);
      if (tier1.length) {
        const tab = p.category ? categories.find((c) => c.slug === p.category) : undefined;
        const inTab = tab ? tier1.filter((i) => i.category.slug === tab.slug) : tier1;
        if (tab && !inTab.length) {
          const h = tabHint(tier1, tab.name)!;
          const other = categories.find((c) => c.name === h.categoryName)!;
          return { ...base, mode: 'TEXT' as const, items: [], total: 0, sort, hint: { tab: tab.name, categorySlug: other.slug, categoryName: other.name, count: h.count } };
        }
        return { ...base, mode: 'TEXT' as const, ...this.paginate(inTab, page, pageSize), sort };
      }
    }

    if (!shouldCallAi(norm, 0)) {
      return { ...base, mode: 'TEXT' as const, items: [], total: 0, sort, empty: this.emptyHelp(all, p.area ?? null, p.priceMin, p.priceMax) };
    }
    if (!p.allowAi) return { ...base, mode: 'NEEDS_AI' as const, items: [], total: 0 };

    // Tầng 2: AI chỉ trích bộ lọc; mọi giá trị được kiểm tra với danh sách thật trước khi dùng
    const areas = [...new Set(all.flatMap((i) => (i.area ? [i.area] : [])))];
    const ctx: AiContext = { categories, areas, styles: await this.services.styles() };
    const out = await this.ai.extract(norm.text, ctx, who);
    if (!out.ok) {
      return { ...base, mode: 'AI' as const, items: [], total: 0, ai: { error: out.reason }, empty: this.emptyHelp(all, p.area ?? null, p.priceMin, p.priceMax) };
    }
    const parsed = parseAiFilters(out.json, ctx);
    if (!parsed.understood) return { ...base, mode: 'GUIDE' as const, items: [], total: 0, guide: await this.guide(), ai: { priceRejected: parsed.priceRejected } };

    const merged = mergeFilters({ area: p.area ?? null, priceMin: p.priceMin ?? null, priceMax: p.priceMax ?? null }, parsed.filters);
    const category = merged.category ?? p.category ?? null;
    const wantStyles = merged.styles.map(cleanText);
    const results = all
      .filter(
        (i) =>
          (!category || i.category.slug === category) &&
          (!merged.area || i.area === merged.area) &&
          wantStyles.every((s) => i.styles.some((t) => cleanText(t) === s)) &&
          inPrice(i, merged.priceMin, merged.priceMax),
      )
      .sort((a, b) => (sort === 'CHEAP' ? a.cost - b.cost : 0) || b.rating - a.rating || b.reviewCount - a.reviewCount || a.name.localeCompare(b.name, 'vi'));
    const filters = { category, area: merged.area, styles: merged.styles, priceMin: merged.priceMin, priceMax: merged.priceMax };
    return {
      ...base,
      mode: 'AI' as const,
      ...this.paginate(results, page, pageSize),
      sort,
      ai: { filters, overridden: merged.overridden, priceRejected: parsed.priceRejected, cached: out.cached },
      ...(results.length ? {} : { empty: this.emptyHelp(all.filter((i) => !category || i.category.slug === category), merged.area, merged.priceMin, merged.priceMax) }),
    };
  }

  private paginate(list: Item[], page: number, pageSize: number) {
    // Trả đúng dạng thẻ dịch vụ (bỏ mô tả, phong cách) kèm chi phí ước tính
    const items = list.slice((page - 1) * pageSize, page * pageSize).map(({ description: _d, styles: _s, categoryName: _c, area: _a, cost, ...s }) => ({ ...s, estimatedCost: cost }));
    return { items, total: list.length };
  }

  /** Gợi ý khi không có kết quả: khu vực chưa có dịch vụ; hoặc giá hợp lệ nhưng không dịch vụ nào đạt thì "rẻ nhất hiện có từ …" */
  private emptyHelp(pool: Item[], area: string | null, min?: number | null, max?: number | null) {
    if (area && !pool.some((i) => i.area === area)) return { noServicesInArea: area };
    if (min == null && max == null) return {};
    const inArea = pool.filter((i) => !area || i.area === area);
    return inArea.length ? { cheapestFrom: Math.min(...inArea.map((i) => i.cost)) } : {};
  }

  /** Hướng dẫn kèm chip bấm nhanh: hạng mục và phong cách phổ biến */
  private async guide() {
    const [cats, styles] = await Promise.all([this.services.categories(), this.services.styles()]);
    return { message: GUIDE_MESSAGE, categories: cats.map((c) => ({ slug: c.slug, name: c.name ?? '' })), styles: styles.slice(0, 6) };
  }
}

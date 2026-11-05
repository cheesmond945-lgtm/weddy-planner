import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from '../catalog/services.service';
import { CAPACITY_CATEGORIES } from './budget.config';
import { BudgetCalcService } from './budget-calc.service';
import { packageCost, type EnginePackage } from './budget-engine';
import { SUGGESTION_COUNT } from './suggest.config';
import { topVendors } from './budget-split';
import { buildReasons, dropSharedReasons, estimateCost, hardFilter, normalizePlace, type SuggestCandidate, type SuggestContext } from './suggest-rules';
import { versionOf } from './wedding-version';
import { WeddingsService } from './weddings.service';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

/**
 * Phép tính chi phí một gói để hiện cho khách: "25 bàn × 5.000.000đ = 125.000.000đ".
 * Số bàn = max(số bàn dự kiến, số bàn tối thiểu của gói, 1); withMinNote: thêm "(tối thiểu N bàn)" khi tính theo số tối thiểu.
 */
export function costCalculation(p: EnginePackage, tables: number, withMinNote = true) {
  if (p.unit !== 'mâm') return `${p.name}: ${money(p.price)} trọn gói`;
  const n = Math.max(tables, p.minTables ?? 0, 1);
  const min = withMinNote && p.minTables && p.minTables > tables ? ` (tối thiểu ${p.minTables} bàn)` : '';
  return `${p.name}: ${n} bàn × ${money(p.price)} = ${money(packageCost(p, tables))}${min}`;
}

/**
 * "Gợi ý cho bạn" theo hạng mục: thuật toán theo luật (không gọi mô hình ngôn ngữ), chạy trên dữ liệu thật.
 * Lọc cứng và lý do nằm ở hàm thuần suggest-rules.ts; xếp hạng dùng topVendors (budget-split.ts) như ô gợi ý ở tab Ngân sách.
 * Ngân sách hạng mục ("Giới hạn") và số bàn dự kiến lấy như tab Ngân sách (allocation.ts).
 */
@Injectable()
export class AiSuggestService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly weddings: WeddingsService,
    private readonly calc: BudgetCalcService,
  ) {}

  async suggest(userId: string, categorySlug: string) {
    const w = await this.weddings.requireWedding(userId);
    const category = (await this.services.categories()).find((c) => c.slug === categorySlug);
    if (!category) return fail('VALIDATION_ERROR', 'Hạng mục không hợp lệ.', 400);

    const { input, result } = await this.calc.compute(w.id, [category.id]);
    const row = result.rows.find((c) => c.categoryId === category.id)!;
    const isVenue = CAPACITY_CATEGORIES.includes(categorySlug);
    const packages = input.categories.find((c) => c.id === category.id)?.packages ?? [];

    // Nhà cung cấp đang hiển thị của hạng mục (có gói đã duyệt)
    const vendorIds = [...new Set(packages.map((p) => p.vendorId))];
    const summaries = new Map((await this.services.summaries(vendorIds)).map((s) => [s.id, s]));
    const visibleIds = vendorIds.filter((id) => summaries.has(id));
    const [places, ratings] = await Promise.all([
      this.prisma.vendor_profiles.findMany({ where: { id: { in: visibleIds } }, select: { id: true, ward: true, city: true } }),
      this.webRatings(visibleIds),
    ]);
    const placeOf = new Map(places.map((p) => [p.id, p]));
    const planIds = new Set(input.planVendors.map((v) => v.vendorId));

    // Nơi tổ chức (phường/xã): cột weddings.ward chưa có trên DB thì Prisma bỏ cột này, coi như chưa có dữ liệu
    const ward = (w as { ward?: string | null }).ward ?? null;
    const weddingStyles = (w.style ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    const ctx: SuggestContext = {
      slug: categorySlug,
      categoryName: category.name ?? '',
      city: w.city,
      ward,
      guestCount: input.guestCount,
      tables: result.tables,
      // Giới hạn riêng của hạng mục (allocation.ts, cùng số "Gợi ý" ở tab Ngân sách); tiệc dùng Mục tiêu; còn lại theo chi phí đang chọn
      budget: row.shareLimit ?? row.limit ?? row.cost,
      styles: weddingStyles,
    };
    const tagsOf = weddingStyles.length ? await this.packageTags(packages.filter((p) => summaries.has(p.vendorId)).map((p) => p.id)) : new Map<string, string[]>();

    const candidates: SuggestCandidate[] = visibleIds.map((id) => {
      const pkgs = packages.filter((p) => p.vendorId === id);
      const r = ratings.get(id);
      return {
        id,
        name: summaries.get(id)!.name ?? '',
        city: placeOf.get(id)?.city ?? summaries.get(id)!.location,
        ward: placeOf.get(id)?.ward ?? null,
        packages: pkgs,
        rating: r && r.count ? r.sum / r.count : null,
        reviewCount: r?.count ?? 0,
        styles: [...new Set(pkgs.flatMap((p) => tagsOf.get(p.id) ?? []))],
        inPlan: planIds.has(id),
      };
    });

    const { passed, overBudget, noCapacity } = hardFilter(candidates, ctx);
    // Xếp như ô gợi ý ở tab Ngân sách (topVendors, cùng tiêu chí với pickPackage): mỗi NCC lấy gói tốt nhất trong ngân sách,
    // NCC xếp theo gói đó. Điểm đánh giá, phong cách theo gói lấy từ dữ liệu tab Ngân sách để hai nơi ra cùng thứ tự.
    const passedById = new Map(passed.map((c) => [c.id, c]));
    const want = new Set(weddingStyles.map(normalizePlace));
    const options = packages.flatMap((p) => {
      const c = passedById.get(p.vendorId);
      const estimate = c ? estimateCost([p], ctx.slug, ctx.guestCount, ctx.tables) : null;
      if (!c || !estimate) return [];
      const place = ward ? (c.ward && normalizePlace(c.ward) === normalizePlace(ward) ? 0 : 1) : 0;
      const overlap = p.styles.filter((s) => want.has(normalizePlace(s))).length;
      return [{ id: p.id, vendorId: c.id, cost: estimate.cost, place, rating: p.rating, reviewCount: p.reviewCount, overlap, c, estimate }];
    });
    const picked = topVendors(options, ctx.budget, SUGGESTION_COUNT).map((o) => ({ ...o.c, estimate: o.estimate }));
    // Không gợi ý nào: dịch vụ có chi phí ước tính thấp nhất ngoài ngân sách (để gợi ý tăng ngân sách)
    const cheapest = picked.length ? null : ([...overBudget].sort((a, b) => a.estimate.cost - b.estimate.cost)[0] ?? null);
    const pkgDto = (c: (typeof passed)[number]) => ({
      id: c.estimate.package.id,
      name: c.estimate.package.name,
      cost: c.estimate.cost,
      chargedTables: c.estimate.chargedTables,
      calculation: costCalculation(c.estimate.package, ctx.tables),
    });

    return {
      category,
      budget: ctx.budget,
      /** ALLOCATED: Giới hạn của hạng mục theo thuật toán phân bổ; CHOSEN: hạng mục đã chọn, theo chi phí đang chọn */
      budgetSource: row.status === 'CHOSEN' ? 'CHOSEN' : 'ALLOCATED',
      budgetReason: row.status === 'CHOSEN' ? 'Theo chi phí dịch vụ bạn đã chọn' : 'Theo gợi ý phân bổ ngân sách',
      location: w.city,
      /** Phường/xã nơi tổ chức; null khi chưa có (giao diện ghi "tại {tỉnh/thành}") */
      ward,
      guestCount: isVenue ? ctx.guestCount : null,
      tables: isVenue ? ctx.tables : null,
      // sameWard: NCC cùng phường/xã với nơi tổ chức (tiêu chí xếp hạng đầu tiên), giao diện gắn nhãn "Cùng phường"
      suggestions: dropSharedReasons(
        picked.map((c) => ({ service: summaries.get(c.id)!, ...buildReasons(c, ctx), package: pkgDto(c), sameWard: !!ward && !!c.ward && normalizePlace(c.ward) === normalizePlace(ward) })),
      ),
      /** Số dịch vụ đang hiển thị của hạng mục (để ghi "Xem thêm n dịch vụ") */
      totalInCategory: visibleIds.length,
      /** Qua mọi điều kiện trừ ngân sách */
      outOfBudgetCount: overBudget.length,
      cheapest: cheapest ? summaries.get(cheapest.id)! : null,
      cheapestPackage: cheapest ? pkgDto(cheapest) : null,
      /** Không gợi ý nào: tăng ngân sách hạng mục lên đúng chi phí ước tính thấp nhất */
      raiseBudgetTo: cheapest ? cheapest.estimate.cost : null,
      /** Nhà hàng: không nhà hàng nào có sảnh đủ chỗ (gợi ý sửa số khách) */
      noVenueFits: isVenue && !passed.length && !overBudget.length && noCapacity > 0,
      categoryId: category.id,
      isChosenCategory: w.wedding_categories.some((c) => c.category_id === category.id),
      version: versionOf(await this.prisma.weddings.findUniqueOrThrow({ where: { id: w.id }, select: { updated_date: true } })),
    };
  }

  /** Thẻ phong cách theo gói */
  private async packageTags(packageIds: string[]) {
    const out = new Map<string, string[]>();
    if (!packageIds.length) return out;
    for (const t of await this.prisma.package_tags.findMany({ where: { package_id: { in: packageIds } }, select: { package_id: true, tag: true } })) {
      out.set(t.package_id, [...(out.get(t.package_id) ?? []), t.tag]);
    }
    return out;
  }

  /** Tổng số sao và số đánh giá trên web của từng nhà cung cấp (đánh giá gắn với dòng đơn của NCC đó). */
  private async webRatings(vendorIds: string[]) {
    const out = new Map<string, { sum: number; count: number }>();
    if (!vendorIds.length) return out;
    const rows = await this.prisma.reviews.findMany({
      where: { order_items: { orders: { vendor_id: { in: vendorIds } } } },
      select: { rating: true, order_items: { select: { orders: { select: { vendor_id: true } } } } },
    });
    for (const r of rows) {
      const id = r.order_items.orders?.vendor_id;
      if (!id) continue;
      const cur = out.get(id) ?? { sum: 0, count: 0 };
      out.set(id, { sum: cur.sum + r.rating, count: cur.count + 1 });
    }
    return out;
  }
}

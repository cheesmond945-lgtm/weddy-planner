import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from '../catalog/services.service';
import { CAPACITY_CATEGORIES } from './budget.config';
import { BudgetCalcService } from './budget-calc.service';
import { fitsGuests, packageCost, type EnginePackage } from './budget-engine';
import { versionOf } from './wedding-version';
import { WeddingsService } from './weddings.service';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

/** Phép tính chi phí một gói để hiện cho khách: "25 bàn × 5.000.000đ = 125.000.000đ". */
export function costCalculation(p: EnginePackage, tables: number) {
  if (p.unit !== 'mâm') return `${p.name}: ${money(p.price)} trọn gói`;
  const n = Math.max(tables, p.minTables ?? 0, 1);
  const min = p.minTables && p.minTables > tables ? ` (tối thiểu ${p.minTables} bàn)` : '';
  return `${p.name}: ${n} bàn × ${money(p.price)} = ${money(packageCost(p, tables))}${min}`;
}

/**
 * Gợi ý dịch vụ theo hạng mục. Bộ lọc và xếp hạng theo luật (không gọi mô hình ngôn ngữ), chạy trên dữ liệu thật:
 * - Lọc: cùng khu vực; nhà hàng phải có sảnh đủ chỗ cho số khách; gói rẻ nhất (đủ chỗ) nằm trong ngân sách hạng mục.
 * - Xếp: điểm đánh giá, rồi số lượt đánh giá (cuối cùng chi phí thấp hơn, chỉ để thứ tự ổn định).
 * Ngân sách hạng mục lấy như tab Ngân sách (budget-engine.ts). Không xét phong cách.
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
    const row = result.categories.find((c) => c.categoryId === category.id)!;
    const budget = row.budget;
    const tables = result.tables.count;
    const isVenue = CAPACITY_CATEGORIES.includes(categorySlug);
    const packages = input.categories.find((c) => c.id === category.id)?.packages ?? [];

    // Mỗi nhà cung cấp: gói rẻ nhất trong các gói đủ chỗ (nhà hàng không có sảnh nào đủ chỗ thì loại)
    const vendorIds = [...new Set(packages.map((p) => p.vendorId))];
    const summaries = new Map((await this.services.summaries(vendorIds)).map((s) => [s.id, s]));
    const options = vendorIds
      .map((id) => {
        const pkgs = packages.filter((p) => p.vendorId === id);
        const fit = pkgs.filter((p) => fitsGuests(p, categorySlug, input.guestCount)).map((p) => ({ p, cost: packageCost(p, tables) }));
        fit.sort((a, b) => a.cost - b.cost);
        const capacity = Math.max(0, ...pkgs.map((p) => p.capacity ?? 0));
        return { id, summary: summaries.get(id), cheapest: fit[0] ?? null, capacity };
      })
      .filter((o) => o.summary && o.summary.location === w.city);

    const fitting = options.filter((o) => o.cheapest);
    const picked = fitting
      .filter((o) => o.cheapest!.cost <= budget)
      .sort((a, b) => b.summary!.rating - a.summary!.rating || b.summary!.reviewCount - a.summary!.reviewCount || a.cheapest!.cost - b.cheapest!.cost)
      .slice(0, 3);
    const cheapest = picked.length ? null : ([...fitting].sort((a, b) => a.cheapest!.cost - b.cheapest!.cost)[0] ?? null);

    const pkgDto = (o: (typeof options)[number]) => ({ id: o.cheapest!.p.id, name: o.cheapest!.p.name, cost: o.cheapest!.cost, calculation: costCalculation(o.cheapest!.p, tables) });
    return {
      category,
      budget,
      budgetSource: row.manual ? 'ALLOCATED' : 'ESTIMATED',
      budgetReason: row.reason,
      location: w.city,
      guestCount: isVenue ? input.guestCount : null,
      tables: isVenue ? tables : null,
      suggestions: picked.map((o) => {
        const s = o.summary!;
        const reasons = [`${costCalculation(o.cheapest!.p, tables)}, trong ngân sách hạng mục ${money(budget)}.`];
        if (s.rating > 0) reasons.push(`Điểm ${s.rating.toFixed(1)} trên Google Maps (${s.reviewCount.toLocaleString('vi-VN')} đánh giá).`);
        if (isVenue && o.capacity) reasons.push(`Sảnh chứa tối đa ${o.capacity.toLocaleString('vi-VN')} khách, đủ cho ${input.guestCount.toLocaleString('vi-VN')} khách.`);
        return { service: s, reasons, package: pkgDto(o) };
      }),
      cheapest: cheapest ? cheapest.summary! : null,
      cheapestPackage: cheapest ? pkgDto(cheapest) : null,
      /** Không gợi ý nào: tăng ngân sách hạng mục lên đúng chi phí gói rẻ nhất đủ chỗ */
      raiseBudgetTo: cheapest ? cheapest.cheapest!.cost : null,
      /** Nhà hàng: không nhà hàng nào có sảnh đủ chỗ (gợi ý sửa số khách) */
      noVenueFits: isVenue && options.length > 0 && !fitting.length,
      categoryId: category.id,
      isChosenCategory: w.wedding_categories.some((c) => c.category_id === category.id),
      version: versionOf(await this.prisma.weddings.findUniqueOrThrow({ where: { id: w.id }, select: { updated_date: true } })),
    };
  }
}

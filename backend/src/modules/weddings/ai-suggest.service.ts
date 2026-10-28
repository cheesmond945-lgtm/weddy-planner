import { HttpException, Injectable } from '@nestjs/common';
import { ServicesService, estimateCost } from '../catalog/services.service';
import { WeddingsService } from './weddings.service';

/** Tỷ lệ ngân sách gợi ý theo hạng mục (docs/api/weddings.md mục 4). */
const BUDGET_SHARE: Record<string, number> = { 'nha-hang': 0.22, decor: 0.14, 'co-cuoi': 0.14, 'chup-anh': 0.12, 'hoa-cuoi': 0.12, 'trang-phuc': 0.1, makeup: 0.08 };

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const millions = (n: number) => `${(n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} triệu`;

/**
 * Gợi ý dịch vụ theo hạng mục. Đây là bộ lọc và xếp hạng theo luật (không gọi mô hình ngôn ngữ), chạy trên dữ liệu thật:
 * cùng khu vực, chi phí ước tính (giá "từ", trung tâm sự kiện thì × số mâm) trong ngân sách hạng mục, nhà hàng đủ sức chứa; xếp theo số phong cách trùng, điểm, số đánh giá, giá.
 * Kết quả luôn là dịch vụ có thật trên hệ thống.
 */
@Injectable()
export class AiSuggestService {
  constructor(private readonly services: ServicesService, private readonly weddings: WeddingsService) {}

  async suggest(userId: string, categorySlug: string) {
    const share = BUDGET_SHARE[categorySlug];
    if (!share) return fail('VALIDATION_ERROR', 'Hạng mục không hợp lệ.', 400);
    const w = await this.weddings.requireWedding(userId);
    const wedding = (await this.weddings.getMine(userId))!;
    const category = (await this.services.categories()).find((c) => c.slug === categorySlug);
    if (!category) return fail('VALIDATION_ERROR', 'Hạng mục không hợp lệ.', 400);

    const budget = Math.round((wedding.budget * share) / 1e5) * 1e5;
    const guestCount = categorySlug === 'nha-hang' ? w.guest_count : null;
    const list = (await this.services.list({ category: categorySlug, pageSize: 100 })).items;
    const all = await Promise.all(list.map((s) => this.services.detail(s.id)));

    const hitsOf = (s: (typeof all)[number]) => s.styles.filter((x) => wedding.styles.includes(x));
    // Giá theo mâm (trung tâm sự kiện): so ngân sách với giá mâm × số mâm cần đặt, không phải giá một mâm
    const costOf = (s: (typeof all)[number]) => estimateCost(categorySlug, s.priceFrom, s.minTables, w.guest_count);
    const fits = (s: (typeof all)[number]) => costOf(s).total <= budget && (!guestCount || (s.capacity ?? 0) >= guestCount);
    const picked = all
      .filter((s) => s.location === wedding.location && fits(s))
      .sort((a, b) => hitsOf(b).length - hitsOf(a).length || b.rating - a.rating || b.reviewCount - a.reviewCount || a.priceFrom - b.priceFrom)
      .slice(0, 3);
    const cheapest = (xs: typeof all) => [...xs].sort((a, b) => a.priceFrom - b.priceFrom)[0];
    const cheap = cheapest(all.filter((s) => s.location === wedding.location)) ?? cheapest(all);

    const sums = new Map((await this.services.summaries([...picked.map((s) => s.id), ...(cheap ? [cheap.id] : [])])).map((s) => [s.id, s]));
    return {
      category,
      budget,
      budgetSource: 'ESTIMATED',
      location: wedding.location,
      styles: wedding.styles,
      guestCount,
      suggestions: picked.map((s) => {
        const hits = hitsOf(s);
        const cost = costOf(s);
        const reasons = [
          cost.tables
            ? `Từ ${millions(s.priceFrom)}/mâm (đã gồm sảnh), ${cost.tables} mâm khoảng ${millions(cost.total)}, nằm trong ngân sách hạng mục.`
            : `Giá từ ${millions(s.priceFrom)}, nằm trong ngân sách hạng mục.`,
        ];
        if (hits.length) reasons.push(`Hợp phong cách ${hits.join(', ').toLowerCase()}.`);
        if (s.rating > 0) reasons.push(`Điểm ${s.rating.toFixed(1)} trên Google Maps.`);
        if (s.capacity && guestCount) reasons.push(`Chứa tối đa ${s.capacity} khách.`);
        return { service: sums.get(s.id)!, reasons };
      }),
      cheapest: picked.length || !cheap ? null : (sums.get(cheap.id) ?? null),
    };
  }
}

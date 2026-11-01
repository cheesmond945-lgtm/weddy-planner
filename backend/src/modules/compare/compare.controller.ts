import { Controller, Get, HttpException, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GooglePlacesService } from '../../integrations/google-places/google-places.service';
import { ServicesService } from '../catalog/services.service';
import { WeddingMembersService } from '../wedding-members/wedding-members.service';
import { BudgetCalcService } from '../weddings/budget-calc.service';
import { fitsGuests, packageCost, tableCount } from '../weddings/budget-engine';
import { recommend } from './recommend';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

/** So sánh 2-3 nhà cung cấp cùng hạng mục và đề xuất một phương án (docs/api/compare.md). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('compare')
export class CompareController {
  constructor(
    private readonly services: ServicesService,
    private readonly places: GooglePlacesService,
    private readonly members: WeddingMembersService,
    private readonly calc: BudgetCalcService,
  ) {}

  @Get()
  async compare(@Req() req: any, @Query('serviceIds') serviceIds = '') {
    const ids = [...new Set(serviceIds.split(',').map((s) => s.trim()).filter(Boolean))];
    if (ids.length < 2 || ids.length > 3) return fail('COMPARE_INVALID_COUNT', 'Chọn từ 2 đến 3 nhà cung cấp để so sánh.', 400);

    const items: Awaited<ReturnType<ServicesService['detail']>>[] = [];
    for (const id of ids) items.push(await this.services.detail(id)); // 404 SERVICE_NOT_FOUND nếu không có
    const slug = items[0].category.slug;
    if (items.some((s) => s.category.slug !== slug)) return fail('COMPARE_MIXED_CATEGORIES', 'Chỉ so sánh được các nhà cung cấp cùng hạng mục.', 400);

    // Đám cưới người gọi đang tham gia (có thể chưa thiết lập): ngân sách hạng mục như tab Ngân sách, số bàn
    const access = await this.members.resolve(req.user.sub);
    const calc = access ? await this.calc.compute(access.weddingId) : null;
    const guestCount = calc?.input.guestCount ?? null;
    const tables = calc ? calc.result.tables.count : tableCount(0, null);
    const categoryBudget = calc?.result.categories.find((c) => c.slug === slug)?.budget ?? null;

    // Chi phí so sánh của mỗi nhà cung cấp: gói rẻ nhất (đủ chỗ nếu có) theo số bàn hiện tại
    const pkgs = await this.calc.sellingPackages({ vendorIds: ids });
    const costOf = (id: string) => {
      const mine = pkgs.filter((p) => p.vendorId === id);
      const fit = guestCount === null ? mine : mine.filter((p) => fitsGuests(p, slug, guestCount));
      const pool = fit.length ? fit : mine;
      return pool.length ? Math.min(...pool.map((p) => packageCost(p, tables))) : items.find((s) => s.id === id)!.priceFrom;
    };
    const costs = items.map((s) => costOf(s.id));

    // Điểm Google lấy lúc gọi; thiếu điểm thì hàm đề xuất bỏ yếu tố điểm cho cả nhóm
    const scores = await Promise.all(items.map((s) => this.places.ratingOrNull(s.id)));
    const rec = recommend(
      items.map((s, i) => ({ id: s.id, price: costs[i], rating: scores[i]?.rating ?? null, reviewCount: scores[i]?.reviewCount ?? null, capacity: s.capacity })),
      calc ? { categoryBudget, guestCount } : null,
      slug,
    );
    return {
      items: items.map((s, i) => ({ ...s, cost: costs[i] })),
      categoryBudget,
      tables: calc ? tables : null,
      recommendation: { serviceId: rec.recommendedId, reasons: rec.reasons, isTie: rec.isTie, usedRating: rec.usedRating },
    };
  }
}

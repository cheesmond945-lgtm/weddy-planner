import { Controller, Get, HttpException, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService, estimateCost } from '../catalog/services.service';
import { recommend } from './recommend';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

/** So sánh 2-3 nhà cung cấp cùng hạng mục và đề xuất một phương án (docs/api/compare.md). */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('compare')
export class CompareController {
  constructor(private readonly prisma: PrismaService, private readonly services: ServicesService) {}

  @Get()
  async compare(@Req() req: any, @Query('serviceIds') serviceIds = '') {
    const ids = [...new Set(serviceIds.split(',').map((s) => s.trim()).filter(Boolean))];
    if (ids.length < 2 || ids.length > 3) return fail('COMPARE_INVALID_COUNT', 'Chọn từ 2 đến 3 nhà cung cấp để so sánh.', 400);

    const items: Awaited<ReturnType<ServicesService['detail']>>[] = [];
    for (const id of ids) items.push(await this.services.detail(id)); // 404 SERVICE_NOT_FOUND nếu không có
    const slug = items[0].category.slug;
    if (items.some((s) => s.category.slug !== slug)) return fail('COMPARE_MIXED_CATEGORIES', 'Chỉ so sánh được các nhà cung cấp cùng hạng mục.', 400);

    // Thông tin đám cưới của người gọi (có thể chưa thiết lập)
    const w = await this.prisma.weddings.findUnique({ where: { user_id: req.user.sub } });
    const rec = recommend(
      // Giá theo mâm: so bằng chi phí ước tính cho số khách (giá mâm × số mâm), để khớp ngân sách hạng mục
      items.map((s) => ({ id: s.id, price: estimateCost(slug, s.priceFrom, s.minTables, w?.guest_count).total, rating: s.rating, reviewCount: s.reviewCount, styles: s.styles, city: s.location ?? '', capacity: s.capacity })),
      w ? { budget: Number(w.budget), guestCount: w.guest_count, city: w.city, styles: w.style ? w.style.split(',').map((x) => x.trim()).filter(Boolean) : [] } : null,
      slug,
    );
    return { items, recommendation: { serviceId: rec.recommendedId, reasons: rec.reasons, isTie: rec.isTie } };
  }
}

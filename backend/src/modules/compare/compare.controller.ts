import { Controller, Get, HttpException, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from '../catalog/services.service';
import { BudgetCalcService } from '../weddings/budget-calc.service';
import { officialWard } from '../weddings/wards';
import { WeddingsService } from '../weddings/weddings.service';
import { compareServices } from './compare-rules';

const fail = (code: string, message: string, status: number): never => {
  throw new HttpException({ code, message }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * So sánh 2-3 dịch vụ cùng hạng mục bằng thuật toán, không gọi AI và không đề xuất bên nào (docs/api/compare.md).
 * Mọi phép tính ở compare-rules.ts; đổi gói ở FE thì gọi lại kèm packageIds để BE tính lại các dòng và dòng tóm tắt.
 */
@UseGuards(JwtAuthGuard)
@Roles('Couple')
@Controller('compare')
export class CompareController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly weddings: WeddingsService,
    private readonly calc: BudgetCalcService,
  ) {}

  @Get()
  async compare(@Req() req: any, @Query('serviceIds') serviceIds = '', @Query('packageIds') packageIds = '') {
    const ids = [...new Set(serviceIds.split(',').map((s) => s.trim()).filter(Boolean))];
    if (ids.length < 2 || ids.length > 3) return fail('COMPARE_INVALID_COUNT', 'Chọn từ 2 đến 3 dịch vụ để so sánh.', 400);
    if (ids.some((id) => !UUID.test(id))) return fail('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ.', 404);

    const items: Awaited<ReturnType<ServicesService['detail']>>[] = [];
    for (const id of ids) items.push(await this.services.detail(id)); // 404 SERVICE_NOT_FOUND nếu không có hoặc đang ẩn
    const slug = items[0].category.slug;
    if (items.some((s) => s.category.slug !== slug)) return fail('COMPARE_MIXED_CATEGORIES', 'Chỉ so sánh được dịch vụ cùng hạng mục.', 400);

    const profiles = await this.prisma.vendor_profiles.findMany({ where: { id: { in: ids } }, select: { id: true, ward: true } });
    const wardOf = new Map(profiles.map((p) => [p.id, p.ward]));
    const categoryId = items[0].category.id;

    // Đám cưới của người gọi (có thể chưa thiết lập). Ngân sách hạng mục = giới hạn của hàm phân bổ (tab Ngân sách);
    // hạng mục chưa nằm trong kế hoạch thì tính thêm hạng mục đó.
    const wedding = await this.weddings.findWedding(req.user.sub);
    const calc = wedding ? await this.calc.compute(wedding.id, [categoryId]) : null;
    const guestCount = calc && calc.input.guestCount > 0 ? calc.input.guestCount : null;
    const row = calc?.result.rows.find((r) => r.slug === slug);
    const budget = calc && calc.input.total > 0 && row ? (row.shareLimit ?? row.limit ?? row.cost) : null;

    // Gói khách chọn ở dropdown: "serviceId:packageId", chỉ nhận gói thuộc đúng dịch vụ
    const picked: Record<string, string> = {};
    for (const pair of packageIds.split(',')) {
      const [sid, pid] = pair.split(':').map((s) => s?.trim());
      if (sid && pid && items.find((s) => s.id === sid)?.packages.some((p) => p.id === pid)) picked[sid] = pid;
    }

    const comparison = compareServices(
      items.map((s) => ({
        id: s.id,
        name: s.name ?? '',
        ward: officialWard(wardOf.get(s.id)),
        rating: s.reviewCount > 0 ? s.rating : null,
        reviewCount: s.reviewCount,
        packages: s.packages.map((p) => ({ id: p.id, name: p.name ?? '', price: p.price, minTables: p.minTables ?? null, capacity: p.capacity ?? null, description: p.description, tags: p.tags })),
      })),
      {
        slug,
        guestCount,
        tables: guestCount !== null ? calc!.result.tables : null,
        budget,
        weddingWard: (wedding as { ward?: string | null } | null)?.ward ?? null,
      },
      picked,
    );

    return {
      category: items[0].category,
      /** ServiceDetail cho đầu cột và nút (thêm vào kế hoạch, xem chi tiết); số liệu so sánh nằm ở comparison */
      items,
      budget,
      guestCount,
      tables: guestCount !== null ? calc!.result.tables : null,
      comparison,
    };
  }
}

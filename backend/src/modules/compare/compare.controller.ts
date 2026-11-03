import { Controller, Get, HttpException, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService } from '../catalog/services.service';
import { BudgetCalcService } from '../weddings/budget-calc.service';
import { officialWard } from '../weddings/wards';
import { WeddingsService } from '../weddings/weddings.service';
import { AvailabilityService } from '../availability/availability.service';
import { hallConflict } from '../halls/hall-busy';
import { loadBusy } from '../halls/hall-store';
import { allocate, consequenceOf } from '../weddings/allocation';
import { compareServices, isVenue, round10k, type DayAvailability } from './compare-rules';

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
    private readonly availability: AvailabilityService,
  ) {}

  /**
   * Các khoản của phép tính "còn lại cho các dịch vụ chưa chọn" nếu hạng mục tốn `cost` (cùng consequenceOf của tab Ngân sách):
   * Tổng ngân sách − đã chọn ở hạng mục khác − hạng mục này − tiền cọc có thể mất (đổi khỏi NCC đã cọc) − cọc đã mất − chi phí khác
   * − tiệc tự lo. Khoản bằng 0 bỏ đi (trừ hạng mục này).
   */
  private consequenceParts(input: Parameters<typeof consequenceOf>[0], categoryId: string, cost: number, depositAtRisk: number) {
    const res = consequenceOf(input, categoryId, cost);
    const lost = input.lostDeposits ?? 0;
    const extra = input.extraCosts ?? 0;
    const ownVenue = input.ownVenue ? Math.max(0, input.ownVenueCost ?? 0) : 0;
    const chosenOthers = input.total - res.available - cost - lost - extra - ownVenue;
    const parts: { label: string; amount: number; sign: 1 | -1 }[] = [
      { label: 'Tổng ngân sách', amount: input.total, sign: 1 },
      { label: 'đã chọn ở hạng mục khác', amount: chosenOthers, sign: -1 },
      { label: 'hạng mục này', amount: cost, sign: -1 },
      { label: 'cọc có thể mất', amount: depositAtRisk, sign: -1 },
      { label: 'cọc đã mất', amount: lost, sign: -1 },
      { label: 'chi phí khác', amount: extra, sign: -1 },
      { label: 'tiệc tự lo', amount: ownVenue, sign: -1 },
    ];
    return { openCount: res.openCount, parts: parts.filter((x) => x.label === 'hạng mục này' || x.amount > 0) };
  }

  /**
   * Lịch ngày cưới của từng gói (packageId -> trạng thái). Tiệc: sảnh có đơn đã cọc của khách khác hoặc NCC đánh dấu bận là
   * "Đã kín", còn lại "Còn trống" (cùng cách tính nhãn "Còn x/y sảnh trống" ở danh sách); lịch khả dụng NCC khai "Đã kín" /
   * "Giữ chỗ" vẫn được tính. Hạng mục khác: theo lịch khả dụng NCC khai (Còn trống / Đã kín), chưa khai thì "Chưa xác nhận".
   * Đơn của chính khách (đám cưới `weddingId`) không làm sảnh kín với khách đó.
   */
  private async dayAvailability(slug: string, packageIds: string[], serviceIds: string[], date: string, weddingId: string) {
    const out: Record<string, DayAvailability> = {};
    let stored: Record<string, { packageId: string; status: string }[]> = {};
    try {
      stored = (await this.availability.forServices(serviceIds.join(','), date)).services;
    } catch {
      // Bảng lịch khả dụng chưa có (SQL chưa chạy): chỉ dựa vào lịch sảnh
    }
    const ownOrders = await this.prisma.orders.findMany({ where: { wedding_id: weddingId }, select: { id: true, package_id: true, status: true } });
    const own = new Set(ownOrders.map((o) => o.id));
    const mine = new Set(ownOrders.filter((o) => o.package_id && (o.status === 'Deposited' || o.status === 'Completed')).map((o) => o.package_id!));
    const busy = isVenue(slug) ? await loadBusy(this.prisma, packageIds, date, date) : { orders: [], manual: [] };
    const others = busy.orders.filter((o) => !own.has(o.orderId));
    const statusOf = new Map(
      Object.values(stored)
        .flat()
        .map((x) => [x.packageId, x.status]),
    );
    for (const id of packageIds) {
      const st = statusOf.get(id);
      if (mine.has(id)) {
        out[id] = 'MINE';
        continue;
      }
      if (isVenue(slug)) out[id] = hallConflict(id, date, others, busy.manual) || st === 'BOOKED' ? 'FULL' : st === 'HELD' ? 'UNCONFIRMED' : 'FREE';
      else out[id] = st === 'BOOKED' ? 'FULL' : st === 'AVAILABLE' ? 'FREE' : 'UNCONFIRMED';
    }
    return out;
  }

  @Get()
  async compare(@Req() req: any, @Query('serviceIds') serviceIds = '', @Query('packageIds') packageIds = '') {
    const ids = [
      ...new Set(
        serviceIds
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ];
    if (ids.length < 2 || ids.length > 3) return fail('COMPARE_INVALID_COUNT', 'Chọn từ 2 đến 3 dịch vụ để so sánh.', 400);
    if (ids.some((id) => !UUID.test(id))) return fail('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ.', 404);

    const items: Awaited<ReturnType<ServicesService['detail']>>[] = [];
    for (const id of ids) items.push(await this.services.detail(id)); // 404 SERVICE_NOT_FOUND nếu không có hoặc đang ẩn
    const slug = items[0].category.slug;
    if (items.some((s) => s.category.slug !== slug)) return fail('COMPARE_MIXED_CATEGORIES', 'Chỉ so sánh được dịch vụ cùng hạng mục.', 400);

    const profiles = await this.prisma.vendor_profiles.findMany({
      where: { id: { in: ids } },
      select: { id: true, ward: true },
    });
    const wardOf = new Map(profiles.map((p) => [p.id, p.ward]));
    const categoryId = items[0].category.id;

    // Đám cưới của người gọi (có thể chưa thiết lập). Ngân sách hạng mục = giới hạn của hàm phân bổ (tab Ngân sách);
    // hạng mục chưa nằm trong kế hoạch thì tính thêm hạng mục đó.
    const wedding = await this.weddings.findWedding(req.user.sub);
    const calc = wedding ? await this.calc.compute(wedding.id, [categoryId]) : null;
    const guestCount = calc && calc.input.guestCount > 0 ? calc.input.guestCount : null;
    // Mốc so sánh = giới hạn gợi ý của hạng mục như khi chưa chọn NCC nào (không dùng giá đơn đang có): tính lại phân bổ
    // sau khi bỏ các NCC của hạng mục này khỏi kế hoạch
    const unchosen = calc
      ? allocate({
          ...calc.input,
          planVendors: calc.input.planVendors.filter((v) => v.categoryId !== categoryId),
        })
      : null;
    const row = unchosen?.rows.find((r) => r.slug === slug);
    const budget = calc && calc.input.total > 0 && row ? (row.shareLimit ?? row.limit ?? null) : null;
    // NCC của hạng mục này khách đã cọc: các NCC khác không thêm được từ trang So sánh
    const deposited = calc?.input.planVendors.find((v) => v.categoryId === categoryId && !v.cancelled && v.orderDeposited !== null) ?? null;
    // Đơn còn hiệu lực của khách theo NCC: giá đơn và gói trong đơn (đơn mới nhất)
    const orderRows = wedding
      ? await this.prisma.orders.findMany({
          where: { wedding_id: wedding.id, vendor_id: { in: ids }, status: { not: 'Cancelled' } },
          orderBy: { created_date: 'desc' },
          select: { vendor_id: true, package_id: true },
        })
      : [];
    const orderPackage = new Map<string, string | null>();
    for (const o of orderRows) if (o.vendor_id && !orderPackage.has(o.vendor_id)) orderPackage.set(o.vendor_id, o.package_id ?? null);
    const orderOf = new Map(
      (calc?.input.planVendors ?? [])
        .filter((v) => !v.cancelled && v.orderTotal !== null)
        .map((v) => [v.vendorId, { total: v.orderTotal!, deposited: v.orderDeposited !== null, packageId: orderPackage.get(v.vendorId) ?? null }]),
    );
    const weddingDate = wedding?.wedding_date ? wedding.wedding_date.toISOString().slice(0, 10) : null;
    const availability =
      wedding && weddingDate
        ? await this.dayAvailability(
            slug,
            items.flatMap((s) => s.packages.map((p) => p.id)),
            ids,
            weddingDate,
            wedding.id,
          )
        : null;

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
        availability: availability ?? undefined,
        order: orderOf.get(s.id) ?? null,
        packages: s.packages.map((p) => ({
          id: p.id,
          name: p.name ?? '',
          price: p.price,
          minTables: p.minTables ?? null,
          capacity: p.capacity ?? null,
          description: p.description,
          tags: p.tags,
        })),
      })),
      {
        slug,
        guestCount,
        tables: guestCount !== null ? calc!.result.tables : null,
        budget,
        weddingWard: (wedding as { ward?: string | null } | null)?.ward ?? null,
        weddingDate,
        lockedBy: deposited?.vendorName ?? null,
        lockedDeposit: deposited?.orderDeposited ?? 0,
        consequence:
          calc && calc.input.total > 0 ? (total: number, switching: boolean) => this.consequenceParts(calc.input, categoryId, total, switching ? (deposited?.orderDeposited ?? 0) : 0) : null,
      },
      picked,
    );

    return {
      category: items[0].category,
      /** ServiceDetail cho đầu cột và nút (thêm vào kế hoạch, xem chi tiết); số liệu so sánh nằm ở comparison */
      items,
      budget: budget === null ? null : round10k(budget),
      guestCount,
      tables: guestCount !== null ? calc!.result.tables : null,
      comparison,
    };
  }
}

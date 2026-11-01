import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { todayVn } from '../orders/order-rules';
import { BUSY_QUERY_MAX_DAYS, HALL_CATEGORY_SLUG, HALL_PACKAGE_STATUSES, busyDatesOf, busyDays, hallsFreeOn, isYmd, parseManual, spanDays } from './hall-busy';
import { loadBusy, usesHalls } from './hall-store';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Số NCC tối đa một lần hỏi số sảnh trống (danh sách dịch vụ). */
const FREE_MAX_IDS = 100;

const fail = (code: string, message: string, status: number, details?: Record<string, string>): never => {
  throw new HttpException({ code, message, ...(details && { details }) }, status);
};
const at = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const ymdOf = (d: Date) => d.toISOString().slice(0, 10);

/** from, to dạng YYYY-MM-DD, from không sau to, tối đa BUSY_QUERY_MAX_DAYS ngày. */
function checkRange(from: unknown, to: unknown): { from: string; to: string } {
  if (!isYmd(from) || !isYmd(to) || from > to) return fail('VALIDATION_ERROR', 'Chọn khoảng ngày hợp lệ (from, to dạng YYYY-MM-DD, from không sau to).', 400);
  if (spanDays(from, to) > BUSY_QUERY_MAX_DAYS) return fail('VALIDATION_ERROR', `Khoảng ngày tối đa ${BUSY_QUERY_MAX_DAYS} ngày.`, 400);
  return { from, to };
}

/**
 * Lịch bận theo sảnh của Trung tâm tổ chức sự kiện (docs/LICH_BAN_SANH.md): NCC xem và đánh dấu / gỡ ngày bận thủ công;
 * khách xem ngày bận của từng sảnh (không lộ khách hay đơn khác) và số sảnh còn trống ngày cưới.
 */
@Injectable()
export class HallsService {
  constructor(private readonly prisma: PrismaService) {}

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true, category_id: true } });
    return v ?? fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
  }

  /** Các sảnh của NCC (gói đang đăng hoặc đã ẩn). NCC không phải trung tâm sự kiện: enabled = false. Form đơn dùng để chọn sảnh. */
  async vendorHalls(userId: string) {
    const v = await this.vendorOf(userId);
    if (!(await usesHalls(this.prisma, v.category_id))) return { enabled: false, halls: [] as { id: string; name: string; hidden: boolean }[] };
    const halls = await this.prisma.service_packages.findMany({
      where: { vendor_id: v.id, status: { in: HALL_PACKAGE_STATUSES } },
      select: { id: true, name: true, status: true },
      orderBy: [{ created_date: 'asc' }, { id: 'asc' }],
    });
    return { enabled: true, halls: halls.map((h) => ({ id: h.id, name: h.name ?? '', hidden: h.status === 'Hidden' })) };
  }

  /** Tab Lịch bận của NCC: các sảnh và từng (sảnh, ngày, nguồn) bận trong [from, to]. NCC không phải trung tâm sự kiện: enabled = false. */
  async vendorCalendar(userId: string, from: unknown, to: unknown) {
    const range = checkRange(from, to);
    const { enabled, halls } = await this.vendorHalls(userId);
    if (!enabled) return { enabled, halls, items: [] };
    const { orders, manual } = await loadBusy(this.prisma, halls.map((h) => h.id), range.from, range.to);
    return { enabled, halls, items: busyDays(orders, manual, range.from, range.to) };
  }

  /**
   * NCC đánh dấu bận thủ công: một hoặc nhiều sảnh, một ngày hoặc khoảng ngày, kèm lý do; mỗi sảnh một dòng.
   * Trả thêm các đơn Chờ cọc / Chờ chỉnh sửa rơi vào khoảng đó: khách của các đơn này sẽ không đặt cọc được.
   */
  async addManual(userId: string, body: { packageIds?: unknown; startDate?: unknown; endDate?: unknown; reason?: unknown }) {
    const v = await this.vendorOf(userId);
    if (!(await usesHalls(this.prisma, v.category_id))) return fail('HALLS_NOT_SUPPORTED', 'Lịch bận theo sảnh chỉ dành cho Trung tâm tổ chức sự kiện.', 409);
    const parsed = parseManual(body ?? {}, todayVn());
    if ('errors' in parsed) return fail('VALIDATION_ERROR', 'Ngày bận chưa hợp lệ.', 400, parsed.errors);
    const { packageIds, startDate, endDate, reason } = parsed.value;
    const own = await this.prisma.service_packages.findMany({ where: { id: { in: packageIds }, vendor_id: v.id, status: { in: HALL_PACKAGE_STATUSES } }, select: { id: true, name: true } });
    if (own.length !== packageIds.length) return fail('VALIDATION_ERROR', 'Ngày bận chưa hợp lệ.', 400, { packageIds: 'Sảnh không thuộc nhà cung cấp này.' });

    await this.prisma.package_busy_dates.createMany({ data: own.map((p) => ({ package_id: p.id, start_date: at(startDate), end_date: at(endDate), reason })) });
    const waiting = await this.prisma.orders.findMany({
      where: { package_id: { in: packageIds }, status: { in: ['Pending', 'NeedRevision'] }, event_date: { gte: at(startDate), lte: at(endDate) } },
      select: { order_code: true, event_date: true, package_id: true },
      orderBy: { event_date: 'asc' },
    });
    const nameOf = new Map(own.map((p) => [p.id, p.name ?? '']));
    return {
      created: own.length,
      waitingOrders: waiting.map((o) => ({ orderCode: o.order_code ?? '', date: o.event_date ? ymdOf(o.event_date) : '', hallName: nameOf.get(o.package_id ?? '') ?? '' })),
    };
  }

  /** Gỡ một lần đánh dấu bận thủ công (cả khoảng ngày của lần đó). Ngày bận từ đơn không gỡ được ở đây. */
  async removeManual(userId: string, id: string) {
    const v = await this.vendorOf(userId);
    const row = UUID.test(id) ? await this.prisma.package_busy_dates.findFirst({ where: { id, service_packages: { vendor_id: v.id } }, select: { id: true } }) : null;
    if (!row) return fail('BUSY_DATE_NOT_FOUND', 'Không tìm thấy ngày bận này.', 404);
    await this.prisma.package_busy_dates.delete({ where: { id: row.id } });
    return { id: row.id };
  }

  /** Ngày bận của một sảnh cho khách (công khai): chỉ ngày, không nguồn. Gói không thuộc trung tâm sự kiện: hall = false. */
  async hallDates(packageId: string, from: unknown, to: unknown) {
    const range = checkRange(from, to);
    const pkg = UUID.test(packageId)
      ? await this.prisma.service_packages.findFirst({
          where: { id: packageId, status: 'Approved', vendor_profiles: { status: 'Approved' } },
          select: { id: true, vendor_profiles: { select: { category_id: true } } },
        })
      : null;
    if (!pkg) return fail('PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.', 404);
    if (!(await usesHalls(this.prisma, pkg.vendor_profiles?.category_id))) return { hall: false, dates: [] as string[] };
    const { orders, manual } = await loadBusy(this.prisma, [pkg.id], range.from, range.to);
    return { hall: true, dates: busyDatesOf(pkg.id, orders, manual, range.from, range.to) };
  }

  /** Số sảnh (gói đang đăng) và số sảnh còn trống ngày `date` của các trung tâm sự kiện trong `ids`; NCC khác không có mặt. */
  async freeOn(date: unknown, ids: unknown) {
    if (!isYmd(date)) return fail('VALIDATION_ERROR', 'Chọn ngày hợp lệ (date dạng YYYY-MM-DD).', 400);
    const list = [...new Set(String(ids ?? '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s)))];
    if (list.length > FREE_MAX_IDS) return fail('VALIDATION_ERROR', `Tối đa ${FREE_MAX_IDS} dịch vụ mỗi lần.`, 400);
    if (!list.length) return {};
    const vendors = await this.prisma.vendor_profiles.findMany({ where: { id: { in: list }, status: 'Approved' }, select: { id: true, service_categories: { select: { name: true } } } });
    const hallVendors = vendors.filter((v) => categorySlug(v.service_categories?.name ?? null) === HALL_CATEGORY_SLUG).map((v) => v.id);
    if (!hallVendors.length) return {};
    const halls = await this.prisma.service_packages.findMany({ where: { vendor_id: { in: hallVendors }, status: 'Approved' }, select: { id: true, vendor_id: true } });
    const { orders, manual } = await loadBusy(this.prisma, halls.map((h) => h.id), date, date);
    return hallsFreeOn(
      halls.flatMap((h) => (h.vendor_id ? [{ id: h.id, vendorId: h.vendor_id }] : [])),
      orders,
      manual,
      date,
    );
  }
}

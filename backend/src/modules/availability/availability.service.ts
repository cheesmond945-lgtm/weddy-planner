import { HttpException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { dbFeatures, requireDbFeature } from '../../prisma/db-features';
import { publish } from '../realtime/realtime.bus';
import {
  MONTH_RANGE,
  REMIND_AFTER_DAYS,
  REMIND_WINDOW_DAYS,
  TO_API,
  TO_DB,
  daysSince,
  effectiveDay,
  isoDate,
  monthDays,
  monthOffset,
  siblingsOf,
  validDate,
  type DayStatus,
  type RulePackage,
  type StoredMap,
  type StoredStatus,
} from './availability-rules';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VISIBLE_VENDOR = { status: 'Approved', users: { status: 'Active' } } as const;
const MAX_SERVICES = 60;
const MAX_DATES = 62;
const STATUSES: DayStatus[] = ['AVAILABLE', 'HELD', 'BOOKED', 'UNKNOWN'];
const REMINDER_TYPE = 'AvailabilityReminder';
const DAY_MS = 86_400_000;
const REMINDER_JOB_EVERY_MS = 6 * 3_600_000;

/** Hôm nay theo giờ Việt Nam, dạng Date 00:00 UTC (cùng cách lưu cột date). */
const todayVn = () => new Date(`${isoDate(new Date(Date.now() + 7 * 3_600_000))}T00:00:00Z`);
const toDbDate = (s: string) => new Date(`${s}T00:00:00Z`);

type PackageRow = { id: string; name: string | null; status: string | null; price: unknown; package_resources: { resource_name: string } | null };
const toRule = (p: PackageRow): RulePackage => ({ id: p.id, name: p.name ?? '', resource: p.package_resources?.resource_name ?? null });

/**
 * Lịch khả dụng theo gói, dùng cho mọi hạng mục (docs/api/availability.md).
 * Khách chỉ thấy trạng thái từng ngày (không có tên khách, đơn hay thông tin booking). NCC cập nhật theo gói, theo ngày,
 * khai sảnh dùng chung để tránh nhiều gói cùng hiện còn trống. Quy tắc tính ở availability-rules.ts.
 */
@Injectable()
export class AvailabilityService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger('Availability');
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  // ---------- Đọc chung ----------

  /** Mọi gói của NCC (kể cả gói đang ẩn: gói ẩn đã kín sảnh thì sảnh vẫn kín), kèm sảnh. */
  private vendorPackages(vendorId: string) {
    return this.prisma.service_packages.findMany({
      where: { vendor_id: vendorId },
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
      select: { id: true, name: true, status: true, price: true, package_resources: { select: { resource_name: true } } },
    });
  }

  private async stored(packageIds: string[], from: string, to: string): Promise<StoredMap> {
    const rows = await this.prisma.package_availability.findMany({
      where: { package_id: { in: packageIds }, date: { gte: toDbDate(from), lte: toDbDate(to) } },
      select: { package_id: true, date: true, status: true },
    });
    const map: StoredMap = new Map();
    for (const r of rows) {
      if (!map.has(r.package_id)) map.set(r.package_id, new Map());
      map.get(r.package_id)!.set(isoDate(r.date), TO_API[r.status as StoredStatus] ?? 'UNKNOWN');
    }
    return map;
  }

  private checkMonth(month: unknown) {
    const days = monthDays(month);
    if (!days) return fail('VALIDATION_ERROR', 'Tháng có dạng YYYY-MM.', 400, { month: 'Tháng có dạng YYYY-MM.' });
    const off = monthOffset(month as string, todayVn());
    if (off < MONTH_RANGE.min || off > MONTH_RANGE.max) return fail('MONTH_OUT_OF_RANGE', 'Chỉ xem được lịch từ tháng trước đến 24 tháng tới.', 400);
    return days;
  }

  // ---------- Phía khách (công khai) ----------

  /** GET /availability/services?ids=…&date=…: trạng thái từng gói của các dịch vụ trong một ngày (thẻ dịch vụ, trang chi tiết). */
  async forServices(idsParam: unknown, date: unknown) {
    requireDbFeature('availability');
    if (!validDate(date)) return fail('VALIDATION_ERROR', 'Ngày có dạng YYYY-MM-DD.', 400, { date: 'Ngày có dạng YYYY-MM-DD.' });
    const ids = [...new Set(String(idsParam ?? '').split(',').map((s) => s.trim()).filter((s) => UUID.test(s)))].slice(0, MAX_SERVICES);
    if (!ids.length) return { date, services: {} };
    const vendors = await this.prisma.vendor_profiles.findMany({
      where: { id: { in: ids }, ...VISIBLE_VENDOR },
      select: {
        id: true,
        service_packages: {
          orderBy: [{ price: 'asc' }, { id: 'asc' }],
          select: { id: true, name: true, status: true, price: true, package_resources: { select: { resource_name: true } } },
        },
      },
    });
    const stored = await this.stored(vendors.flatMap((v) => v.service_packages.map((p) => p.id)), date, date);
    const services: Record<string, { packageId: string; name: string; status: DayStatus }[]> = {};
    for (const v of vendors) {
      const all = v.service_packages.map(toRule);
      services[v.id] = v.service_packages
        .filter((p) => p.status === 'Approved')
        .map((p) => ({ packageId: p.id, name: p.name ?? '', status: effectiveDay(toRule(p), all, stored, date).status }));
    }
    return { date, services };
  }

  /** GET /availability/packages/:packageId?month=YYYY-MM: lịch tháng của một gói đang bán (chỉ trạng thái). */
  async packageMonth(packageId: string, month: unknown) {
    requireDbFeature('availability');
    const days = this.checkMonth(month);
    const pkg = UUID.test(packageId)
      ? await this.prisma.service_packages.findFirst({
          where: { id: packageId, status: 'Approved', vendor_profiles: VISIBLE_VENDOR },
          select: { id: true, vendor_id: true },
        })
      : null;
    if (!pkg) return fail('PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.', 404);
    const all = pkg.vendor_id ? await this.vendorPackages(pkg.vendor_id) : [];
    const rules = all.map(toRule);
    const self = rules.find((p) => p.id === pkg.id)!;
    const stored = await this.stored(siblingsOf(self, rules).map((p) => p.id), days[0], days[days.length - 1]);
    return { packageId: pkg.id, month, days: days.map((d) => ({ date: d, status: effectiveDay(self, rules, stored, d).status })) };
  }

  // ---------- Phía NCC ----------

  private async vendorOf(userId: string) {
    const v = await this.prisma.vendor_profiles.findUnique({ where: { user_id: userId }, select: { id: true, user_id: true } });
    if (!v) return fail('VENDOR_PROFILE_NOT_FOUND', 'Tài khoản chưa có hồ sơ nhà cung cấp.', 404);
    return v;
  }

  private async ownedPackage(userId: string, packageId: string) {
    requireDbFeature('availability');
    const vendor = await this.vendorOf(userId);
    const all = UUID.test(packageId) ? await this.vendorPackages(vendor.id) : [];
    const pkg = all.find((p) => p.id === packageId);
    if (!pkg) return fail('PACKAGE_NOT_FOUND', 'Không tìm thấy gói dịch vụ.', 404);
    const rules = all.map(toRule);
    return { vendor, rules, self: rules.find((p) => p.id === packageId)! };
  }

  private sharedWith(self: RulePackage, rules: RulePackage[]) {
    return siblingsOf(self, rules)
      .filter((p) => p.id !== self.id)
      .map((p) => p.name);
  }

  /** GET /vendors/me/availability/packages/:id?month=: lịch tháng của gói, kèm trạng thái tự đặt và gói cùng sảnh đang chặn. */
  async vendorMonth(userId: string, packageId: string, month: unknown) {
    const { self, rules } = await this.ownedPackage(userId, packageId);
    const days = this.checkMonth(month);
    const ids = siblingsOf(self, rules).map((p) => p.id);
    const [stored, last] = await Promise.all([
      this.stored(ids, days[0], days[days.length - 1]),
      this.prisma.package_availability.aggregate({ where: { package_id: self.id }, _max: { updated_date: true } }),
    ]);
    return {
      packageId: self.id,
      month,
      resource: self.resource,
      sharedWith: this.sharedWith(self, rules),
      lastUpdated: last._max.updated_date?.toISOString() ?? null,
      today: isoDate(todayVn()),
      days: days.map((d) => effectiveDay(self, rules, stored, d)),
    };
  }

  /** PUT /vendors/me/availability/packages/:id: đặt một trạng thái cho nhiều ngày; UNKNOWN là xóa (về Chưa cập nhật). */
  async setDays(userId: string, packageId: string, body: { dates?: unknown; status?: unknown }) {
    const { self, rules } = await this.ownedPackage(userId, packageId);
    const status = body?.status as DayStatus;
    if (!STATUSES.includes(status)) return fail('VALIDATION_ERROR', 'Trạng thái không hợp lệ.', 400, { status: 'AVAILABLE, HELD, BOOKED hoặc UNKNOWN.' });
    const dates = Array.isArray(body?.dates) ? [...new Set(body.dates)] : [];
    if (!dates.length || dates.length > MAX_DATES || !dates.every(validDate)) {
      return fail('VALIDATION_ERROR', `Chọn từ 1 đến ${MAX_DATES} ngày hợp lệ.`, 400, { dates: `Chọn từ 1 đến ${MAX_DATES} ngày dạng YYYY-MM-DD.` });
    }
    const today = isoDate(todayVn());
    if (dates.some((d) => d < today)) return fail('DATE_IN_PAST', 'Không cập nhật được ngày đã qua.', 400);
    if (dates.some((d) => monthOffset(d.slice(0, 7), todayVn()) > MONTH_RANGE.max)) return fail('MONTH_OUT_OF_RANGE', 'Chỉ cập nhật được lịch trong 24 tháng tới.', 400);

    await this.prisma.$transaction(async (tx) => {
      await tx.package_availability.deleteMany({ where: { package_id: self.id, date: { in: dates.map(toDbDate) } } });
      if (status !== 'UNKNOWN') {
        await tx.package_availability.createMany({ data: dates.map((d) => ({ package_id: self.id, date: toDbDate(d), status: TO_DB[status] })) });
      }
    });

    // Xung đột với gói cùng sảnh: báo NCC ngày nào khách sẽ không thấy "Còn trống" dù gói này đặt còn trống
    const sorted = [...dates].sort();
    const stored = await this.stored(siblingsOf(self, rules).map((p) => p.id), sorted[0], sorted[sorted.length - 1]);
    const conflicts = sorted
      .map((d) => effectiveDay(self, rules, stored, d))
      .filter((x) => x.blockedBy && (status === 'AVAILABLE' || status === 'UNKNOWN'))
      .map((x) => ({ date: x.date, status: x.status, packageName: x.blockedBy! }));
    return { updated: dates.length, status, conflicts, sharedWith: status === 'BOOKED' || status === 'HELD' ? this.sharedWith(self, rules) : [] };
  }

  /** PUT /vendors/me/availability/packages/:id/resource: khai sảnh / nguồn lực của gói; trống là dùng lịch riêng. */
  async setResource(userId: string, packageId: string, body: { name?: unknown }) {
    const { self, rules } = await this.ownedPackage(userId, packageId);
    const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
    if (name.length > 100) return fail('VALIDATION_ERROR', 'Tên sảnh tối đa 100 ký tự.', 400, { name: 'Tối đa 100 ký tự.' });
    if (name) {
      await this.prisma.package_resources.upsert({
        where: { package_id: self.id },
        create: { package_id: self.id, resource_name: name },
        update: { resource_name: name, updated_date: new Date() },
      });
    } else {
      await this.prisma.package_resources.deleteMany({ where: { package_id: self.id } });
    }
    const next = { ...self, resource: name || null };
    return { resource: next.resource, sharedWith: this.sharedWith(next, rules.map((p) => (p.id === self.id ? next : p))) };
  }

  /**
   * GET /vendors/me/availability/reminder: lịch đã lâu chưa cập nhật hoặc còn ngày trống thông tin trong 30 ngày tới.
   * Quá 7 ngày chưa cập nhật thì tạo thông báo nhắc (tối đa một thông báo mỗi 7 ngày).
   */
  async reminder(userId: string) {
    const vendor = await this.vendorOf(userId);
    if (!dbFeatures.availability) return { applicable: false as const };
    return { applicable: true as const, ...(await this.checkVendor(vendor.id, vendor.user_id)) };
  }

  private async checkVendor(vendorId: string, vendorUserId: string | null) {
    const pkgs = await this.prisma.service_packages.findMany({ where: { vendor_id: vendorId, status: 'Approved' }, select: { id: true, name: true } });
    const today = todayVn();
    const end = new Date(today.getTime() + (REMIND_WINDOW_DAYS - 1) * DAY_MS);
    const ids = pkgs.map((p) => p.id);
    const [last, rows] = await Promise.all([
      this.prisma.package_availability.aggregate({ where: { service_packages: { vendor_id: vendorId } }, _max: { updated_date: true } }),
      ids.length ? this.prisma.package_availability.findMany({ where: { package_id: { in: ids }, date: { gte: today, lte: end } }, select: { package_id: true, date: true } }) : [],
    ]);
    const known = new Set(rows.map((r) => `${r.package_id}|${isoDate(r.date)}`));
    let missingDays = 0;
    for (let i = 0; i < REMIND_WINDOW_DAYS; i++) {
      const d = isoDate(new Date(today.getTime() + i * DAY_MS));
      if (ids.some((id) => !known.has(`${id}|${d}`))) missingDays++;
    }
    const lastUpdated = last._max.updated_date ?? null;
    const since = daysSince(lastUpdated, new Date());
    const stale = !!ids.length && (since === null || since >= REMIND_AFTER_DAYS);
    if (stale && vendorUserId) await this.ensureReminder(vendorUserId, since);
    return {
      packages: ids.length,
      lastUpdated: lastUpdated?.toISOString() ?? null,
      daysSinceUpdate: since,
      missingDays: ids.length ? missingDays : 0,
      windowDays: REMIND_WINDOW_DAYS,
      needsUpdate: stale || (!!ids.length && missingDays > 0),
    };
  }

  /** Thông báo nhắc cập nhật lịch; đã nhắc trong 7 ngày qua thì thôi. Lỗi ghi thông báo không làm hỏng việc đọc. */
  private async ensureReminder(userId: string, since: number | null) {
    try {
      const recent = await this.prisma.notifications.count({
        where: { user_id: userId, type: REMINDER_TYPE, created_date: { gte: new Date(Date.now() - REMIND_AFTER_DAYS * DAY_MS) } },
      });
      if (recent) return;
      const content =
        since === null
          ? 'Bạn chưa cập nhật lịch khả dụng cho các gói. Khách đang thấy "Chưa cập nhật" khi xem ngày cưới của họ.'
          : `Lịch khả dụng đã ${since} ngày chưa cập nhật. Cập nhật để khách thấy đúng gói còn trống theo ngày cưới.`;
      await this.prisma.notifications.create({ data: { user_id: userId, type: REMINDER_TYPE, title: 'Nhắc cập nhật lịch khả dụng', content, reference_type: 'Availability' } });
      publish({ users: [userId], event: 'notification', data: { type: REMINDER_TYPE, referenceType: 'Availability', referenceId: null } });
    } catch (e) {
      this.log.warn(`Không tạo được thông báo nhắc lịch: ${(e as Error).message}`);
    }
  }

  // ---------- Nhắc định kỳ toàn hệ thống (mặc định tắt) ----------

  onModuleInit() {
    if (process.env.AVAILABILITY_REMINDER_ENABLED?.trim().toLowerCase() !== 'true') return;
    this.log.log('AVAILABILITY_REMINDER_ENABLED=true: nhắc NCC cập nhật lịch khả dụng, lúc khởi động và mỗi 6 giờ');
    void this.remindAll();
    this.timer = setInterval(() => void this.remindAll(), REMINDER_JOB_EVERY_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async remindAll() {
    if (!dbFeatures.availability) return;
    try {
      const vendors = await this.prisma.vendor_profiles.findMany({ where: VISIBLE_VENDOR, select: { id: true, user_id: true } });
      for (const v of vendors) await this.checkVendor(v.id, v.user_id);
    } catch (e) {
      this.log.error(`Nhắc cập nhật lịch lỗi: ${(e as Error).message}`);
    }
  }
}

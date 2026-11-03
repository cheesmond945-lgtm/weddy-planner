import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService, categoryRank, categorySlug, estimateCost } from '../catalog/services.service';
import { ORDER_INCLUDE, toOrderDto, ymd } from '../orders/order-mapping';
import { BUDGET_PRESETS, type BudgetPreset } from './allocation.config';
import { BudgetCalcService } from './budget-calc.service';
import { fitsGuests, packageCost } from './budget-engine';
import { notifyVendorsOfWeddingDate, onWeddingCategories, planWeddingDateChange } from './timeline-hooks';
import { bumpVersion, versionOf } from './wedding-version';
import { dbFeatures, requireDbFeature } from '../../prisma/db-features';
import { isHanoiWard } from './wards';
import { notify } from '../chat/chat-messages';
import { publish } from '../realtime/realtime.bus';
import { hm, minutesOfTime, parseHm, timeOfMinutes } from './wedding-day';
import { dayScheduleDto, loadWeddingDay } from './wedding-day-store';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

export type PlanStatus = 'PLANNED' | 'DISCUSSING' | 'AWAITING_DEPOSIT' | 'CONFIRMED';

export interface WeddingInputBody {
  groomName?: string;
  brideName?: string;
  date?: string;
  guestCount?: number | null;
  budget?: number;
  /** Phường/xã nơi tổ chức (HANOI_WARDS, có tiền tố); null hoặc bỏ trống là chưa chọn */
  ward?: string | null;
  /** Mức chia ngân sách, không bắt buộc (mặc định BALANCED khi tạo, giữ nguyên khi sửa) */
  budgetPreset?: string;
  categorySlugs?: string[];
  /** Phiên bản đã đọc (GET trả về); có gửi thì kiểm tra ghi đồng thời */
  version?: string;
  /** Giờ chính của ngày cưới "HH:mm" (đón khách / làm lễ); null hoặc "" để xóa; không gửi thì giữ nguyên */
  mainTime?: string | null;
}

/** PATCH /weddings/me: các giá trị ảnh hưởng ngân sách, đổi nhanh ở tab Ngân sách. */
export interface WeddingPatchBody {
  budget?: unknown;
  guestCount?: unknown;
  budgetPreset?: unknown;
  /** null: về số bàn tự tính */
  tableCountOverride?: unknown;
  version?: unknown;
}

/** NCC chỉ có ở Hà Nội nên form không hỏi khu vực; backend luôn lưu city là Hà Nội để gợi ý AI lọc theo khu vực. */
const DEFAULT_CITY = 'Hà Nội';
/** Tên cô dâu do bản cũ tự điền khi tạo đám cưới (lúc form chưa hỏi tên); trả về rỗng để form bắt nhập lại. */
const NAME_PLACEHOLDER = '(chưa cập nhật)';

const todayVN = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** Đơn còn hiệu lực trong kế hoạch (bỏ nháp, đã hủy, hết hạn). */
const ACTIVE_ORDER = ['Pending', 'NeedRevision', 'Deposited', 'Completed'];

const isPreset = (v: unknown): v is BudgetPreset => typeof v === 'string' && (BUDGET_PRESETS as string[]).includes(v);

@Injectable()
export class WeddingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly services: ServicesService,
    private readonly calc: BudgetCalcService,
  ) {}

  // ---------- Thông tin đám cưới ----------

  private async categoryMaps() {
    const cats = await this.prisma.service_categories.findMany();
    return {
      slugById: new Map(cats.map((c) => [c.id, categorySlug(c.name)])),
      idBySlug: new Map(cats.map((c) => [categorySlug(c.name), c.id])),
    };
  }

  /** Tên hạng mục theo id. */
  async categoryRows() {
    return new Map((await this.prisma.service_categories.findMany()).map((c) => [c.id, c.name]));
  }

  /** Đám cưới của người này (weddings.user_id, mỗi tài khoản cặp đôi một đám cưới). */
  async findWedding(userId: string) {
    return this.prisma.weddings.findUnique({ where: { user_id: userId }, include: { wedding_categories: true } });
  }

  async requireWedding(userId: string) {
    const w = await this.findWedding(userId);
    if (!w) return fail('WEDDING_NOT_SET', 'Hãy thiết lập thông tin đám cưới trước.', 409);
    return { ...w, user_id: userId };
  }

  private async toWedding(w: NonNullable<Awaited<ReturnType<WeddingsService['findWedding']>>>) {
    const { slugById } = await this.categoryMaps();
    return {
      id: w.id,
      groomName: w.groom_name === NAME_PLACEHOLDER ? '' : w.groom_name,
      brideName: w.bride_name === NAME_PLACEHOLDER ? '' : w.bride_name,
      date: ymd(w.wedding_date),
      mainTime: w.main_time ? hm(minutesOfTime(w.main_time)!) : null,
      location: w.city,
      ward: w.ward ?? null,
      guestCount: w.guest_count,
      budget: Number(w.budget),
      budgetPreset: (isPreset((w as { budget_preset?: string }).budget_preset) ? (w as { budget_preset: string }).budget_preset : 'BALANCED') as BudgetPreset,
      tableCountOverride: w.table_count_override ?? null,
      categorySlugs: w.wedding_categories.map((c) => slugById.get(c.category_id)).filter((s): s is string => !!s).sort((a, b) => categoryRank(a) - categoryRank(b)),
      version: versionOf(w),
    };
  }

  async getMine(userId: string) {
    const w = await this.findWedding(userId);
    return w ? this.toWedding(w) : null;
  }

  async saveMine(userId: string, body: WeddingInputBody) {
    const errors: Record<string, string> = {};
    const groomName = typeof body.groomName === 'string' ? body.groomName.trim() : '';
    if (!groomName) errors.groomName = 'Vui lòng nhập tên chú rể.';
    else if (groomName.length > 100) errors.groomName = 'Tối đa 100 ký tự.';
    const brideName = typeof body.brideName === 'string' ? body.brideName.trim() : '';
    if (!brideName) errors.brideName = 'Vui lòng nhập tên cô dâu.';
    else if (brideName.length > 100) errors.brideName = 'Tối đa 100 ký tự.';
    const date = typeof body.date === 'string' ? body.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) errors.date = 'Chọn ngày tổ chức.';
    else if (date <= todayVN()) errors.date = 'Ngày tổ chức phải sau hôm nay.';
    const budget = Number(body.budget);
    if (!Number.isInteger(budget) || budget <= 0) errors.budget = 'Ngân sách phải là số nguyên dương.';
    const guest = body.guestCount === null || body.guestCount === undefined ? null : Number(body.guestCount);
    if (guest === null) errors.guestCount = 'Vui lòng nhập số khách dự kiến.';
    else if (!Number.isInteger(guest) || guest < 1) errors.guestCount = 'Số khách là số nguyên từ 1.';
    // Tùy chỉnh cần tỷ lệ nên chỉ chọn ở tab Ngân sách
    if (body.budgetPreset !== undefined && (!isPreset(body.budgetPreset) || body.budgetPreset === 'CUSTOM')) errors.budgetPreset = 'Mức chia không hợp lệ.';
    const ward = body.ward === undefined || body.ward === null || body.ward === '' ? null : body.ward;
    if (ward !== null && !isHanoiWard(ward)) errors.ward = 'Nơi tổ chức phải là một phường/xã của Hà Nội.';

    // Giờ chính: không gửi thì giữ nguyên (FE cũ), null / "" là xóa
    const mainRaw = body.mainTime;
    const mainMin = mainRaw === undefined || mainRaw === null || mainRaw === '' ? null : parseHm(mainRaw);
    if (mainRaw !== undefined && mainRaw !== null && mainRaw !== '' && mainMin === null) errors.mainTime = 'Giờ dạng HH:mm, ví dụ 11:00.';

    const { idBySlug } = await this.categoryMaps();
    const slugs = [...new Set(body.categorySlugs ?? [])];
    if (!slugs.length) errors.categorySlugs = 'Vui lòng chọn ít nhất 1 dịch vụ.';
    else if (slugs.some((s) => !idBySlug.has(s))) errors.categorySlugs = 'Hạng mục không hợp lệ.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin đám cưới chưa hợp lệ.', 400, errors);

    const existing = await this.findWedding(userId);
    // Cột style giữ trong DB nhưng không dùng nữa (bỏ phong cách 30/10/2026)
    const data = {
      groom_name: groomName,
      bride_name: brideName,
      wedding_date: new Date(date),
      city: DEFAULT_CITY,
      guest_count: guest!,
      budget,
      ...(isPreset(body.budgetPreset) && body.budgetPreset !== 'CUSTOM' && dbFeatures.budgetAllocation && { budget_preset: body.budgetPreset }),
      // Chưa chạy SQL thêm cột ward thì bỏ qua, các trường khác vẫn lưu
      ...(body.ward !== undefined && dbFeatures.weddingWard && { ward }),
      // Giờ chính: không gửi thì giữ nguyên
      ...(mainRaw !== undefined && { main_time: mainMin === null ? null : timeOfMinutes(mainMin) }),
    };
    const oldMain = existing ? minutesOfTime(existing.main_time) : null;
    const categoryIds = slugs.map((s) => idBySlug.get(s)!);
    let weddingId: string;
    // Đổi ngày cưới: cập nhật hạn các việc khung chưa xong trong cùng transaction, rồi báo NCC
    let dateChanged = false;
    if (existing) {
      weddingId = existing.id;
      await this.prisma.$transaction(async (tx) => {
        if (body.version !== undefined) await bumpVersion(tx, weddingId, body.version);
        await tx.weddings.update({ where: { id: weddingId }, data: { ...data, updated_date: new Date() } });
        if (ymd(existing.wedding_date) !== date) {
          dateChanged = true;
          for (const u of (await planWeddingDateChange(tx, weddingId, date)).updates) await tx.timeline_tasks.update({ where: { id: u.id }, data: { scheduled_date: u.date } });
        }
        // Ngân sách sửa tay của hạng mục bị bỏ chọn không còn ý nghĩa: xóa cùng
        if (dbFeatures.budgetTiers) await tx.wedding_category_budgets.deleteMany({ where: { wedding_id: weddingId, category_id: { notIn: categoryIds } } });
        await tx.wedding_categories.deleteMany({ where: { wedding_id: weddingId, category_id: { notIn: categoryIds } } });
        await tx.wedding_categories.createMany({ data: categoryIds.map((id) => ({ wedding_id: weddingId, category_id: id })), skipDuplicates: true });
      });
    } else {
      const created = await this.prisma.$transaction(async (tx) => {
        const w = await tx.weddings.create({ data: { ...data, user_id: userId } });
        await tx.wedding_categories.createMany({ data: categoryIds.map((id) => ({ wedding_id: w.id, category_id: id })) });
        return w;
      });
      weddingId = created.id;
    }
    await onWeddingCategories(this.prisma, weddingId, new Date(date), categoryIds);
    if (dateChanged) await notifyVendorsOfWeddingDate(this.prisma, weddingId, date).catch(() => undefined);
    else if (existing && mainRaw !== undefined && oldMain !== mainMin) await this.notifyVendorsOfMainTime(weddingId, oldMain, mainMin).catch(() => undefined);
    return this.getMine(userId);
  }

  /** Đổi nhanh tổng ngân sách, số khách, số bàn (mức chia, tiệc tự lo: PATCH …/budget/settings). */
  async patchMine(userId: string, body: WeddingPatchBody) {
    requireDbFeature('budgetTiers');
    const w = await this.requireWedding(userId);
    const errors: Record<string, string> = {};
    const data: { budget?: number; guest_count?: number; table_count_override?: number | null } = {};
    if (body.budget !== undefined) {
      const n = Number(body.budget);
      if (!Number.isInteger(n) || n <= 0 || n > 1e13) errors.budget = 'Ngân sách phải là số nguyên dương.';
      else data.budget = n;
    }
    if (body.guestCount !== undefined) {
      const n = Number(body.guestCount);
      if (!Number.isInteger(n) || n < 1 || n > 100000) errors.guestCount = 'Số khách là số nguyên từ 1.';
      else data.guest_count = n;
    }
    if (body.tableCountOverride !== undefined) {
      const n = body.tableCountOverride === null ? null : Number(body.tableCountOverride);
      if (n !== null && (!Number.isInteger(n) || n < 1 || n > 500)) errors.tableCountOverride = 'Số bàn là số nguyên từ 1 đến 500.';
      else data.table_count_override = n;
    }
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400, errors);
    if (!Object.keys(data).length) return fail('VALIDATION_ERROR', 'Không có gì để cập nhật.', 400);
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, body.version);
      await tx.weddings.update({ where: { id: w.id }, data });
    });
    return this.getMine(userId);
  }

  /** Khách đổi giờ chính: báo NCC có đơn làm đúng ngày cưới để kiểm tra lại giờ có mặt (đổi ngày cưới đã có thông báo riêng). */
  private async notifyVendorsOfMainTime(weddingId: string, oldMin: number | null, newMin: number | null) {
    const day = await loadWeddingDay(this.prisma, weddingId);
    if (!day) return;
    const text = (m: number | null) => (m === null ? 'chưa có' : hm(m));
    const dmy = day.date.split('-').reverse().join('/');
    for (const s of day.plan.slots) {
      const userId = day.vendorUserOf.get(s.orderId);
      if (!userId) continue;
      await notify(this.prisma, {
        userId,
        type: 'WeddingTimeChanged',
        title: 'Khách đổi giờ chính ngày cưới',
        content: `Đơn ${s.orderCode}: giờ chính ngày ${dmy} đổi từ ${text(oldMin)} sang ${text(newMin)}. Kiểm tra lại giờ có mặt của bạn.`,
        referenceType: 'Order',
        referenceId: s.orderId,
      });
      // Chi tiết đơn đang mở của NCC tải lại giờ dự kiến
      publish({ users: [userId], event: 'task', data: { orderId: s.orderId } });
    }
  }

  /** Lịch trình ngày cưới theo giờ (docs/LICH_TRINH_NGAY_CUOI.md): giờ có mặt của từng NCC làm đúng ngày cưới. */
  async daySchedule(userId: string) {
    const w = await this.requireWedding(userId);
    const day = await loadWeddingDay(this.prisma, w.id);
    return day ? dayScheduleDto(day) : { date: null, mainTime: null, venue: null, slots: [] };
  }

  // ---------- Kế hoạch (nhà cung cấp đã chọn) ----------

  /** Trạng thái của từng NCC trong kế hoạch, tính từ hội thoại và đơn. */
  private async statuses(coupleId: string, weddingId: string, vendors: { id: string; user_id: string | null }[]) {
    const [orders, convs] = await Promise.all([
      this.prisma.orders.findMany({ where: { wedding_id: weddingId, status: { in: ACTIVE_ORDER } }, include: ORDER_INCLUDE, orderBy: { created_date: 'desc' } }),
      this.prisma.conversations.findMany({ where: { couple_id: coupleId } }),
    ]);
    const convByVendorUser = new Map(convs.map((c) => [c.vendor_id, c.id]));
    const out = new Map<string, { status: PlanStatus; order: (typeof orders)[number] | null; conversationId: string | null }>();
    for (const v of vendors) {
      const order = orders.find((o) => o.vendor_id === v.id) ?? null;
      const conversationId = (v.user_id && convByVendorUser.get(v.user_id)) || null;
      let status: PlanStatus = conversationId ? 'DISCUSSING' : 'PLANNED';
      if (order?.status === 'Pending') status = 'AWAITING_DEPOSIT';
      else if (order?.status === 'Deposited' || order?.status === 'Completed') status = 'CONFIRMED';
      else if (order?.status === 'NeedRevision') status = 'DISCUSSING';
      out.set(v.id, { status, order, conversationId });
    }
    return out;
  }

  /** Dịch vụ đang chọn của từng hạng mục (slug), dùng cho timeline. */
  async planSnapshot(coupleId: string, weddingId: string) {
    const out = new Map<string, { serviceName: string; serviceId: string; status: PlanStatus }>();
    for (const b of await this.buildItems(coupleId, weddingId, undefined, false)) out.set(b.slug, { serviceName: b.item.service.name ?? '', serviceId: b.item.service.id, status: b.item.status });
    return out;
  }

  /** Trạng thái kế hoạch của các NCC (chỉ những NCC đang có trong kế hoạch của người này). */
  async planStatusMap(userId: string, vendors: { id: string; user_id: string | null }[]) {
    const w = await this.findWedding(userId);
    const out = new Map<string, PlanStatus>();
    if (!w) return out;
    const inPlan = new Set((await this.prisma.plan_vendors.findMany({ where: { wedding_id: w.id } })).map((r) => r.vendor_id));
    const mine = vendors.filter((v) => inPlan.has(v.id));
    for (const [id, st] of await this.statuses(w.user_id ?? userId, w.id, mine)) out.set(id, st.status);
    return out;
  }

  private async vendorsInPlan(weddingId: string) {
    const rows = await this.prisma.plan_vendors.findMany({
      where: { wedding_id: weddingId },
      orderBy: { created_date: 'asc' },
      include: { vendor_profiles: { select: { id: true, user_id: true, category_id: true, service_categories: { select: { name: true } } } } },
    });
    return rows.flatMap((r) => (r.vendor_profiles ? [{ ...r.vendor_profiles, slug: categorySlug(r.vendor_profiles.service_categories?.name ?? null) }] : []));
  }

  /**
   * Các mục trong kế hoạch. Giá và gói theo hàm tính ngân sách (budget-engine.ts mục 6): có đơn thì tổng đơn,
   * khách chọn gói thì gói đó, chưa chọn thì gói dự kiến. `withPrices` false khi chỉ cần trạng thái (timeline).
   */
  private async buildItems(coupleId: string, weddingId: string, only?: string[], withPrices = true) {
    let vendors = await this.vendorsInPlan(weddingId);
    if (only) vendors = vendors.filter((v) => only.includes(v.id));
    const [statuses, summaries, calc] = await Promise.all([
      this.statuses(coupleId, weddingId, vendors),
      this.services.summaries(vendors.map((v) => v.id), coupleId),
      withPrices ? this.calc.compute(weddingId) : null,
    ]);
    const sumById = new Map(summaries.map((s) => [s.id, s]));
    const costById = new Map((calc?.result.rows.flatMap((r) => r.chosen) ?? []).map((c) => [c.vendorId, c]));
    const tables = calc?.result.tables ?? 0;
    const guestCount = calc?.input.guestCount ?? 0;
    return vendors
      .filter((v) => sumById.has(v.id))
      .map((v) => {
        const st = statuses.get(v.id)!;
        const order = st.order;
        const cost = costById.get(v.id);
        const pkgs = calc?.input.planVendors.find((p) => p.vendorId === v.id)?.packages ?? [];
        return {
          slug: v.slug,
          item: {
            id: v.id,
            service: sumById.get(v.id)!,
            status: st.status,
            packageName: order?.order_items[0]?.item_name ?? cost?.packageName ?? '',
            price: cost?.cost ?? (order ? Number(order.total_amount) : 0),
            /** Gói đang tính: ORDER (theo đơn, khóa), SELECTED (khách chọn), PLANNED (gói dự kiến) */
            package: cost ? { id: cost.packageId, name: cost.packageName, source: cost.packageSource, unavailable: cost.packageUnavailable, minTables: cost.minTables } : null,
            /** Các gói đổi được, kèm chi phí theo số bàn hiện tại */
            packages: pkgs.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              unit: p.unit === 'mâm' ? ('TABLE' as const) : ('PACKAGE' as const),
              cost: packageCost(p, tables),
              capacity: p.capacity,
              minTables: p.minTables,
              fits: fitsGuests(p, v.slug, guestCount),
            })),
            tables,
            order: order && st.conversationId ? toOrderDto(order, st.conversationId) : null,
          },
        };
      })
      .sort((a, b) => categoryRank(a.slug) - categoryRank(b.slug));
  }

  async planItems(userId: string) {
    const w = await this.requireWedding(userId);
    const built = await this.buildItems(w.user_id, w.id);
    const { slugById } = await this.categoryMaps();
    const slugs = new Set<string>([...w.wedding_categories.map((c) => slugById.get(c.category_id)!).filter(Boolean), ...built.map((b) => b.slug)]);
    return { categorySlugs: [...slugs].sort((a, b) => categoryRank(a) - categoryRank(b)), items: built.map((b) => b.item) };
  }

  /** Thêm NCC vào kế hoạch. `idempotent`: đã có thì trả lại mục cũ (dùng khi mở chat). */
  async addPlanItem(userId: string, serviceId: string, replace: boolean, idempotent = false, packageId: string | null = null) {
    const vendor = await this.prisma.vendor_profiles.findUnique({ where: { id: serviceId }, include: { service_categories: { select: { name: true } } } }).catch(() => null);
    if (!vendor || !(await this.services.isVisible(serviceId))) return fail('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ.', 404);
    const w = await this.requireWedding(userId);
    if (packageId !== null) requireDbFeature('budgetTiers');
    if (packageId !== null) await this.sellingPackage(serviceId, packageId);

    const current = await this.vendorsInPlan(w.id);
    if (current.some((v) => v.id === serviceId)) {
      // "Chọn gói này cho kế hoạch" khi nhà cung cấp đã có trong kế hoạch: đổi gói
      if (packageId !== null && !idempotent) {
        await this.choosePackage(w, serviceId, packageId);
        return (await this.buildItems(w.user_id, w.id, [serviceId]))[0].item;
      }
      if (!idempotent) return fail('PLAN_ITEM_EXISTS', 'Dịch vụ đã có trong kế hoạch.', 409);
      return (await this.buildItems(w.user_id, w.id, [serviceId]))[0].item;
    }

    const sameCategory = current.filter((v) => v.category_id === vendor.category_id);
    if (sameCategory.length) {
      const statuses = await this.statuses(w.user_id, w.id, sameCategory);
      const locked = sameCategory.find((v) => ['AWAITING_DEPOSIT', 'CONFIRMED'].includes(statuses.get(v.id)!.status));
      if (locked) return fail('PLAN_CATEGORY_LOCKED', 'Hạng mục này đang chờ đặt cọc hoặc đã chốt, không thể thay.', 409);
      if (!replace) {
        const old = (await this.services.summaries([sameCategory[0].id]))[0];
        return fail('PLAN_CATEGORY_TAKEN', 'Hạng mục này đã có dịch vụ khác trong kế hoạch.', 409, { existingItemId: sameCategory[0].id, existingServiceName: old?.name ?? '' });
      }
      for (const v of sameCategory) await this.purge(w.id, v);
    }
    await this.prisma.plan_vendors.create({ data: { wedding_id: w.id, vendor_id: serviceId, ...(packageId !== null && { package_id: packageId }) } });
    return (await this.buildItems(w.user_id, w.id, [serviceId]))[0].item;
  }

  /** Gói đang bán của nhà cung cấp (đã duyệt, nhà cung cấp đang hiện); không thì 400 PACKAGE_NOT_AVAILABLE. */
  private async sellingPackage(vendorId: string, packageId: string) {
    const ok = /^[0-9a-f-]{36}$/i.test(packageId) && (await this.calc.sellingPackages({ vendorIds: [vendorId] })).some((p) => p.id === packageId);
    if (!ok) return fail('PACKAGE_NOT_AVAILABLE', 'Gói không thuộc nhà cung cấp này hoặc đã ngừng bán.', 400);
  }

  /** Ghi gói đã chọn; nhà cung cấp đã có đơn thì khóa (giá theo đơn). */
  private async choosePackage(w: { id: string; user_id: string }, vendorId: string, packageId: string | null, version?: unknown) {
    requireDbFeature('budgetTiers');
    const row = await this.prisma.plan_vendors.findUnique({ where: { wedding_id_vendor_id: { wedding_id: w.id, vendor_id: vendorId } } });
    if (!row) return fail('PLAN_ITEM_NOT_FOUND', 'Nhà cung cấp không có trong kế hoạch.', 404);
    const ordered = await this.prisma.orders.count({ where: { wedding_id: w.id, vendor_id: vendorId, status: { in: ACTIVE_ORDER } } });
    if (ordered) return fail('PLAN_VENDOR_LOCKED', 'Nhà cung cấp đã gửi đơn, giá tính theo đơn nên không đổi gói được.', 409);
    if (packageId !== null) await this.sellingPackage(vendorId, packageId);
    await this.prisma.$transaction(async (tx) => {
      if (version !== undefined) await bumpVersion(tx, w.id, version);
      await tx.plan_vendors.update({ where: { wedding_id_vendor_id: { wedding_id: w.id, vendor_id: vendorId } }, data: { package_id: packageId } });
    });
  }

  /** PATCH /weddings/me/plan-vendors/:vendorId: chọn gói (null để về gói dự kiến). */
  async setPlanVendorPackage(userId: string, vendorId: string, body: { packageId?: unknown; version?: unknown }) {
    const w = await this.requireWedding(userId);
    if (body.packageId !== null && typeof body.packageId !== 'string') return fail('VALIDATION_ERROR', 'Chọn gói hợp lệ hoặc null để dùng gói dự kiến.', 400);
    if (/^[0-9a-f-]{36}$/i.test(vendorId) === false) return fail('PLAN_ITEM_NOT_FOUND', 'Nhà cung cấp không có trong kế hoạch.', 404);
    await this.choosePackage(w, vendorId, body.packageId, body.version ?? null);
    return (await this.buildItems(w.user_id, w.id, [vendorId]))[0]?.item ?? null;
  }

  async removePlanItem(userId: string, id: string) {
    const w = await this.requireWedding(userId);
    const vendor = (await this.vendorsInPlan(w.id)).find((v) => v.id === id);
    if (!vendor) return fail('PLAN_ITEM_NOT_FOUND', 'Không tìm thấy mục trong kế hoạch.', 404);
    const st = (await this.statuses(w.user_id, w.id, [vendor])).get(id)!;
    if (['AWAITING_DEPOSIT', 'CONFIRMED'].includes(st.status)) return fail('PLAN_ITEM_LOCKED', 'Dịch vụ đang chờ cọc hoặc đã chốt, không thể bỏ.', 409);
    await this.purge(w.id, vendor);
    return null;
  }

  /** Bỏ NCC khỏi kế hoạch cùng hội thoại và các đơn chưa cọc (Nháp, Chờ cọc, Cần sửa). */
  private async purge(weddingId: string, vendor: { id: string; user_id: string | null }) {
    const wedding = await this.prisma.weddings.findUnique({ where: { id: weddingId }, select: { user_id: true } });
    const orders = await this.prisma.orders.findMany({ where: { wedding_id: weddingId, vendor_id: vendor.id, status: { in: ['Draft', 'Pending', 'NeedRevision'] } }, select: { id: true } });
    const orderIds = orders.map((o) => o.id);
    const conv = wedding?.user_id && vendor.user_id ? await this.prisma.conversations.findUnique({ where: { couple_id_vendor_id: { couple_id: wedding.user_id, vendor_id: vendor.user_id } } }) : null;
    await this.prisma.$transaction([
      this.prisma.messages.deleteMany({ where: { OR: [{ order_id: { in: orderIds } }, ...(conv ? [{ conversation_id: conv.id }] : [])] } }),
      this.prisma.payments.deleteMany({ where: { order_id: { in: orderIds } } }),
      this.prisma.timeline_tasks.updateMany({ where: { order_id: { in: orderIds } }, data: { order_id: null } }),
      this.prisma.orders.deleteMany({ where: { id: { in: orderIds } } }),
      ...(conv ? [this.prisma.conversations.deleteMany({ where: { id: conv.id } })] : []),
      this.prisma.plan_vendors.deleteMany({ where: { wedding_id: weddingId, vendor_id: vendor.id } }),
    ]);
  }
}

import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ServicesService, categoryRank, categorySlug, estimateCost } from '../catalog/services.service';
import { ORDER_INCLUDE, toOrderDto, ymd } from '../orders/order-mapping';
import { onWeddingCategories } from './timeline-hooks';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

export type PlanStatus = 'PLANNED' | 'DISCUSSING' | 'AWAITING_DEPOSIT' | 'CONFIRMED';

export interface WeddingInputBody {
  date?: string;
  location?: string;
  guestCount?: number | null;
  budget?: number;
  styles?: string[];
  categorySlugs?: string[];
}

const todayVN = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

/** Đơn còn hiệu lực trong kế hoạch (bỏ nháp, đã hủy, hết hạn). */
const ACTIVE_ORDER = ['Pending', 'NeedRevision', 'Deposited', 'Completed'];

@Injectable()
export class WeddingsService {
  constructor(private readonly prisma: PrismaService, private readonly services: ServicesService) {}

  // ---------- Thông tin đám cưới ----------

  private async categoryMaps() {
    const cats = await this.prisma.service_categories.findMany();
    return {
      slugById: new Map(cats.map((c) => [c.id, categorySlug(c.name)])),
      idBySlug: new Map(cats.map((c) => [categorySlug(c.name), c.id])),
    };
  }

  async findWedding(userId: string) {
    return this.prisma.weddings.findUnique({ where: { user_id: userId }, include: { wedding_categories: true } });
  }

  async requireWedding(userId: string) {
    const w = await this.findWedding(userId);
    if (!w) return fail('WEDDING_NOT_SET', 'Hãy thiết lập thông tin đám cưới trước.', 409);
    return w;
  }

  private async toWedding(w: NonNullable<Awaited<ReturnType<WeddingsService['findWedding']>>>) {
    const { slugById } = await this.categoryMaps();
    return {
      id: w.id,
      date: ymd(w.wedding_date),
      location: w.city,
      guestCount: w.guest_count,
      budget: Number(w.budget),
      styles: w.style ? w.style.split(',').map((s) => s.trim()).filter(Boolean) : [],
      categorySlugs: w.wedding_categories.map((c) => slugById.get(c.category_id)).filter((s): s is string => !!s).sort((a, b) => categoryRank(a) - categoryRank(b)),
    };
  }

  async getMine(userId: string) {
    const w = await this.findWedding(userId);
    return w ? this.toWedding(w) : null;
  }

  async saveMine(userId: string, body: WeddingInputBody) {
    const errors: Record<string, string> = {};
    const date = typeof body.date === 'string' ? body.date : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) errors.date = 'Chọn ngày tổ chức.';
    else if (date <= todayVN()) errors.date = 'Ngày tổ chức phải sau hôm nay.';
    const location = body.location?.trim() ?? '';
    if (!location) errors.location = 'Chọn khu vực.';
    else if (location.length > 100) errors.location = 'Tối đa 100 ký tự.';
    const budget = Number(body.budget);
    if (!Number.isInteger(budget) || budget <= 0) errors.budget = 'Ngân sách phải là số nguyên dương.';
    const guest = body.guestCount === null || body.guestCount === undefined ? null : Number(body.guestCount);
    if (guest === null) errors.guestCount = 'Vui lòng nhập số khách dự kiến.';
    else if (!Number.isInteger(guest) || guest < 1) errors.guestCount = 'Số khách là số nguyên từ 1.';
    const styles = [...new Set((body.styles ?? []).map((s) => String(s).trim()).filter(Boolean))];
    const style = styles.join(', ');
    if (style.length > 100) errors.styles = 'Chọn ít phong cách hơn.';

    const { idBySlug } = await this.categoryMaps();
    const slugs = [...new Set(body.categorySlugs ?? [])];
    if (slugs.some((s) => !idBySlug.has(s))) errors.categorySlugs = 'Hạng mục không hợp lệ.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin đám cưới chưa hợp lệ.', 400, errors);

    const existing = await this.prisma.weddings.findUnique({ where: { user_id: userId } });
    const data = { wedding_date: new Date(date), city: location, guest_count: guest!, budget, style: style || null, updated_date: new Date() };
    let weddingId: string;
    if (existing) {
      weddingId = existing.id;
      await this.prisma.weddings.update({ where: { id: weddingId }, data });
    } else {
      const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { full_name: true } });
      const created = await this.prisma.weddings.create({ data: { ...data, user_id: userId, groom_name: user?.full_name ?? '', bride_name: '(chưa cập nhật)' } });
      weddingId = created.id;
    }
    await this.prisma.$transaction([
      this.prisma.wedding_categories.deleteMany({ where: { wedding_id: weddingId } }),
      this.prisma.wedding_categories.createMany({ data: slugs.map((s) => ({ wedding_id: weddingId, category_id: idBySlug.get(s)! })) }),
    ]);
    await onWeddingCategories(this.prisma, weddingId, new Date(date), slugs.map((s) => idBySlug.get(s)!));
    return this.getMine(userId);
  }

  // ---------- Kế hoạch (nhà cung cấp đã chọn) ----------

  /** Trạng thái của từng NCC trong kế hoạch, tính từ hội thoại và đơn. */
  private async statuses(userId: string, weddingId: string, vendors: { id: string; user_id: string | null }[]) {
    const [orders, convs] = await Promise.all([
      this.prisma.orders.findMany({ where: { wedding_id: weddingId, status: { in: ACTIVE_ORDER } }, include: ORDER_INCLUDE, orderBy: { created_date: 'desc' } }),
      this.prisma.conversations.findMany({ where: { couple_id: userId } }),
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
  async planSnapshot(userId: string, weddingId: string) {
    const out = new Map<string, { serviceName: string; serviceId: string; status: PlanStatus }>();
    for (const b of await this.buildItems(userId, weddingId)) out.set(b.slug, { serviceName: b.item.service.name ?? '', serviceId: b.item.service.id, status: b.item.status });
    return out;
  }

  /** Trạng thái kế hoạch của các NCC (chỉ những NCC đang có trong kế hoạch của người này). */
  async planStatusMap(userId: string, vendors: { id: string; user_id: string | null }[]) {
    const w = await this.findWedding(userId);
    const out = new Map<string, PlanStatus>();
    if (!w) return out;
    const inPlan = new Set((await this.prisma.plan_vendors.findMany({ where: { wedding_id: w.id } })).map((r) => r.vendor_id));
    const mine = vendors.filter((v) => inPlan.has(v.id));
    for (const [id, st] of await this.statuses(userId, w.id, mine)) out.set(id, st.status);
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

  /** Mặc định của một PlanItem khi chưa có đơn: gói rẻ nhất (đầu tiên) của NCC. */
  private async firstPackages(vendorIds: string[]) {
    const pkgs = await this.prisma.service_packages.findMany({ where: { vendor_id: { in: vendorIds }, status: 'Approved' }, orderBy: [{ price: 'asc' }, { id: 'asc' }] });
    const map = new Map<string, { name: string; price: number; minTables: number | null }>();
    for (const p of pkgs) if (p.vendor_id && !map.has(p.vendor_id)) map.set(p.vendor_id, { name: p.name ?? '', price: Number(p.price), minTables: p.min_tables });
    return map;
  }

  private async buildItems(userId: string, weddingId: string, only?: string[]) {
    let vendors = await this.vendorsInPlan(weddingId);
    if (only) vendors = vendors.filter((v) => only.includes(v.id));
    const [statuses, summaries, firsts, wedding] = await Promise.all([
      this.statuses(userId, weddingId, vendors),
      this.services.summaries(vendors.map((v) => v.id)),
      this.firstPackages(vendors.map((v) => v.id)),
      this.prisma.weddings.findUnique({ where: { id: weddingId }, select: { guest_count: true } }),
    ]);
    const sumById = new Map(summaries.map((s) => [s.id, s]));
    return vendors
      .filter((v) => sumById.has(v.id))
      .map((v) => {
        const st = statuses.get(v.id)!;
        const first = firsts.get(v.id);
        const order = st.order;
        // Chưa có đơn: ước tính từ gói rẻ nhất (giá theo mâm thì nhân số mâm theo số khách, không dưới số mâm tối thiểu).
        // Có đơn: tổng tiền đơn (đã gồm số mâm thực tế NCC lên đơn).
        const estimate = first ? estimateCost(v.slug, first.price, first.minTables, wedding?.guest_count) : null;
        return {
          slug: v.slug,
          item: {
            id: v.id,
            service: sumById.get(v.id)!,
            status: st.status,
            packageName: order?.order_items[0]?.item_name ?? first?.name ?? '',
            price: order ? Number(order.total_amount) : (estimate?.total ?? 0),
            /** Chưa có đơn, giá theo mâm: giá mỗi mâm và số mâm đã dùng để ước tính */
            estimate: !order && first && estimate?.tables ? { unitPrice: first.price, tables: estimate.tables, minTables: first.minTables } : null,
            order: order && st.conversationId ? toOrderDto(order, st.conversationId) : null,
          },
        };
      })
      .sort((a, b) => categoryRank(a.slug) - categoryRank(b.slug));
  }

  async planItems(userId: string) {
    const w = await this.requireWedding(userId);
    const built = await this.buildItems(userId, w.id);
    const { slugById } = await this.categoryMaps();
    const slugs = new Set<string>([...w.wedding_categories.map((c) => slugById.get(c.category_id)!).filter(Boolean), ...built.map((b) => b.slug)]);
    return { categorySlugs: [...slugs].sort((a, b) => categoryRank(a) - categoryRank(b)), items: built.map((b) => b.item) };
  }

  /** Thêm NCC vào kế hoạch. `idempotent`: đã có thì trả lại mục cũ (dùng khi mở chat). */
  async addPlanItem(userId: string, serviceId: string, replace: boolean, idempotent = false) {
    const vendor = await this.prisma.vendor_profiles.findUnique({ where: { id: serviceId }, include: { service_categories: { select: { name: true } } } }).catch(() => null);
    if (!vendor || !(await this.services.isVisible(serviceId))) return fail('SERVICE_NOT_FOUND', 'Không tìm thấy dịch vụ.', 404);
    const w = await this.requireWedding(userId);

    const current = await this.vendorsInPlan(w.id);
    if (current.some((v) => v.id === serviceId)) {
      if (!idempotent) return fail('PLAN_ITEM_EXISTS', 'Dịch vụ đã có trong kế hoạch.', 409);
      return (await this.buildItems(userId, w.id, [serviceId]))[0].item;
    }

    const sameCategory = current.filter((v) => v.category_id === vendor.category_id);
    if (sameCategory.length) {
      const statuses = await this.statuses(userId, w.id, sameCategory);
      const locked = sameCategory.find((v) => ['AWAITING_DEPOSIT', 'CONFIRMED'].includes(statuses.get(v.id)!.status));
      if (locked) return fail('PLAN_CATEGORY_LOCKED', 'Hạng mục này đang chờ đặt cọc hoặc đã chốt, không thể thay.', 409);
      if (!replace) {
        const old = (await this.services.summaries([sameCategory[0].id]))[0];
        return fail('PLAN_CATEGORY_TAKEN', 'Hạng mục này đã có dịch vụ khác trong kế hoạch.', 409, { existingItemId: sameCategory[0].id, existingServiceName: old?.name ?? '' });
      }
      for (const v of sameCategory) await this.purge(w.id, v);
    }
    await this.prisma.plan_vendors.create({ data: { wedding_id: w.id, vendor_id: serviceId } });
    return (await this.buildItems(userId, w.id, [serviceId]))[0].item;
  }

  async removePlanItem(userId: string, id: string) {
    const w = await this.requireWedding(userId);
    const vendor = (await this.vendorsInPlan(w.id)).find((v) => v.id === id);
    if (!vendor) return fail('PLAN_ITEM_NOT_FOUND', 'Không tìm thấy mục trong kế hoạch.', 404);
    const st = (await this.statuses(userId, w.id, [vendor])).get(id)!;
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

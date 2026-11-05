import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { dbFeatures, unitOf } from '../../prisma/db-features';
import { hallConflict } from '../halls/hall-busy';
import { loadBusy } from '../halls/hall-store';
import { BUDGET_PRESETS, VENUE_SLUG, type BudgetPreset } from './allocation.config';
import { allocate, type AllocCategory, type AllocInput, type AllocPackage, type AllocPlanVendor } from './allocation';
import type { EnginePackage, PackageUnit } from './budget-engine';
import { BASE_MODES, type BaseMode, type SplitState } from './budget-split';

/** Đơn còn hiệu lực trong kế hoạch (như WeddingsService) */
const ACTIVE_ORDER = ['Pending', 'NeedRevision', 'Deposited', 'Completed'];

/** Nhà cung cấp "đang hiện": đã duyệt (không ẩn), tài khoản hoạt động (như ServicesService.loadVisible) */
const VISIBLE_VENDOR = {
  status: 'Approved',
  users: { status: 'Active' },
} as const;

type PackageRow = {
  id: string;
  vendor_id: string;
  name: string | null;
  price: unknown;
  unit?: string;
  description?: string;
  capacity: number | null;
  min_tables: number | null;
};

export const toEnginePackage = (p: PackageRow): EnginePackage => ({
  id: p.id,
  vendorId: p.vendor_id,
  name: p.name ?? '',
  price: Number(p.price),
  unit: (unitOf(p) === 'mâm' ? 'mâm' : 'gói') as PackageUnit,
  capacity: p.capacity,
  minTables: p.min_tables,
});

/**
 * Cấu hình Tùy chỉnh lưu trong weddings.custom_weights (jsonb), dạng
 * { format: 2, version, baseMode, excluded: [categoryId], capAmount, items: [{ categoryId, slug, ratio, locked, updatedAt }], updatedAt }.
 * Không lưu số tiền phân bổ. Dạng cũ (slug → %) coi như chưa có cấu hình.
 */
export interface StoredSplit {
  version: number;
  state: SplitState;
  updatedAt: string | null;
}

export function parseSplitConfig(v: unknown): StoredSplit | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  if (o.format !== 2 || !Number.isInteger(o.version) || !Array.isArray(o.items)) return null;
  const items = (o.items as Record<string, unknown>[]).flatMap((i) =>
    i && typeof i.categoryId === 'string' && Number.isInteger(i.ratio)
      ? [
          {
            id: i.categoryId,
            slug: typeof i.slug === 'string' ? i.slug : '',
            ratio: i.ratio as number,
            locked: i.locked === true,
          },
        ]
      : [],
  );
  return {
    version: o.version as number,
    updatedAt: typeof o.updatedAt === 'string' ? o.updatedAt : null,
    state: {
      baseMode: (BASE_MODES as unknown[]).includes(o.baseMode) ? (o.baseMode as BaseMode) : 'BALANCED',
      excluded: Array.isArray(o.excluded) ? o.excluded.filter((x): x is string => typeof x === 'string') : [],
      capAmount: Number.isInteger(o.capAmount) && (o.capAmount as number) >= 0 ? (o.capAmount as number) : null,
      items,
    },
  };
}

/** Dạng lưu của cấu hình (giữ updatedAt cũ cho hạng mục không đổi) */
export function serializeSplit(state: SplitState, version: number, prev: SplitState | null, now = new Date().toISOString()) {
  const before = new Map((prev?.items ?? []).map((i) => [i.id, i]));
  return {
    format: 2,
    version,
    baseMode: state.baseMode,
    excluded: state.excluded,
    capAmount: state.capAmount,
    items: state.items.map((i) => {
      const old = before.get(i.id);
      return {
        categoryId: i.id,
        slug: i.slug,
        ratio: i.ratio,
        locked: i.locked,
        updatedAt: old && old.ratio === i.ratio && old.locked === i.locked ? undefined : now,
      };
    }),
    updatedAt: now,
  };
}

export type CalcInput = AllocInput & {
  /** Cấu hình Tùy chỉnh đã lưu (kể cả khi đang dùng phương án có sẵn) */
  stored: StoredSplit | null;
  extraRows: {
    id: string;
    name: string;
    amount: number;
    createdDate: string;
  }[];
};

/**
 * Đọc dữ liệu từ DB cho thuật toán phân bổ (allocation.ts) rồi tính. Chỉ phụ thuộc Prisma để WeddingsService,
 * BudgetService, gợi ý ở trang Dịch vụ và So sánh cùng dùng mà không vòng phụ thuộc.
 */
@Injectable()
export class BudgetCalcService {
  constructor(private readonly prisma: PrismaService) {}

  /** Gói đang hiển thị (đã duyệt, NCC không ẩn, không bị khóa) theo hạng mục hoặc theo nhà cung cấp. */
  async sellingPackages(where: { categoryIds?: string[]; vendorIds?: string[] }) {
    const rows = await this.prisma.service_packages.findMany({
      where: {
        status: 'Approved',
        vendor_profiles: {
          ...VISIBLE_VENDOR,
          ...(where.categoryIds && { category_id: { in: where.categoryIds } }),
        },
        ...(where.vendorIds && { vendor_id: { in: where.vendorIds } }),
      },
      // Chưa có cột unit (SQL chưa chạy): đọc đơn vị từ mô tả như trước
      select: {
        id: true,
        vendor_id: true,
        name: true,
        price: true,
        ...(dbFeatures.budgetTiers ? { unit: true } : { description: true }),
        capacity: true,
        min_tables: true,
        package_tags: { select: { tag: true } },
        vendor_profiles: {
          select: { category_id: true, business_name: true, ward: true, city: true },
        },
      },
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
    });
    // Các cột cho phép null trong DB: gói không gắn NCC / lĩnh vực thì không tính
    return rows.flatMap((r) =>
      r.vendor_id && r.vendor_profiles?.category_id
        ? [
            {
              ...toEnginePackage({ ...r, vendor_id: r.vendor_id }),
              categoryId: r.vendor_profiles.category_id,
              vendorName: r.vendor_profiles.business_name ?? '',
              ward: r.vendor_profiles.ward ?? null,
              city: r.vendor_profiles.city ?? null,
              styles: r.package_tags.map((t) => t.tag),
            },
          ]
        : [],
    );
  }

  /** Điểm đánh giá của khách trên web theo NCC (trung bình 1 chữ số thập phân) */
  private async ratings(vendorIds: string[]) {
    const out = new Map<string, { rating: number; reviewCount: number }>();
    if (!vendorIds.length) return out;
    const rows = await this.prisma.reviews.findMany({
      where: { order_items: { orders: { vendor_id: { in: vendorIds } } } },
      select: {
        rating: true,
        order_items: { select: { orders: { select: { vendor_id: true } } } },
      },
    });
    const sums = new Map<string, { sum: number; count: number }>();
    for (const r of rows) {
      const id = r.order_items.orders?.vendor_id;
      if (!id) continue;
      const cur = sums.get(id) ?? { sum: 0, count: 0 };
      sums.set(id, { sum: cur.sum + r.rating, count: cur.count + 1 });
    }
    for (const [id, x] of sums)
      out.set(id, {
        rating: Math.round((x.sum / x.count) * 10) / 10,
        reviewCount: x.count,
      });
    return out;
  }

  /**
   * Đầu vào của thuật toán cho một đám cưới. Hạng mục = hạng mục khách chọn ở "Dịch vụ muốn sử dụng" và hạng mục của mọi
   * nhà cung cấp đã có trong kế hoạch. `extraCategoryIds`: tính thêm hạng mục chưa chọn (gợi ý ở trang Dịch vụ).
   */
  async input(weddingId: string, extraCategoryIds: string[] = []): Promise<CalcInput> {
    const [w, plan] = await Promise.all([
      this.prisma.weddings.findUniqueOrThrow({
        where: { id: weddingId },
        include: {
          wedding_categories: true,
          // Bảng chưa có (SQL chưa chạy): coi như chưa có chi phí khác
          ...(dbFeatures.budgetTiers && {
            wedding_extra_costs: {
              orderBy: [{ created_date: 'asc' as const }, { id: 'asc' as const }],
            },
          }),
        },
      }),
      this.prisma.plan_vendors.findMany({
        where: { wedding_id: weddingId },
        include: {
          vendor_profiles: {
            select: {
              category_id: true,
              business_name: true,
              service_categories: { select: { name: true } },
            },
          },
        },
      }),
    ]);
    const extraRows =
      (
        w as {
          wedding_extra_costs?: {
            id: string;
            name: string;
            amount: unknown;
            created_date: Date;
          }[];
        }
      ).wedding_extra_costs ?? [];
    const chosen = [
      ...new Set([...w.wedding_categories.map((c) => c.category_id), ...plan.flatMap((p) => (p.vendor_profiles.category_id ? [p.vendor_profiles.category_id] : [])), ...extraCategoryIds]),
    ];
    const vendorIds = plan.map((p) => p.vendor_id);
    const [cats, catPackages, vendorPackages, orders] = await Promise.all([
      this.prisma.service_categories.findMany({
        where: { id: { in: chosen } },
      }),
      this.sellingPackages({ categoryIds: chosen }),
      this.sellingPackages({ vendorIds }),
      // Mọi đơn của đám cưới (cả đơn đã hủy để tính cọc mất), mới nhất trước
      this.prisma.orders.findMany({
        where: {
          wedding_id: weddingId,
          status: { in: [...ACTIVE_ORDER, 'Cancelled'] },
        },
        orderBy: { created_date: 'desc' },
        select: {
          id: true,
          vendor_id: true,
          total_amount: true,
          deposit_amount: true,
          status: true,
          cancel_reason: true,
          payments: { select: { paid_date: true } },
        },
      }),
    ]);
    // Gói tiệc đề xuất chỉ lấy sảnh còn trống ngày cưới: bỏ sảnh có đơn đã cọc của khách khác hoặc NCC đánh dấu bận
    // (đơn của chính đám cưới này không tính). Chưa có ngày cưới thì giữ nguyên.
    const weddingDate = w.wedding_date ? w.wedding_date.toISOString().slice(0, 10) : null;
    const venueCatIds = new Set(cats.filter((c) => categorySlug(c.name) === VENUE_SLUG).map((c) => c.id));
    const hallIds = catPackages.filter((p) => venueCatIds.has(p.categoryId)).map((p) => p.id);
    let freePackages = catPackages;
    if (weddingDate && hallIds.length) {
      const busy = await loadBusy(this.prisma, hallIds, weddingDate, weddingDate);
      const own = new Set(orders.map((o) => o.id));
      const others = busy.orders.filter((o) => !own.has(o.orderId));
      freePackages = catPackages.filter((p) => !venueCatIds.has(p.categoryId) || !hallConflict(p.id, weddingDate, others, busy.manual));
    }
    const ratings = await this.ratings([...new Set(catPackages.map((p) => p.vendorId))]);
    const toAlloc = (p: (typeof catPackages)[number]): AllocPackage => ({
      ...p,
      rating: ratings.get(p.vendorId)?.rating ?? null,
      reviewCount: ratings.get(p.vendorId)?.reviewCount ?? 0,
    });

    // Đơn còn hiệu lực mới nhất của từng NCC; không còn đơn hiệu lực mà có đơn đã hủy thì hạng mục trở về chưa chọn
    const activeOf = new Map<string, (typeof orders)[number]>();
    const cancelledVendors = new Set<string>();
    for (const o of orders) {
      if (!o.vendor_id) continue;
      if (o.status === 'Cancelled') cancelledVendors.add(o.vendor_id);
      else if (!activeOf.has(o.vendor_id)) activeOf.set(o.vendor_id, o);
    }
    // Cọc mất: đơn hủy theo yêu cầu của khách, đã nộp cọc (NCC không thực hiện được thì hoàn cọc ngoài hệ thống)
    const lostDeposits = orders.filter((o) => o.status === 'Cancelled' && o.cancel_reason === 'CUSTOMER_REQUEST' && o.payments?.paid_date).reduce((s, o) => s + Number(o.deposit_amount ?? 0), 0);

    const stored = parseSplitConfig((w as { custom_weights?: unknown }).custom_weights);
    const preset = (BUDGET_PRESETS as string[]).includes((w as { budget_preset?: string }).budget_preset ?? '') ? ((w as { budget_preset: string }).budget_preset as BudgetPreset) : 'BALANCED';
    const categories: AllocCategory[] = cats.map((c) => ({
      id: c.id,
      slug: categorySlug(c.name),
      name: c.name ?? '',
      packages: freePackages.filter((p) => p.categoryId === c.id).map(toAlloc),
    }));
    const planVendors: AllocPlanVendor[] = plan.flatMap((p) => {
      if (!p.vendor_profiles.category_id) return [];
      const active = activeOf.get(p.vendor_id) ?? null;
      return [
        {
          vendorId: p.vendor_id,
          vendorName: p.vendor_profiles.business_name ?? '',
          categoryId: p.vendor_profiles.category_id,
          slug: categorySlug(p.vendor_profiles.service_categories?.name ?? null),
          selectedPackageId: p.package_id ?? null,
          orderTotal: active ? Number(active.total_amount) : null,
          orderDeposited: active && (active.status === 'Deposited' || active.status === 'Completed') ? Number(active.deposit_amount ?? 0) : null,
          cancelled: !active && cancelledVendors.has(p.vendor_id),
          packages: vendorPackages.filter((k) => k.vendorId === p.vendor_id),
        },
      ];
    });

    return {
      total: Number(w.budget ?? 0),
      guestCount: w.guest_count ?? 0,
      tableOverride: w.table_count_override ?? null,
      preset,
      split: stored?.state ?? null,
      stored,
      ownVenue: (w as { own_venue?: boolean }).own_venue ?? false,
      ownVenueCost: (w as { own_venue_cost?: unknown }).own_venue_cost != null ? Number((w as { own_venue_cost: unknown }).own_venue_cost) : null,
      extraCosts: extraRows.reduce((s, e) => s + Number(e.amount), 0),
      extraRows: extraRows.map((e) => ({
        id: e.id,
        name: e.name,
        amount: Number(e.amount),
        createdDate: e.created_date.toISOString(),
      })),
      lostDeposits,
      categories,
      planVendors,
      city: w.city ?? null,
      ward: (w as { ward?: string | null }).ward ?? null,
      styles: (w.style ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
  }

  async compute(weddingId: string, extraCategoryIds: string[] = []) {
    const input = await this.input(weddingId, extraCategoryIds);
    return { input, result: allocate(input) };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { categorySlug } from '../catalog/services.service';
import { dbFeatures, unitOf } from '../../prisma/db-features';
import type { SpendingTier } from './budget.config';
import { computeBudget, type BudgetInput, type EnginePackage, type PackageUnit } from './budget-engine';

/** Đơn còn hiệu lực trong kế hoạch (như WeddingsService) */
const ACTIVE_ORDER = ['Pending', 'NeedRevision', 'Deposited', 'Completed'];

/** Nhà cung cấp "đang hiện": đã duyệt, tài khoản hoạt động (như ServicesService.loadVisible) */
const VISIBLE_VENDOR = { status: 'Approved', users: { status: 'Active' } } as const;

type PackageRow = { id: string; vendor_id: string; name: string; price: unknown; unit?: string; description?: string; capacity: number | null; min_tables: number | null };

export const toEnginePackage = (p: PackageRow): EnginePackage => ({
  id: p.id,
  vendorId: p.vendor_id,
  name: p.name,
  price: Number(p.price),
  unit: (unitOf(p) === 'mâm' ? 'mâm' : 'gói') as PackageUnit,
  capacity: p.capacity,
  minTables: p.min_tables,
});

/**
 * Đọc dữ liệu từ DB cho hàm tính ngân sách (budget-engine.ts) rồi tính. Chỉ phụ thuộc Prisma để WeddingsService,
 * BudgetService, gợi ý AI và So sánh cùng dùng mà không vòng phụ thuộc.
 */
@Injectable()
export class BudgetCalcService {
  constructor(private readonly prisma: PrismaService) {}

  /** Gói đang bán (đã duyệt, nhà cung cấp đang hiện) theo hạng mục hoặc theo nhà cung cấp. */
  async sellingPackages(where: { categoryIds?: string[]; vendorIds?: string[] }) {
    const rows = await this.prisma.service_packages.findMany({
      where: {
        status: 'Approved',
        vendor_profiles: { ...VISIBLE_VENDOR, ...(where.categoryIds && { category_id: { in: where.categoryIds } }) },
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
        vendor_profiles: { select: { category_id: true } },
      },
      orderBy: [{ price: 'asc' }, { id: 'asc' }],
    });
    return rows.map((r) => ({ ...toEnginePackage(r), categoryId: r.vendor_profiles.category_id }));
  }

  /**
   * Dữ liệu đầu vào của hàm tính cho một đám cưới. Hạng mục có ngân sách = hạng mục khách chọn ở "Dịch vụ muốn sử dụng"
   * và hạng mục của mọi nhà cung cấp đã có trong kế hoạch. `extraCategoryIds`: tính thêm hạng mục chưa chọn (gợi ý AI).
   */
  async input(weddingId: string, extraCategoryIds: string[] = []): Promise<BudgetInput & { extraRows: { id: string; name: string; amount: number; createdDate: string }[] }> {
    const [w, plan] = await Promise.all([
      this.prisma.weddings.findUniqueOrThrow({
        where: { id: weddingId },
        include: {
          wedding_categories: true,
          // Bảng mới chưa có (SQL chưa chạy): coi như chưa sửa tay ô nào, chưa có chi phí khác
          ...(dbFeatures.budgetTiers && { wedding_category_budgets: true, wedding_extra_costs: { orderBy: [{ created_date: 'asc' as const }, { id: 'asc' as const }] } }),
        },
      }),
      this.prisma.plan_vendors.findMany({ where: { wedding_id: weddingId }, include: { vendor_profiles: { select: { category_id: true, service_categories: { select: { name: true } } } } } }),
    ]);
    const manualRows = (w as { wedding_category_budgets?: { category_id: string; manual_amount: unknown }[] }).wedding_category_budgets ?? [];
    const extraRows = (w as { wedding_extra_costs?: { id: string; name: string; amount: unknown; created_date: Date }[] }).wedding_extra_costs ?? [];
    const chosen = [...new Set([...w.wedding_categories.map((c) => c.category_id), ...plan.map((p) => p.vendor_profiles.category_id), ...extraCategoryIds])];
    const cats = await this.prisma.service_categories.findMany({ where: { id: { in: chosen } } });
    const vendorIds = plan.map((p) => p.vendor_id);
    const [catPackages, vendorPackages, orders] = await Promise.all([
      this.sellingPackages({ categoryIds: chosen }),
      this.sellingPackages({ vendorIds }),
      this.prisma.orders.findMany({ where: { wedding_id: weddingId, vendor_id: { in: vendorIds }, status: { in: ACTIVE_ORDER } }, orderBy: { created_date: 'desc' }, select: { vendor_id: true, total_amount: true } }),
    ]);
    const orderTotal = new Map<string, number>();
    for (const o of orders) if (!orderTotal.has(o.vendor_id)) orderTotal.set(o.vendor_id, Number(o.total_amount));

    return {
      total: Number(w.budget),
      guestCount: w.guest_count,
      tableOverride: w.table_count_override ?? null,
      tier: (w.spending_tier ?? 'AUTO') as SpendingTier,
      extraCosts: extraRows.reduce((s, e) => s + Number(e.amount), 0),
      extraRows: extraRows.map((e) => ({ id: e.id, name: e.name, amount: Number(e.amount), createdDate: e.created_date.toISOString() })),
      categories: cats.map((c) => ({ id: c.id, slug: categorySlug(c.name), name: c.name, packages: catPackages.filter((p) => p.categoryId === c.id) })),
      manual: new Map(manualRows.map((b) => [b.category_id, Number(b.manual_amount)])),
      planVendors: plan.map((p) => ({
        vendorId: p.vendor_id,
        categoryId: p.vendor_profiles.category_id,
        slug: categorySlug(p.vendor_profiles.service_categories.name),
        selectedPackageId: p.package_id ?? null,
        orderTotal: orderTotal.get(p.vendor_id) ?? null,
        packages: vendorPackages.filter((k) => k.vendorId === p.vendor_id),
      })),
    };
  }

  async compute(weddingId: string, extraCategoryIds: string[] = []) {
    const input = await this.input(weddingId, extraCategoryIds);
    return { input, result: computeBudget(input) };
  }
}

import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TIER_LABEL } from './budget.config';
import { BudgetCalcService } from './budget-calc.service';
import { RebalanceError, rebalance } from './budget-engine';
import { bumpVersion, versionOf } from './wedding-version';
import { requireDbFeature } from '../../prisma/db-features';
import { WeddingsService } from './weddings.service';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tối đa số khoản chi phí khác của một đám cưới. */
export const MAX_EXTRA_COSTS = 200;

type Wedding = Awaited<ReturnType<WeddingsService['requireWedding']>>;

/**
 * Tab Ngân sách (docs/api/weddings.md mục 7): ngân sách hạng mục theo giá gói và mức chi, ô sửa tay,
 * cân đối, chi phí khác. Mọi phép tính ở budget-engine.ts; ở đây chỉ đọc, ghi và kiểm tra.
 * Mọi thao tác ghi kèm \`version\` (weddings.updated_date) để phát hiện ghi đồng thời.
 */
@Injectable()
export class BudgetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weddings: WeddingsService,
    private readonly calc: BudgetCalcService,
  ) {}

  async summary(userId: string) {
    return this.summaryOf(await this.weddings.requireWedding(userId));
  }

  async summaryOf(w: Wedding) {
    const [{ input, result }, snapshot, fresh] = await Promise.all([
      this.calc.compute(w.id),
      this.weddings.planSnapshot(w.user_id, w.id),
      this.prisma.weddings.findUniqueOrThrow({ where: { id: w.id }, select: { updated_date: true } }),
    ]);
    const statusOf = new Map([...snapshot.values()].map((s) => [s.serviceId, s]));
    const vendorRow = (v: (typeof result.vendors)[number]) => {
      const snap = statusOf.get(v.vendorId);
      return {
        id: v.vendorId,
        name: snap?.serviceName ?? '',
        status: snap?.status ?? null,
        cost: v.cost,
        hasOrder: v.packageSource === 'ORDER',
        package: { id: v.packageId, name: v.packageName, source: v.packageSource, unavailable: v.packageUnavailable, unit: v.unit === 'mâm' ? 'TABLE' : v.unit ? 'PACKAGE' : null },
      };
    };
    return {
      version: versionOf(fresh),
      tier: result.tier,
      effectiveTier: result.effectiveTier,
      tierLabel: result.tier === 'AUTO' ? `Tự động, đang áp dụng mức ${TIER_LABEL[result.effectiveTier]}` : TIER_LABEL[result.tier],
      tierTotals: result.tierTotals,
      guestCount: input.guestCount,
      tables: result.tables,
      categories: result.categories.map((c) => {
        const vendors = result.vendors.filter((v) => v.categoryId === c.categoryId).map(vendorRow);
        const cost = vendors.reduce((s, v) => s + v.cost, 0);
        return { ...c, vendors, cost: vendors.length ? cost : null, diff: vendors.length ? c.budget - cost : null };
      }),
      totals: result.totals,
      extraCosts: input.extraRows,
      warnings: result.warnings,
    };
  }

  /** Hạng mục có ô ngân sách: khách chọn ở "Dịch vụ muốn sử dụng" hoặc đã có nhà cung cấp trong kế hoạch. */
  private async chosenCategory(w: Wedding, categoryId: string) {
    const ok =
      UUID.test(categoryId) &&
      (w.wedding_categories.some((c) => c.category_id === categoryId) ||
        (await this.prisma.plan_vendors.count({ where: { wedding_id: w.id, vendor_profiles: { category_id: categoryId } } })) > 0);
    if (!ok) return fail('CATEGORY_NOT_CHOSEN', 'Hạng mục không nằm trong các dịch vụ bạn muốn dùng.', 404);
  }

  /** PUT …/budget/categories/:categoryId: đặt ngân sách sửa tay. */
  async setManual(userId: string, categoryId: string, body: { amount?: unknown; version?: unknown }) {
    requireDbFeature('budgetTiers');
    const w = await this.weddings.requireWedding(userId);
    await this.chosenCategory(w, categoryId);
    const amount = Number(body.amount);
    if (body.amount === null || body.amount === undefined || !Number.isInteger(amount) || amount < 0 || amount > 1e13) {
      return fail('VALIDATION_ERROR', 'Ngân sách hạng mục là số nguyên không âm.', 400, { amount: 'Ngân sách hạng mục là số nguyên không âm.' });
    }
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, body.version);
      await tx.wedding_category_budgets.upsert({
        where: { wedding_id_category_id: { wedding_id: w.id, category_id: categoryId } },
        create: { wedding_id: w.id, category_id: categoryId, manual_amount: amount },
        update: { manual_amount: amount, updated_date: new Date() },
      });
    });
    return this.summary(userId);
  }

  /** DELETE …/budget/categories/:categoryId: bỏ số sửa tay, quay về số gợi ý. */
  async clearManual(userId: string, categoryId: string, version: unknown) {
    requireDbFeature('budgetTiers');
    const w = await this.weddings.requireWedding(userId);
    await this.chosenCategory(w, categoryId);
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, version);
      await tx.wedding_category_budgets.deleteMany({ where: { wedding_id: w.id, category_id: categoryId } });
    });
    return this.summary(userId);
  }

  /** "Đặt lại tất cả": xóa mọi ô sửa tay. */
  async reset(userId: string, version: unknown) {
    requireDbFeature('budgetTiers');
    const w = await this.weddings.requireWedding(userId);
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, version);
      await tx.wedding_category_budgets.deleteMany({ where: { wedding_id: w.id } });
    });
    return this.summary(userId);
  }

  /** "Cân đối theo ngân sách tổng": co các ô chưa sửa tay cho vừa phần còn lại, lưu thành số sửa tay. */
  async rebalance(userId: string, version: unknown) {
    requireDbFeature('budgetTiers');
    const w = await this.weddings.requireWedding(userId);
    const { input, result } = await this.calc.compute(w.id);
    let next: Map<string, number>;
    try {
      next = rebalance(result, input.total, input.extraCosts);
    } catch (e) {
      if (e instanceof RebalanceError) return fail(e.code, e.message, 409);
      throw e;
    }
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, version);
      await tx.wedding_category_budgets.createMany({
        data: [...next].map(([categoryId, amount]) => ({ wedding_id: w.id, category_id: categoryId, manual_amount: amount })),
        skipDuplicates: true,
      });
    });
    return this.summary(userId);
  }

  // ---------- Chi phí khác ngoài WebPlan ----------

  static checkExtraCost(body: { name?: unknown; amount?: unknown }, partial = false) {
    const errors: Record<string, string> = {};
    const data: { name?: string; amount?: number } = {};
    if (!partial || body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
      if (!name) errors.name = 'Nhập tên khoản chi.';
      else if (name.length > 100) errors.name = 'Tối đa 100 ký tự.';
      else data.name = name;
    }
    if (!partial || body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isInteger(amount) || amount <= 0 || amount > 1e13) errors.amount = 'Số tiền là số nguyên dương.';
      else data.amount = amount;
    }
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Khoản chi chưa hợp lệ.', 400, errors);
    return data;
  }

  async addExtraCost(userId: string, body: { name?: unknown; amount?: unknown; version?: unknown }) {
    requireDbFeature('budgetTiers');
    const w = await this.weddings.requireWedding(userId);
    const data = BudgetService.checkExtraCost(body) as { name: string; amount: number };
    if ((await this.prisma.wedding_extra_costs.count({ where: { wedding_id: w.id } })) >= MAX_EXTRA_COSTS) {
      return fail('EXTRA_COST_LIMIT', `Tối đa ${MAX_EXTRA_COSTS} khoản chi phí khác.`, 409);
    }
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, body.version);
      await tx.wedding_extra_costs.create({ data: { ...data, wedding_id: w.id } });
    });
    return this.summary(userId);
  }

  private async extraCost(weddingId: string, id: string) {
    const e = UUID.test(id) ? await this.prisma.wedding_extra_costs.findFirst({ where: { id, wedding_id: weddingId } }) : null;
    return e ?? fail('EXTRA_COST_NOT_FOUND', 'Không tìm thấy khoản chi.', 404);
  }

  async updateExtraCost(userId: string, id: string, body: { name?: unknown; amount?: unknown; version?: unknown }) {
    requireDbFeature('budgetTiers');
    const w = await this.weddings.requireWedding(userId);
    await this.extraCost(w.id, id);
    const data = BudgetService.checkExtraCost(body, true);
    if (!Object.keys(data).length) return fail('VALIDATION_ERROR', 'Không có gì để cập nhật.', 400);
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, body.version);
      await tx.wedding_extra_costs.update({ where: { id }, data });
    });
    return this.summary(userId);
  }

  async removeExtraCost(userId: string, id: string, version: unknown) {
    requireDbFeature('budgetTiers');
    const w = await this.weddings.requireWedding(userId);
    await this.extraCost(w.id, id);
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, version);
      await tx.wedding_extra_costs.delete({ where: { id } });
    });
    return this.summary(userId);
  }
}

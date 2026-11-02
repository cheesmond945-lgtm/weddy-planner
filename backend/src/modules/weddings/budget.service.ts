import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BUDGET_PRESETS, PRESET_LABEL, VENUE_SLUG, type BudgetPreset } from './allocation.config';
import { consequenceOf, costOf, venueFits, type AllocResult, type AllocRow, type ChosenItem } from './allocation';
import { BudgetCalcService } from './budget-calc.service';
import { tableCount } from './budget-engine';
import { bumpVersion, versionOf } from './wedding-version';
import { requireDbFeature } from '../../prisma/db-features';
import { WeddingsService } from './weddings.service';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

const pct = (x: number | null) => (x === null ? null : Math.round(x * 1000) / 10);

/** Tỷ lệ % khởi tạo thanh kéo Tùy chỉnh: các dịch vụ chưa cọc (đã chọn hoặc chưa), tổng 100, giữ 8 chữ số để số tiền khách gõ hiện lại đúng */
const sliderWeights = (result: AllocResult) =>
  Object.fromEntries(result.rows.filter((r) => r.share !== null).map((r) => [r.slug, Math.round(r.share! * 1e10) / 1e8]));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tối đa số khoản chi phí khác của một đám cưới. */
export const MAX_EXTRA_COSTS = 200;

type Wedding = Awaited<ReturnType<WeddingsService['requireWedding']>>;

/**
 * Tab Ngân sách (docs/api/weddings.md mục 7): phân bổ và gợi ý gói theo thuật toán (allocation.ts, không lưu số phân bổ),
 * chi phí khác. Mọi phép tính ở allocation.ts; ở đây chỉ đọc, ghi và kiểm tra.
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
    const planVendor = new Map(input.planVendors.map((v) => [v.vendorId, v]));
    const tables = result.tables;
    const unitOf = (u: string | null) => (u === 'mâm' ? ('TABLE' as const) : u ? ('PACKAGE' as const) : null);

    const vendorRow = (row: AllocRow, c: ChosenItem) => {
      const snap = statusOf.get(c.vendorId);
      const hasOrder = c.packageSource === 'ORDER';
      // Dropdown gói chỉ sửa được khi chưa có đơn; gói tiệc vượt sức chứa bị vô hiệu; mỗi gói kèm hệ quả nếu chọn
      const options = hasOrder
        ? []
        : (planVendor.get(c.vendorId)?.packages ?? []).map((p) => {
            const est = costOf(p, tables);
            return {
              id: p.id,
              name: p.name,
              price: p.price,
              unit: unitOf(p.unit),
              minTables: p.minTables,
              capacity: p.capacity,
              cost: est.cost,
              chargedTables: est.chargedTables,
              fits: row.slug !== VENUE_SLUG || venueFits(p, input.guestCount),
              consequence: consequenceOf(input, row.categoryId, est.cost).message,
            };
          });
      return {
        id: c.vendorId,
        name: snap?.serviceName ?? c.vendorName,
        status: snap?.status ?? null,
        cost: c.cost,
        hasOrder,
        /** Nhãn nguồn dưới số: PLANNED "Dự kiến", ORDER "Theo đơn", DEPOSITED "Đã cọc" */
        costSource: c.costSource,
        deposited: c.deposited,
        overCapacity: c.overCapacity,
        package: { id: c.packageId, name: c.packageName, source: c.packageSource, unavailable: c.packageUnavailable, unit: unitOf(c.unit), minTables: c.minTables, chargedTables: c.chargedTables },
        options,
      };
    };

    const chosen = result.rows.flatMap((r) => r.chosen);
    const ordered = chosen.filter((c) => c.costSource !== 'PLANNED');
    const ordersTotal = sum(ordered.map((c) => c.cost));
    const deposited = sum(ordered.map((c) => c.deposited));
    const plannedTotal = sum(chosen.filter((c) => c.costSource === 'PLANNED').map((c) => c.cost));

    return {
      version: versionOf(fresh),
      preset: input.preset,
      presetLabel: PRESET_LABEL[input.preset],
      /** Tỷ lệ % của các dịch vụ chưa cọc (khởi tạo thanh kéo Tùy chỉnh), tổng 100 */
      presetWeights: sliderWeights(result),
      /** Tiền chia cho các dịch vụ chưa cọc: số tiền ở thanh kéo = sliderPool × % */
      sliderPool: result.sliderPool,
      ownVenue: input.ownVenue,
      ownVenueCost: input.ownVenueCost ?? null,
      guestCount: input.guestCount,
      tables: { count: tables, auto: tableCount(input.guestCount, null), override: input.tableOverride ?? null },
      categories: result.rows.map((r) => ({
        categoryId: r.categoryId,
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        status: r.status,
        cost: r.cost,
        /** Trọng số (%) dùng khi duyệt B3 (chỉ dịch vụ chưa chọn) */
        weight: pct(r.weight),
        /** Tỷ lệ (%) của hạng mục trong mức chia hiện tại (hiển thị "Tỷ lệ") */
        share: pct(r.share),
        /** Giới hạn riêng của hạng mục (hiển thị "Gợi ý: X" / "Giới hạn gợi ý: X") */
        shareLimit: r.shareLimit,
        allocation: r.allocation,
        cap: r.cap,
        /** "Gợi ý: X" (không sửa tay) */
        limit: r.limit,
        minPrice: r.minPrice,
        medianPrice: r.medianPrice,
        message: r.message,
        suggestion: r.suggestion && {
          packageId: r.suggestion.package.id,
          packageName: r.suggestion.package.name,
          vendorId: r.suggestion.package.vendorId,
          vendorName: r.suggestion.package.vendorName,
          cost: r.suggestion.cost,
          chargedTables: r.suggestion.chargedTables,
          unit: unitOf(r.suggestion.package.unit),
          label: r.suggestion.label,
        },
        vendors: r.chosen.map((c) => vendorRow(r, c)),
      })),
      totals: {
        total: input.total,
        /** Giá các đơn đã chốt (theo đơn / đã cọc) */
        ordersTotal,
        deposited,
        /** Còn phải trả cho nhà cung cấp = giá đơn − đã cọc */
        owed: ordersTotal - deposited,
        /** Dự kiến chưa chốt: chi phí theo gói đang chọn của dịch vụ chưa có đơn */
        plannedTotal,
        lostDeposits: input.lostDeposits ?? 0,
        extraCosts: input.extraCosts ?? 0,
        ownVenueCost: result.ownVenueCost,
        /** Còn lại = tổng − giá đơn đã chốt − dự kiến chưa chốt (− cọc mất, chi phí khác, tiệc tự lo); không trừ thêm số đã cọc */
        remaining: input.total - result.committed,
        /** Tổng chi phí các gói gợi ý cho hạng mục chưa chọn */
        suggestedTotal: result.suggestedTotal,
        /** Còn dư sau khi trừ cả gói gợi ý (0 nếu không dư) */
        leftover: result.leftover?.amount ?? 0,
      },
      status: result.status,
      overBudget: result.overBudget,
      feasibility: result.feasibility,
      leftoverMessage: result.leftover?.message ?? null,
      extraCosts: input.extraRows,
      warnings: chosen
        .filter((c) => c.packageUnavailable)
        .map((c) => ({ code: 'PACKAGE_UNAVAILABLE' as const, vendorId: c.vendorId, message: 'Gói bạn chọn không còn bán, đang tính theo gói dự kiến.' })),
    };
  }

  /**
   * PATCH …/budget/settings: mức chia, tỷ lệ Tùy chỉnh (tổng 100%), tiệc tự lo và chi phí tự lo.
   * Chỉ lưu đầu vào; phân bổ tính lại khi đọc (không có cột số tiền phân bổ).
   */
  async updateSettings(userId: string, body: Record<string, unknown>) {
    requireDbFeature('budgetAllocation');
    const w = await this.weddings.requireWedding(userId);
    const errors: Record<string, string> = {};
    const data: { budget_preset?: BudgetPreset; custom_weights?: Record<string, number>; own_venue?: boolean; own_venue_cost?: number | null } = {};

    if (body.budgetPreset !== undefined) {
      if (!(BUDGET_PRESETS as unknown[]).includes(body.budgetPreset)) errors.budgetPreset = 'Mức chia phải là BALANCED, SPACE, VISUAL hoặc CUSTOM.';
      else data.budget_preset = body.budgetPreset as BudgetPreset;
    }
    if (body.customWeights !== undefined) {
      const v = body.customWeights;
      const entries = v && typeof v === 'object' && !Array.isArray(v) ? Object.entries(v as Record<string, unknown>) : null;
      if (!entries || !entries.length || entries.length > 20) errors.customWeights = 'Tỷ lệ Tùy chỉnh chưa hợp lệ.';
      else if (entries.some(([k, n]) => !/^[a-z0-9-]{1,40}$/.test(k) || typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)) {
        errors.customWeights = 'Mỗi tỷ lệ là số từ 0 đến 100.';
      } // Tổng 100%; chỉ còn một hạng mục thì được đặt thấp hơn (số tiền tuyệt đối, phần còn lại không giao)
      else if (entries.reduce((s, [, n]) => s + (n as number), 0) > 100.5 || (entries.length > 1 && Math.abs(entries.reduce((s, [, n]) => s + (n as number), 0) - 100) > 0.5)) errors.customWeights = 'Tổng tỷ lệ phải bằng 100%.';
      else if (entries.every(([, n]) => n === 0)) errors.customWeights = 'Tỷ lệ phải lớn hơn 0.';
      else data.custom_weights = Object.fromEntries(entries.map(([k, n]) => [k, Math.round((n as number) * 1e8) / 1e8]));
    }
    if (body.ownVenue !== undefined) {
      if (typeof body.ownVenue !== 'boolean') errors.ownVenue = 'Giá trị không hợp lệ.';
      else data.own_venue = body.ownVenue;
    }
    if (body.ownVenueCost !== undefined) {
      const n = body.ownVenueCost === null ? null : Number(body.ownVenueCost);
      if (n !== null && (!Number.isInteger(n) || n < 0 || n > 1e13)) errors.ownVenueCost = 'Chi phí tự lo là số nguyên không âm.';
      else data.own_venue_cost = n;
    }
    // Chọn Tùy chỉnh mà chưa từng có tỷ lệ thì bắt buộc gửi kèm
    if (data.budget_preset === 'CUSTOM' && !data.custom_weights && !(w as { custom_weights?: unknown }).custom_weights) errors.customWeights = 'Chọn Tùy chỉnh cần gửi kèm tỷ lệ.';
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400, errors);
    if (!Object.keys(data).length) return fail('VALIDATION_ERROR', 'Không có gì để cập nhật.', 400);
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, body.version);
      await tx.weddings.update({ where: { id: w.id }, data });
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

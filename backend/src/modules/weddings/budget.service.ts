import { HttpException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { BUDGET_PRESETS, PRESET_LABEL, VENUE_SLUG, type BudgetPreset } from './allocation.config';
import { consequenceOf, costOf, venueFits, type AllocRow, type ChosenItem } from './allocation';
import { BudgetCalcService, parseSplitConfig, serializeSplit } from './budget-calc.service';
import { tableCount } from './budget-engine';
import { BASE_MODES, initFromMode, isValidSplit, TOTAL, type BaseMode, type SplitState } from './budget-split';
import { bumpVersion, versionOf } from './wedding-version';
import { requireDbFeature } from '../../prisma/db-features';
import { WeddingsService } from './weddings.service';

const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Tối đa số khoản chi phí khác của một đám cưới. */
export const MAX_EXTRA_COSTS = 200;

/** Lưu cấu hình Tùy chỉnh không hợp lệ (mục 7): 422, giữ cấu hình cũ */
const invalidSplit = (message: string): never => fail('BUDGET_SPLIT_INVALID', message, 422);

type Wedding = Awaited<ReturnType<WeddingsService['requireWedding']>>;

/**
 * Tab Ngân sách (docs/api/weddings.md mục 7; tài liệu "Luồng Tùy chỉnh ngân sách" v1.2): quỹ dịch vụ, phân bổ và gợi ý gói theo
 * thuật toán (allocation.ts, budget-split.ts; không lưu số tiền phân bổ), cấu hình Tùy chỉnh tự lưu, chi phí khác.
 * Thao tác ghi đám cưới kèm `version` (weddings.updated_date); cấu hình Tùy chỉnh có số phiên bản riêng (số nguyên).
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

  /**
   * Ghi cấu hình Tùy chỉnh có kiểm tra phiên bản (khóa dòng, so version đang lưu). Trả version mới, hoặc null khi lệch.
   * Không đổi weddings.updated_date để tự lưu không làm lệch phiên bản của các form khác.
   */
  private async writeSplit(weddingId: string, expected: number, state: SplitState) {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ custom_weights: unknown }[]>`SELECT custom_weights FROM weddings WHERE id = ${weddingId}::uuid FOR UPDATE`;
      const cur = parseSplitConfig(rows[0]?.custom_weights);
      if ((cur?.version ?? 0) !== expected) return null;
      const next = serializeSplit(state, expected + 1, cur?.state ?? null);
      await tx.$executeRaw`UPDATE weddings SET custom_weights = ${JSON.stringify(next)}::jsonb, budget_preset = 'CUSTOM' WHERE id = ${weddingId}::uuid`;
      return expected + 1;
    });
  }

  async summaryOf(w: Wedding) {
    const [{ input, result }, snapshot, fresh] = await Promise.all([
      this.calc.compute(w.id),
      this.weddings.planSnapshot(w.user_id, w.id),
      this.prisma.weddings.findUniqueOrThrow({ where: { id: w.id }, select: { updated_date: true } }),
    ]);
    const split = result.split;
    // Mở lại tab khi nhóm chia đã đổi (chọn gói, có đơn, hủy đơn…): áp onGroupChange vào cấu hình đã lưu và lưu lại kết quả
    let splitVersion = input.stored?.version ?? 0;
    if (split.state && split.changed) splitVersion = (await this.writeSplit(w.id, splitVersion, split.state)) ?? splitVersion;
    const nameOf = new Map(result.rows.map((r) => [r.categoryId, r.name]));

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
      ownVenue: input.ownVenue,
      ownVenueCost: input.ownVenueCost ?? null,
      guestCount: input.guestCount,
      tables: { count: tables, auto: tableCount(input.guestCount, null), override: input.tableOverride ?? null },
      /** Quỹ dịch vụ và chi tiết (ⓘ), dòng Tiệc chỉ đọc */
      fund: result.fund,
      /**
       * Nhóm chia. `config`: cấu hình Tùy chỉnh đang dùng (đã áp nhóm hiện tại), null nếu đang dùng phương án có sẵn.
       * `eligible`: các dịch vụ chưa chọn có gói hợp lệ (gồm cả hạng mục đã bỏ khỏi phần chia) để client tự tính lại khi kéo.
       * `notices`: thông báo hạng mục tự mở khóa khi nhóm đổi.
       */
      split: {
        mode: split.mode,
        baseMode: split.baseMode,
        config: split.state && {
          version: splitVersion,
          baseMode: split.state.baseMode,
          excluded: split.state.excluded,
          capAmount: split.state.capAmount,
          items: split.state.items.map((i) => ({ categoryId: i.id, ratio: i.ratio, locked: i.locked })),
        },
        eligible: result.rows
          .filter((r) => r.kind === 'SERVICE' && (r.status === 'SUGGESTED' || r.status === 'EXCLUDED') && r.medianPrice !== null)
          .map((r) => ({ categoryId: r.categoryId, slug: r.slug, median: r.medianPrice! })),
        notices: split.unlocked.map((id) => `Hạng mục ${nameOf.get(id) ?? ''} đã được mở khóa để cân đối tỷ lệ vì một hạng mục không còn trong phần chia.`),
      },
      categories: result.rows.map((r) => ({
        categoryId: r.categoryId,
        slug: r.slug,
        name: r.name,
        kind: r.kind,
        status: r.status,
        cost: r.cost,
        /** Tỷ lệ trong nhóm chia (số nguyên theo 0,01%), null nếu ngoài nhóm */
        ratio: r.ratio,
        /** Ngân sách hạng mục: tiền phân bổ (trong nhóm), giới hạn gợi ý (đã chọn / có đơn chưa cọc), giới hạn gói tiệc */
        limit: r.limit,
        minPrice: r.minPrice,
        medianPrice: r.medianPrice,
        maxPackagePrice: r.maxPackagePrice,
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
        /** Gói hợp lệ (chỉ hạng mục trong nhóm chia): client chọn gói gợi ý ngay khi tỷ lệ đổi */
        packages: r.packages.map((p) => ({ ...p, unit: unitOf(p.unit) })),
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
        /** "Còn dư" của phần chia (nhóm rỗng, hoặc chênh lệch với giá trần) */
        leftover: result.leftover?.amount ?? 0,
      },
      status: result.status,
      overBudget: result.overBudget,
      feasibility: result.feasibility,
      extraCosts: input.extraRows,
      warnings: chosen
        .filter((c) => c.packageUnavailable)
        .map((c) => ({ code: 'PACKAGE_UNAVAILABLE' as const, vendorId: c.vendorId, message: 'Gói bạn chọn không còn bán, đang tính theo gói dự kiến.' })),
    };
  }

  /**
   * PATCH …/budget/settings: mức chia, tiệc tự lo và chi phí tự lo. Chọn Tùy chỉnh lần đầu thì khởi tạo cấu hình từ phương án đang dùng;
   * đã có cấu hình thì dùng lại. Chỉ lưu đầu vào; phân bổ tính lại khi đọc (không có cột số tiền phân bổ).
   */
  async updateSettings(userId: string, body: Record<string, unknown>) {
    requireDbFeature('budgetAllocation');
    const w = await this.weddings.requireWedding(userId);
    const errors: Record<string, string> = {};
    const data: { budget_preset?: BudgetPreset; custom_weights?: object; own_venue?: boolean; own_venue_cost?: number | null } = {};

    if (body.budgetPreset !== undefined) {
      if (!(BUDGET_PRESETS as unknown[]).includes(body.budgetPreset)) errors.budgetPreset = 'Mức chia phải là BALANCED, SPACE, VISUAL hoặc CUSTOM.';
      else data.budget_preset = body.budgetPreset as BudgetPreset;
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
    if (Object.keys(errors).length) return fail('VALIDATION_ERROR', 'Thông tin chưa hợp lệ.', 400, errors);
    if (!Object.keys(data).length) return fail('VALIDATION_ERROR', 'Không có gì để cập nhật.', 400);

    // Vào Tùy chỉnh lần đầu: tỷ lệ khởi tạo từ phương án đang dùng (mục 4.2), mọi hạng mục mở khóa.
    // Đã có cấu hình Tùy chỉnh từ trước thì giữ nguyên, khỏi tính cả bảng ngân sách (DB ở xa, mỗi lần tính mất vài giây)
    if (data.budget_preset === 'CUSTOM' && !parseSplitConfig((w as { custom_weights?: unknown }).custom_weights)) {
      const { input, result } = await this.calc.compute(w.id);
      if (!input.stored) {
        const baseMode: BaseMode = input.preset === 'CUSTOM' ? 'BALANCED' : input.preset;
        const state: SplitState = { baseMode, excluded: [], capAmount: null, items: initFromMode(result.split.members, baseMode) };
        data.custom_weights = serializeSplit(state, 1, null);
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await bumpVersion(tx, w.id, body.version);
      await tx.weddings.update({ where: { id: w.id }, data });
    });
    return this.summary(userId);
  }

  /**
   * PUT …/budget/split (mục 7): tự lưu toàn bộ cấu hình Tùy chỉnh. Backend không tin client: kiểm tra đủ điều kiện rồi mới ghi,
   * sai thì 422 (giữ cấu hình cũ); version lệch thì 409 kèm ngân sách mới nhất ở details.budget.
   */
  async saveSplit(userId: string, body: Record<string, unknown>) {
    requireDbFeature('budgetAllocation');
    const w = await this.weddings.requireWedding(userId);
    const { input, result } = await this.calc.compute(w.id);
    const current = input.stored?.version ?? 0;
    const conflict = async () => fail('BUDGET_SPLIT_CONFLICT', 'Tỷ lệ đã được cập nhật ở nơi khác.', 409, { budget: await this.summaryOf(w) });

    if (!Number.isInteger(body.version) || (body.version as number) < 0) return invalidSplit('Thiếu phiên bản cấu hình.');
    if (body.version !== current) return conflict();
    if (!(BASE_MODES as unknown[]).includes(body.baseMode)) return invalidSplit('Phương án nền không hợp lệ.');

    // Hạng mục bỏ khỏi phần chia: dịch vụ (không phải tiệc) trong kế hoạch, chưa được chọn
    const openService = new Set(result.rows.filter((r) => r.kind === 'SERVICE' && r.status !== 'CHOSEN').map((r) => r.categoryId));
    const excluded = body.excluded;
    if (!Array.isArray(excluded) || excluded.length > 20 || excluded.some((x) => typeof x !== 'string' || !openService.has(x)) || new Set(excluded).size !== excluded.length) {
      return invalidSplit('Danh sách dịch vụ bỏ khỏi phần chia không hợp lệ.');
    }

    // Nhóm chia hiện tại = dịch vụ chưa chọn có gói hợp lệ, trừ hạng mục bị bỏ
    const eligible = result.rows.filter((r) => r.kind === 'SERVICE' && (r.status === 'SUGGESTED' || r.status === 'EXCLUDED'));
    const group = eligible.filter((r) => !(excluded as string[]).includes(r.categoryId));
    const raw = body.items;
    if (!Array.isArray(raw) || raw.length > 20) return invalidSplit('Cấu hình tỷ lệ không hợp lệ.');
    const items = raw.map((i: Record<string, unknown>) => ({
      id: typeof i?.categoryId === 'string' ? i.categoryId : '',
      slug: group.find((r) => r.categoryId === i?.categoryId)?.slug ?? '',
      ratio: i?.ratio as number,
      locked: i?.locked,
    }));
    if (items.some((i) => !Number.isInteger(i.ratio) || i.ratio < 0 || i.ratio > TOTAL || typeof i.locked !== 'boolean')) {
      return invalidSplit('Mỗi tỷ lệ là số nguyên từ 0 đến 10000.');
    }
    const ids = new Set(items.map((i) => i.id));
    if (ids.size !== items.length || ids.size !== group.length || group.some((r) => !ids.has(r.categoryId))) {
      return invalidSplit('Cấu hình chỉ được chứa đúng các hạng mục đang nằm trong phần chia.');
    }
    if (items.length && sum(items.map((i) => i.ratio)) !== TOTAL) return invalidSplit('Tổng tỷ lệ phải bằng 100%.');
    const valid = items as { id: string; slug: string; ratio: number; locked: boolean }[];
    if (valid.length >= 2 && valid.every((i) => i.locked)) return invalidSplit('Cần giữ ít nhất một hạng mục mở khóa để hệ thống cân đối tỷ lệ.');
    if (!isValidSplit(valid)) return invalidSplit('Cấu hình tỷ lệ không hợp lệ.');

    const cap = body.capAmount;
    if (cap !== null && cap !== undefined && (!Number.isInteger(cap) || (cap as number) < 0 || (cap as number) > 1e13)) {
      return invalidSplit('Giá trần là số nguyên không âm.');
    }
    if (cap != null && valid.length !== 1) return invalidSplit('Giá trần chỉ áp dụng khi phần chia còn đúng một hạng mục.');

    const state: SplitState = {
      baseMode: body.baseMode as BaseMode,
      excluded: excluded as string[],
      capAmount: (cap as number | null | undefined) ?? null,
      // Một hạng mục luôn 100% và mở khóa
      items: valid.map((i) => (valid.length === 1 ? { ...i, locked: false } : i)),
    };
    if ((await this.writeSplit(w.id, current, state)) === null) return conflict();
    return this.summary(userId);
  }

  // ---------- Chi phí khác ngoài Forever ----------

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

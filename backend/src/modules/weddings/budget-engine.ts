/**
 * Hàm tính ngân sách thuần (không DB, không Nest), có unit test ở backend/test/budget-engine.test.cjs.
 * Đặc tả: docs/api/weddings.md mục 7. Hằng số: budget.config.ts.
 *
 * - Ngân sách gợi ý của hạng mục = phân vị chi phí các gói đang bán của hạng mục theo mức chi, làm tròn 100.000đ.
 * - Ngân sách hiển thị = số khách sửa tay nếu có, ngược lại số gợi ý.
 * - Chi phí của nhà cung cấp trong kế hoạch = tổng đơn > gói khách chọn > gói dự kiến (lớn nhất vừa ngân sách hạng mục).
 */
import {
  AUTO_ORDER,
  BUDGET_ROUNDING,
  CAPACITY_CATEGORIES,
  FALLBACK_SHARE,
  FALLBACK_SHARE_DEFAULT,
  GUESTS_PER_TABLE,
  TIER_LABEL,
  TIER_PERCENTILE,
  type ConcreteTier,
  type SpendingTier,
} from './budget.config';

export type PackageUnit = 'mâm' | 'gói';

export interface EnginePackage {
  id: string;
  vendorId: string;
  name: string;
  /** Giá một mâm (unit = mâm) hoặc giá trọn gói */
  price: number;
  unit: PackageUnit;
  capacity: number | null;
  minTables: number | null;
}

export interface EngineCategory {
  id: string;
  slug: string;
  name: string;
  /** Gói đã duyệt của các nhà cung cấp đang hiện trong hạng mục */
  packages: EnginePackage[];
}

export interface EnginePlanVendor {
  vendorId: string;
  categoryId: string;
  slug: string;
  /** Gói khách đã chọn (plan_vendors.package_id) */
  selectedPackageId: string | null;
  /** Tổng đơn còn hiệu lực mới nhất; null khi chưa có đơn */
  orderTotal: number | null;
  /** Gói đang bán của nhà cung cấp này (đã duyệt, nhà cung cấp đang hiện) */
  packages: EnginePackage[];
}

export interface BudgetInput {
  total: number;
  guestCount: number;
  tableOverride: number | null;
  tier: SpendingTier;
  /** Tổng chi phí khác ngoài WebPlan */
  extraCosts: number;
  /** Các hạng mục có ô ngân sách: khách chọn (wedding_categories) và hạng mục của nhà cung cấp trong kế hoạch */
  categories: EngineCategory[];
  /** Ngân sách sửa tay theo categoryId */
  manual: Map<string, number>;
  planVendors: EnginePlanVendor[];
}

export const roundBudget = (n: number) => Math.round(n / BUDGET_ROUNDING) * BUDGET_ROUNDING;

/** Số mâm: số khách tự nhập nếu có, ngược lại ceil(số khách / 10). */
export const tableCount = (guestCount: number, override: number | null) => override ?? Math.max(1, Math.ceil(Math.max(0, guestCount) / GUESTS_PER_TABLE));

/** Chi phí một gói: gói theo mâm = giá × max(số mâm, số mâm tối thiểu, 1); gói khác = giá trọn gói. */
export const packageCost = (p: Pick<EnginePackage, 'price' | 'unit' | 'minTables'>, tables: number) =>
  p.unit === 'mâm' ? p.price * Math.max(tables, p.minTables ?? 0, 1) : p.price;

/** Gói đủ chỗ (hạng mục có xét sức chứa): sức chứa ≥ số khách; gói không ghi sức chứa thì giữ lại. */
export const fitsGuests = (p: EnginePackage, slug: string, guestCount: number) => !CAPACITY_CATEGORIES.includes(slug) || p.capacity === null || p.capacity >= guestCount;

/** Phân vị nearest-rank trên mảng đã sắp tăng dần: phần tử thứ max(ceil(p × n), 1). */
export function nearestRank(sorted: number[], p: number) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length, Math.max(Math.ceil(p * sorted.length), 1)) - 1];
}

interface Suggestion {
  amount: number;
  source: 'PACKAGES' | 'FALLBACK';
  packageCount: number;
}

/** Ngân sách gợi ý của mọi hạng mục khách chọn theo một mức. */
export function suggestAll(input: Pick<BudgetInput, 'total' | 'guestCount' | 'tableOverride' | 'categories'>, tier: ConcreteTier): Map<string, Suggestion> {
  const tables = tableCount(input.guestCount, input.tableOverride);
  const share = (slug: string) => FALLBACK_SHARE[slug] ?? FALLBACK_SHARE_DEFAULT;
  const shareSum = input.categories.reduce((s, c) => s + share(c.slug), 0) || 1;
  const out = new Map<string, Suggestion>();
  for (const c of input.categories) {
    const costs = c.packages
      .filter((p) => fitsGuests(p, c.slug, input.guestCount))
      .map((p) => packageCost(p, tables))
      .sort((a, b) => a - b);
    const v = nearestRank(costs, TIER_PERCENTILE[tier]);
    out.set(
      c.id,
      v === null
        ? { amount: roundBudget((input.total * share(c.slug)) / shareSum), source: 'FALLBACK', packageCount: 0 }
        : { amount: roundBudget(v), source: 'PACKAGES', packageCount: costs.length },
    );
  }
  return out;
}

const sum = (xs: Iterable<number>) => [...xs].reduce((s, x) => s + x, 0);

/**
 * Mức đang áp dụng. Khách chọn tay thì dùng mức đó. AUTO: mức cao nhất mà tổng gợi ý ≤ tổng ngân sách − chi phí khác;
 * không mức nào vừa thì SAVING.
 */
export function chooseTier(input: Pick<BudgetInput, 'total' | 'guestCount' | 'tableOverride' | 'categories' | 'extraCosts' | 'tier'>) {
  const totals = {} as Record<ConcreteTier, number>;
  for (const t of AUTO_ORDER) totals[t] = sum([...suggestAll(input, t).values()].map((s) => s.amount));
  const available = input.total - input.extraCosts;
  const effective: ConcreteTier = input.tier !== 'AUTO' ? input.tier : (AUTO_ORDER.find((t) => totals[t] <= available) ?? 'SAVING');
  return { effective, tierTotals: totals, available };
}

/**
 * Gói dự kiến của một nhà cung cấp: trong các gói đủ chỗ (không gói nào đủ thì xét tất cả), lấy gói có chi phí lớn nhất
 * không vượt ngân sách hạng mục; hòa thì gói giá thấp hơn; không gói nào vừa (hoặc không có ngân sách) thì gói rẻ nhất.
 */
export function plannedPackage(packages: EnginePackage[], slug: string, guestCount: number, tables: number, budget: number | null) {
  if (!packages.length) return null;
  const fitting = packages.filter((p) => fitsGuests(p, slug, guestCount));
  const pool = (fitting.length ? fitting : packages).map((p) => ({ p, cost: packageCost(p, tables) }));
  const byCostAsc = [...pool].sort((a, b) => a.cost - b.cost || a.p.price - b.p.price || a.p.id.localeCompare(b.p.id));
  if (budget !== null) {
    const within = byCostAsc.filter((x) => x.cost <= budget);
    if (within.length) {
      const best = within[within.length - 1].cost;
      return within.find((x) => x.cost === best)!;
    }
  }
  return byCostAsc[0];
}

export type BudgetWarning =
  | { code: 'BELOW_SAVING'; message: string; amount: number }
  | { code: 'TIER_OVER_BUDGET'; message: string; amount: number }
  | { code: 'ALLOCATED_OVER_BUDGET'; message: string; amount: number }
  | { code: 'PACKAGE_UNAVAILABLE'; message: string; vendorId: string };

const money = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;

export function computeBudget(input: BudgetInput) {
  const tables = tableCount(input.guestCount, input.tableOverride);
  const { effective, tierTotals, available } = chooseTier(input);
  const suggestions = suggestAll(input, effective);

  const categories = input.categories.map((c) => {
    const s = suggestions.get(c.id)!;
    const manual = input.manual.get(c.id);
    const isManual = manual !== undefined;
    const reason = isManual
      ? 'Bạn đã sửa'
      : s.source === 'PACKAGES'
        ? `Theo giá gói mức ${TIER_LABEL[effective]}`
        : 'Theo tỷ lệ gợi ý (chưa có gói phù hợp)';
    return { categoryId: c.id, slug: c.slug, name: c.name, budget: isManual ? manual : s.amount, suggested: s.amount, manual: isManual, reason, source: s.source, packageCount: s.packageCount };
  });
  const budgetOf = new Map(categories.map((c) => [c.categoryId, c.budget]));

  const vendors = input.planVendors.map((v) => {
    const budget = budgetOf.get(v.categoryId) ?? null;
    const selected = v.selectedPackageId ? (v.packages.find((p) => p.id === v.selectedPackageId) ?? null) : null;
    const packageUnavailable = !!v.selectedPackageId && !selected;
    if (v.orderTotal !== null) {
      return { vendorId: v.vendorId, categoryId: v.categoryId, cost: v.orderTotal, packageId: selected?.id ?? null, packageName: selected?.name ?? null, packageSource: 'ORDER' as const, packageUnavailable, unit: selected?.unit ?? null };
    }
    if (selected) {
      return { vendorId: v.vendorId, categoryId: v.categoryId, cost: packageCost(selected, tables), packageId: selected.id, packageName: selected.name, packageSource: 'SELECTED' as const, packageUnavailable: false, unit: selected.unit };
    }
    const planned = plannedPackage(v.packages, v.slug, input.guestCount, tables, budget);
    return {
      vendorId: v.vendorId,
      categoryId: v.categoryId,
      cost: planned?.cost ?? 0,
      packageId: planned?.p.id ?? null,
      packageName: planned?.p.name ?? null,
      packageSource: 'PLANNED' as const,
      packageUnavailable,
      unit: planned?.p.unit ?? null,
    };
  });

  const allocated = sum(categories.map((c) => c.budget));
  // Cùng phạm vi với "Ngân sách đã chia": chỉ nhà cung cấp thuộc hạng mục có ô ngân sách
  const packagesCost = sum(vendors.filter((v) => budgetOf.has(v.categoryId)).map((v) => v.cost));
  const warnings: BudgetWarning[] = [];
  const tierNeed = tierTotals[effective];
  if (tierNeed > available) {
    warnings.push(
      effective === 'SAVING'
        ? { code: 'BELOW_SAVING', amount: tierNeed - available, message: `Ngân sách của bạn thấp hơn mức Tiết kiệm khoảng ${money(tierNeed - available)}.` }
        : { code: 'TIER_OVER_BUDGET', amount: tierNeed + input.extraCosts, message: `Mức ${TIER_LABEL[effective]} cần khoảng ${money(tierNeed + input.extraCosts)}, ngân sách của bạn là ${money(input.total)}.` },
    );
  }
  if (allocated > available && !warnings.length) {
    warnings.push({ code: 'ALLOCATED_OVER_BUDGET', amount: allocated - available, message: `Ngân sách đã chia vượt tổng ngân sách ${money(allocated - available)}.` });
  }
  for (const v of vendors.filter((x) => x.packageUnavailable)) {
    warnings.push({ code: 'PACKAGE_UNAVAILABLE', vendorId: v.vendorId, message: 'Gói bạn chọn không còn bán, đang tính theo gói dự kiến.' });
  }

  return {
    tier: input.tier,
    effectiveTier: effective,
    tierTotals,
    tables: { count: tables, auto: tableCount(input.guestCount, null), override: input.tableOverride },
    categories,
    vendors,
    totals: {
      total: input.total,
      extraCosts: input.extraCosts,
      /** "Ngân sách đã chia": tổng ngân sách hiển thị của các hạng mục */
      allocated,
      /** Tổng ngân sách − chi phí khác − ngân sách đã chia: dương là còn dư (chưa chia), âm là vượt */
      unallocated: available - allocated,
      /** "Chi phí theo gói đã chọn": tổng chi phí các nhà cung cấp thuộc hạng mục có ô ngân sách */
      packagesCost,
      /** Tổng ngân sách − chi phí theo gói − chi phí khác: dương là còn lại, âm là vượt */
      remaining: input.total - packagesCost - input.extraCosts,
    },
    warnings,
  };
}

export type BudgetResult = ReturnType<typeof computeBudget>;

export class RebalanceError extends Error {
  constructor(
    readonly code: 'REBALANCE_NOTHING_TO_SCALE' | 'REBALANCE_MANUAL_OVER_BUDGET',
    message: string,
  ) {
    super(message);
  }
}

/**
 * Cân đối: co (hoặc giãn) các ô chưa sửa tay với k = (tổng ngân sách − tổng ô sửa tay − chi phí khác) / tổng ô chưa sửa,
 * làm tròn 100.000đ. Trả về số mới cho các ô chưa sửa (categoryId -> số). Không chia khi mẫu số 0 hoặc k ≤ 0.
 */
export function rebalance(result: Pick<BudgetResult, 'categories'>, total: number, extraCosts: number) {
  const autoCells = result.categories.filter((c) => !c.manual);
  const manualSum = sum(result.categories.filter((c) => c.manual).map((c) => c.budget));
  const autoSum = sum(autoCells.map((c) => c.budget));
  if (!autoCells.length || autoSum <= 0) throw new RebalanceError('REBALANCE_NOTHING_TO_SCALE', 'Không còn ô nào chưa sửa để cân đối.');
  const k = (total - manualSum - extraCosts) / autoSum;
  if (k <= 0) throw new RebalanceError('REBALANCE_MANUAL_OVER_BUDGET', 'Các ô bạn sửa đã vượt tổng ngân sách.');
  return new Map(autoCells.map((c) => [c.categoryId, roundBudget(c.budget * k)]));
}

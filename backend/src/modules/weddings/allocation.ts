/**
 * Phân bổ ngân sách và gợi ý gói theo thuật toán (không DB, không Nest, không gọi AI). Unit test: backend/test/allocation.test.cjs.
 * Đặc tả: docs/api/weddings.md mục 7. Hằng số: allocation.config.ts.
 *
 * Phân bổ của từng hạng mục là giá trị dẫn xuất: chạy lại hàm này từ đầu mỗi khi đầu vào đổi, không lưu DB.
 * Hạng mục đã chọn luôn được trừ trước nên kết quả không phụ thuộc thứ tự khách chọn.
 * Ngân sách là ràng buộc mềm: gợi ý không bao giờ vượt (nhờ trần cứng), khách tự chọn thì được vượt kèm cảnh báo.
 */
import { BUDGET_FIT_DIRECTION, PRESET_H, VENUE_SLUG, type BudgetPreset } from './allocation.config';
import { fitsGuests, packageCost, plannedPackage, tableCount, type EnginePackage, type EnginePlanVendor } from './budget-engine';
import { normalizePlace } from './suggest-rules';

export interface AllocPackage extends EnginePackage {
  vendorName: string;
  /** Phường/xã của nhà cung cấp */
  ward: string | null;
  rating: number | null;
  reviewCount: number;
  styles: string[];
}

export interface AllocCategory {
  id: string;
  slug: string;
  name: string;
  /** Gói đang hiển thị: đã duyệt, NCC không ẩn, không bị khóa */
  packages: AllocPackage[];
}

export interface AllocPlanVendor extends EnginePlanVendor {
  vendorName: string;
  /** Đơn mới nhất của NCC này đã bị hủy: hạng mục trở về chưa chọn (cọc mất tính ở lostDeposits) */
  cancelled?: boolean;
}

export interface AllocInput {
  total: number;
  guestCount: number;
  tableOverride?: number | null;
  preset: BudgetPreset;
  /** Tỷ lệ % mức Tùy chỉnh theo slug */
  customWeights?: Record<string, number> | null;
  ownVenue: boolean;
  ownVenueCost?: number | null;
  /** Chi phí khác ngoài WebPlan: trừ như khoản đã chọn */
  extraCosts?: number;
  /** Tiền cọc của các đơn đã hủy (không hoàn): khoản đã chi, vẫn trừ vào tổng */
  lostDeposits?: number;
  /** Hạng mục trong kế hoạch (khách chọn ở "Dịch vụ muốn sử dụng" và hạng mục của NCC đã có trong kế hoạch) */
  categories: AllocCategory[];
  planVendors: AllocPlanVendor[];
  /** Nơi tổ chức (xếp hạng, không phải điều kiện ngân sách) */
  ward?: string | null;
  styles?: string[];
}

export type CostSource = 'PLANNED' | 'ORDER' | 'DEPOSITED';

export interface ChosenItem {
  vendorId: string;
  vendorName: string;
  packageId: string | null;
  packageName: string | null;
  /** Gói khách chọn (SELECTED), gói dự kiến rẻ nhất (PLANNED) hoặc theo đơn (ORDER) */
  packageSource: 'SELECTED' | 'PLANNED' | 'ORDER';
  packageUnavailable: boolean;
  cost: number;
  costSource: CostSource;
  deposited: number;
  unit: EnginePackage['unit'] | null;
  minTables: number | null;
  /** Số bàn tính tiền (gói theo bàn) */
  chargedTables: number | null;
  /** Gói tiệc vượt sức chứa so với số khách: "Không còn phù hợp: vượt sức chứa" */
  overCapacity: boolean;
}

export type AllocLabel = { code: 'OVER_ALLOCATION' } | { code: 'OVER_BY'; amount: number };

export interface Suggestion {
  package: AllocPackage;
  cost: number;
  chargedTables: number | null;
  label: AllocLabel | null;
}

export interface AllocRow {
  categoryId: string;
  slug: string;
  name: string;
  kind: 'VENUE' | 'SERVICE';
  /** CHOSEN đã chọn; SUGGESTED được gợi ý; NO_VENDOR chưa có NCC / không gói tiệc nào đủ sức chứa; OWN_VENUE tự lo tiệc */
  status: 'CHOSEN' | 'SUGGESTED' | 'NO_VENDOR' | 'OWN_VENUE';
  chosen: ChosenItem[];
  /** Chi phí đang tính cho hạng mục: tổng đã chọn, chi phí tự lo, hoặc chi phí gói gợi ý */
  cost: number;
  /** Trọng số đã chuẩn hóa (chỉ dịch vụ chưa chọn) */
  weight: number | null;
  /**
   * Tỷ lệ của hạng mục trong mức chia hiện tại (chỉ dịch vụ chưa cọc, 0..1): Cân bằng / Ưu tiên … theo trung vị × h,
   * Tùy chỉnh theo tỷ lệ khách đặt. Gồm cả dịch vụ đã chọn chưa cọc. Khác `weight` (chỉ dùng để duyệt B3).
   */
  share: number | null;
  /**
   * Giới hạn riêng của hạng mục (để hiển thị và làm ngân sách hạng mục): `sliderPool` × `share`.
   * Không dồn phần dư của cả quỹ vào hạng mục cuối như `limit` ở bước B3.
   */
  shareLimit: number | null;
  /** Phần chia (dịch vụ) hoặc Mục tiêu (tiệc) */
  allocation: number | null;
  /** Trần cứng: còn lại − Σ giá rẻ nhất các hạng mục chưa xử lý phía sau */
  cap: number | null;
  /** "Gợi ý: X" = min(phần chia, trần cứng); là ngân sách hạng mục cho gợi ý ở trang Dịch vụ */
  limit: number | null;
  suggestion: Suggestion | null;
  /** Mặt bằng giá của hạng mục (tiệc: theo số bàn và sức chứa của kế hoạch) */
  minPrice: number | null;
  medianPrice: number | null;
  message: string | null;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
/** Mọi số tiền làm tròn tới đồng */
const round = (n: number) => Math.round(n);
/** Giới hạn hiển thị (giới hạn riêng) làm tròn tới 1.000đ cho dễ đọc */
const roundThousand = (n: number) => Math.round(n / 1000) * 1000;

/** Trung vị kiểu PERCENTILE_CONT(0.5): nội suy tuyến tính giữa hai phần tử giữa */
export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = (s.length - 1) / 2;
  return round(s[Math.floor(mid)] + (s[Math.ceil(mid)] - s[Math.floor(mid)]) * (mid - Math.floor(mid)));
}

/** Gói tiệc đủ sức chứa cho số khách (gói không ghi sức chứa thì giữ lại) */
export const venueFits = (p: EnginePackage, guestCount: number) => fitsGuests(p, VENUE_SLUG, guestCount);

/** Chi phí gói trong kế hoạch: tiệc = đơn giá/bàn × max(số bàn, MinTables); dịch vụ khác = giá gói */
export function costOf(p: EnginePackage, tables: number) {
  return { cost: packageCost(p, tables), chargedTables: p.unit === 'mâm' ? Math.max(tables, p.minTables ?? 0, 1) : null };
}

/** Các gói hợp lệ của hạng mục kèm chi phí: tiệc chỉ xét gói đủ sức chứa */
function candidates(c: AllocCategory, guestCount: number, tables: number) {
  const pool = c.slug === VENUE_SLUG ? c.packages.filter((p) => venueFits(p, guestCount)) : c.packages;
  return pool.map((p) => ({ p, ...costOf(p, tables) }));
}

/**
 * Mặt bằng giá: giá rẻ nhất và trung vị. Dịch vụ: theo giá gói. Tiệc: theo chi phí gói tiệc của kế hoạch (số bàn, sức chứa),
 * không lọc theo khu vực.
 */
export function priceLevels(c: AllocCategory, guestCount: number, tables: number) {
  const costs = candidates(c, guestCount, tables).map((x) => x.cost);
  return { min: costs.length ? Math.min(...costs) : null, median: median(costs), count: costs.length };
}

/** Chi phí của một NCC đã chọn: đơn (giá đơn) > gói khách chọn > gói dự kiến (rẻ nhất, đủ sức chứa) */
export function chosenItem(v: AllocPlanVendor, guestCount: number, tables: number): ChosenItem {
  const selected = v.selectedPackageId ? (v.packages.find((p) => p.id === v.selectedPackageId) ?? null) : null;
  const packageUnavailable = !!v.selectedPackageId && !selected;
  const pkg = selected ?? plannedPackage(v.packages, v.slug, guestCount, tables)?.p ?? null;
  const est = pkg ? costOf(pkg, tables) : null;
  const overCapacity = v.slug === VENUE_SLUG && !!pkg && !venueFits(pkg, guestCount);
  const base = {
    vendorId: v.vendorId,
    vendorName: v.vendorName,
    packageId: pkg?.id ?? null,
    packageName: pkg?.name ?? null,
    packageUnavailable,
    unit: pkg?.unit ?? null,
    minTables: pkg?.minTables ?? null,
    chargedTables: est?.chargedTables ?? null,
    overCapacity,
  };
  if (v.orderTotal !== null) {
    const dep = v.orderDeposited ?? null;
    return { ...base, packageSource: 'ORDER', cost: v.orderTotal, costSource: dep !== null ? 'DEPOSITED' : 'ORDER', deposited: dep ?? 0 };
  }
  return { ...base, packageSource: selected ? 'SELECTED' : 'PLANNED', cost: est?.cost ?? 0, costSource: 'PLANNED', deposited: 0 };
}

const validPct = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Trọng số chưa chuẩn hóa của một dịch vụ theo mức chia. Tùy chỉnh: hạng mục chưa có tỷ lệ đã lưu (khách vừa bỏ chọn)
 * nhận `fallback` (trung bình các tỷ lệ đã lưu), rồi chuẩn hóa lại cùng các hạng mục khác.
 */
function rawWeight(slug: string, medianPrice: number, preset: BudgetPreset, custom: Record<string, number> | null | undefined, fallback = 1) {
  if (preset === 'CUSTOM') {
    const pct = custom?.[slug];
    return validPct(pct) ? pct : fallback;
  }
  return medianPrice * (PRESET_H[preset][slug] ?? 1);
}

/** Chuẩn hóa trọng số về tổng 1 (tất cả bằng 0 thì chia đều) */
export function normalizeWeights<T extends { raw: number }>(items: T[]): (T & { weight: number })[] {
  const total = sum(items.map((i) => i.raw));
  return items.map((i) => ({ ...i, weight: total > 0 ? i.raw / total : 1 / items.length }));
}

/**
 * Xếp hạng "gói tốt nhất" trong tập thỏa điều kiện: cùng khu vực với nơi tổ chức trước; rồi theo BUDGET_FIT_DIRECTION;
 * rồi điểm đánh giá giảm dần, số lượt giảm dần; rồi số phong cách trùng.
 */
export function rankPackages<T extends { p: AllocPackage; cost: number }>(list: T[], limit: number, ward?: string | null, styles: string[] = [], direction = BUDGET_FIT_DIRECTION): T[] {
  const place = (x: T) => (ward ? (x.p.ward && normalizePlace(x.p.ward) === normalizePlace(ward) ? 0 : 1) : 0);
  const want = new Set(styles.map(normalizePlace));
  const overlap = (x: T) => x.p.styles.filter((s) => want.has(normalizePlace(s))).length;
  const fit = (x: T) => (direction === 'closest' ? limit - x.cost : x.cost);
  return [...list].sort(
    (a, b) =>
      place(a) - place(b) ||
      fit(a) - fit(b) ||
      (b.p.rating ?? -1) - (a.p.rating ?? -1) ||
      b.p.reviewCount - a.p.reviewCount ||
      overlap(b) - overlap(a) ||
      a.cost - b.cost ||
      a.p.id.localeCompare(b.p.id),
  );
}

/**
 * Chọn gói cho một hạng mục: tốt nhất có chi phí ≤ giới hạn; không có thì gói rẻ nhất ≤ trần cứng (nhãn "vượt phân bổ");
 * không có gói nào ≤ trần cứng thì gói rẻ nhất kèm nhãn "vượt X đ" (không chặn, không để trống).
 */
function pick(pool: { p: AllocPackage; cost: number; chargedTables: number | null }[], limit: number, cap: number, ward?: string | null, styles?: string[]): Suggestion | null {
  if (!pool.length) return null;
  const within = pool.filter((x) => x.cost <= limit);
  if (within.length) {
    const best = rankPackages(within, limit, ward, styles)[0];
    return { package: best.p, cost: best.cost, chargedTables: best.chargedTables, label: null };
  }
  const cheapest = [...pool].sort((a, b) => a.cost - b.cost || a.p.id.localeCompare(b.p.id));
  const underCap = cheapest.find((x) => x.cost <= cap);
  if (underCap) return { package: underCap.p, cost: underCap.cost, chargedTables: underCap.chargedTables, label: { code: 'OVER_ALLOCATION' } };
  const c = cheapest[0];
  return { package: c.p, cost: c.cost, chargedTables: c.chargedTables, label: { code: 'OVER_BY', amount: round(c.cost - Math.max(cap, 0)) } };
}

export interface Feasibility {
  ok: boolean;
  /** Tối thiểu cần: các khoản đã chọn + giá rẻ nhất của hạng mục chưa chọn */
  minNeed: number;
  shortfall: number;
  message: string | null;
  options: string[];
}

export function allocate(input: AllocInput) {
  const tables = tableCount(input.guestCount, input.tableOverride ?? null);
  const guests = input.guestCount;
  const venueCat = input.categories.find((c) => c.slug === VENUE_SLUG);

  // Hạng mục đã chọn: NCC trong kế hoạch, trừ NCC có đơn mới nhất đã hủy
  const chosenBy = new Map<string, ChosenItem[]>();
  for (const v of input.planVendors) {
    if (v.cancelled) continue;
    if (input.ownVenue && v.slug === VENUE_SLUG) continue;
    chosenBy.set(v.categoryId, [...(chosenBy.get(v.categoryId) ?? []), chosenItem(v, guests, tables)]);
  }

  const levels = new Map(input.categories.map((c) => [c.id, priceLevels(c, guests, tables)]));
  const ownVenueCost = input.ownVenue ? Math.max(0, input.ownVenueCost ?? 0) : 0;
  const committedChosen = sum([...chosenBy.values()].flat().map((i) => i.cost));
  const lost = input.lostDeposits ?? 0;
  const extra = input.extraCosts ?? 0;
  const committed = committedChosen + lost + ownVenueCost + extra;

  // Hạng mục chưa chọn, có gói (tiệc: có gói đủ sức chứa)
  const open = input.categories.filter((c) => !chosenBy.has(c.id) && !(input.ownVenue && c.slug === VENUE_SLUG));
  const openWithVendors = open.filter((c) => (levels.get(c.id)?.count ?? 0) > 0);
  const openServices = openWithVendors.filter((c) => c.slug !== VENUE_SLUG);
  const venueOpen = openWithVendors.find((c) => c.slug === VENUE_SLUG) ?? null;

  // B0. Kiểm tra khả thi (chỉ cảnh báo)
  const minNeed = committed + sum(openWithVendors.map((c) => levels.get(c.id)!.min!));
  const shortfall = Math.max(0, minNeed - input.total);
  const feasibility: Feasibility = {
    ok: shortfall === 0,
    minNeed,
    shortfall,
    message: shortfall > 0 ? `Ngân sách chưa đủ cho số khách này, cần tối thiểu ${vnd(minNeed)} (thiếu ${vnd(shortfall)}).` : null,
    options: shortfall > 0 ? ['Giảm số khách', `Tăng ngân sách thêm ${vnd(shortfall)}`, 'Đổi sang gói rẻ hơn'] : [],
  };

  // B1. Còn lại sau các khoản đã chọn
  let remaining = input.total - committed;
  const rows = new Map<string, AllocRow>();
  const baseRow = (c: AllocCategory): AllocRow => ({
    categoryId: c.id,
    slug: c.slug,
    name: c.name,
    kind: c.slug === VENUE_SLUG ? 'VENUE' : 'SERVICE',
    status: 'SUGGESTED',
    chosen: [],
    cost: 0,
    weight: null,
    share: null,
    shareLimit: null,
    allocation: null,
    cap: null,
    limit: null,
    suggestion: null,
    minPrice: levels.get(c.id)?.min ?? null,
    medianPrice: levels.get(c.id)?.median ?? null,
    message: null,
  });
  for (const c of input.categories) {
    const row = baseRow(c);
    const chosen = chosenBy.get(c.id);
    if (chosen) {
      row.status = 'CHOSEN';
      row.chosen = chosen;
      row.cost = sum(chosen.map((i) => i.cost));
      if (chosen.some((i) => i.overCapacity)) row.message = 'Không còn phù hợp: vượt sức chứa. Hãy đổi trung tâm tiệc.';
    } else if (input.ownVenue && c.slug === VENUE_SLUG) {
      row.status = 'OWN_VENUE';
      row.cost = ownVenueCost;
      row.message = 'Tự lo tiệc ngoài nền tảng';
    } else if (!levels.get(c.id)?.count) {
      row.status = 'NO_VENDOR';
      row.message =
        c.slug === VENUE_SLUG && c.packages.length ? `Chưa có trung tâm tiệc đủ sức chứa cho ${guests} khách` : `Hiện chưa có NCC cho hạng mục ${c.name}`;
    }
    rows.set(c.id, row);
  }

  // Trọng số trên các dịch vụ chưa chọn (tiệc không nằm trong mức chia)
  const stored = openServices.map((c) => input.customWeights?.[c.slug]).filter(validPct);
  const customFallback = stored.length ? sum(stored) / stored.length : 1;
  const weighted = normalizeWeights(
    openServices.map((c) => ({ c, raw: rawWeight(c.slug, levels.get(c.id)!.median!, input.preset, input.customWeights, customFallback) })),
  );
  for (const w of weighted) rows.get(w.c.id)!.weight = w.weight;

  // B2. Trung tâm tiệc chưa chọn (và không tự lo)
  if (venueOpen) {
    const row = rows.get(venueOpen.id)!;
    const target = remaining - sum(openServices.map((c) => levels.get(c.id)!.median!));
    const cap = remaining - sum(openServices.map((c) => levels.get(c.id)!.min!));
    row.allocation = round(target);
    row.cap = round(cap);
    row.limit = round(Math.max(0, Math.min(target, cap)));
    row.suggestion = pick(candidates(venueOpen, guests, tables), target, cap, input.ward, input.styles);
    row.cost = row.suggestion?.cost ?? 0;
    remaining -= row.cost;
  }

  // B3. Dịch vụ chưa chọn theo trọng số giảm dần; tiền dư tự chuyển sang hạng mục sau
  const order = [...weighted].sort((a, b) => b.weight - a.weight || a.c.slug.localeCompare(b.c.slug));
  for (let i = 0; i < order.length; i++) {
    const { c, weight } = order[i];
    const rest = order.slice(i);
    const later = order.slice(i + 1);
    const allocation = remaining * (weight / (sum(rest.map((r) => r.weight)) || 1));
    const cap = remaining - sum(later.map((r) => levels.get(r.c.id)!.min!));
    const limit = Math.min(allocation, cap);
    const row = rows.get(c.id)!;
    row.allocation = round(allocation);
    row.cap = round(cap);
    row.limit = round(Math.max(0, limit));
    // Không có gói ≤ phần chia: pick lấy gói rẻ nhất ≤ trần cứng ("vượt phân bổ")
    row.suggestion = pick(candidates(c, guests, tables), limit, cap, input.ward, input.styles);
    row.cost = row.suggestion?.cost ?? 0;
    remaining -= row.cost;
  }

  const list = input.categories.map((c) => rows.get(c.id)!);

  // Tỷ lệ và giới hạn riêng của từng dịch vụ chưa cọc (chỉ để hiển thị / làm ngân sách hạng mục, không đổi gói gợi ý ở trên).
  // Dịch vụ đã cọc: giá đã chốt, khóa khỏi phần chia.
  const isDeposited = (r: AllocRow) => r.chosen.some((i) => i.costSource === 'DEPOSITED');
  const services = list.filter((r) => r.kind === 'SERVICE' && r.medianPrice !== null && (r.status === 'CHOSEN' || r.status === 'SUGGESTED') && !isDeposited(r));
  const venueCost = sum(list.filter((r) => r.kind === 'VENUE' && (r.status === 'CHOSEN' || r.status === 'SUGGESTED')).map((r) => r.cost));
  const depositedServices = sum(list.filter((r) => r.kind === 'SERVICE' && isDeposited(r)).map((r) => r.cost));
  // Tiền chia cho các dịch vụ chưa cọc = tổng − tiệc (đã chọn hoặc gợi ý) − dịch vụ đã cọc − cọc mất − tiệc tự lo − chi phí khác
  const sliderPool = Math.max(0, input.total - venueCost - depositedServices - lost - extra - ownVenueCost);
  const savedPct = services.map((r) => input.customWeights?.[r.slug]).filter(validPct);
  const pctFallback = savedPct.length ? sum(savedPct) / savedPct.length : 1;
  const raws = services.map((r) => ({
    r,
    raw:
      input.preset === 'CUSTOM'
        ? (validPct(input.customWeights?.[r.slug]) ? input.customWeights![r.slug] : pctFallback)
        : r.medianPrice! * (PRESET_H[input.preset as Exclude<BudgetPreset, 'CUSTOM'>][r.slug] ?? 1),
  }));
  // Tùy chỉnh, mọi hạng mục đều có tỷ lệ đã lưu và tổng < 100% (khách đặt số tiền tuyệt đối khi chỉ còn ít hạng mục):
  // giữ đúng tỷ lệ đã đặt, phần còn lại không giao cho hạng mục nào. Các trường hợp khác chuẩn hóa về 100%.
  const rawTotal = sum(raws.map((x) => x.raw));
  const absolute = input.preset === 'CUSTOM' && savedPct.length === services.length && rawTotal > 0 && rawTotal < 100;
  const shares = absolute ? raws.map((x) => ({ ...x, weight: x.raw / 100 })) : normalizeWeights(raws);
  for (const x of shares) {
    x.r.share = x.weight;
    x.r.shareLimit = roundThousand(sliderPool * x.weight);
  }
  const suggestedTotal = sum(list.filter((r) => r.status === 'SUGGESTED').map((r) => r.cost));
  // Vượt ngân sách (cảnh báo mềm): rõ khi giá đơn thật đã vượt, nhẹ khi vượt do số dự kiến
  const firm = sum([...chosenBy.values()].flat().filter((i) => i.costSource !== 'PLANNED').map((i) => i.cost)) + lost + extra + ownVenueCost;
  const over = committed - input.total;
  const overBudget = over > 0 ? { level: firm > input.total ? ('strong' as const) : ('soft' as const), amount: round(over), message: `Vượt ngân sách ${vnd(over)}` } : null;

  return {
    tables,
    rows: list,
    committed: round(committed),
    lostDeposits: lost,
    ownVenueCost,
    suggestedTotal: round(suggestedTotal),
    /** Tiền chia cho các dịch vụ chưa cọc (cơ sở đổi số tiền ↔ % ở thanh kéo Tùy chỉnh): giới hạn riêng = sliderPool × share */
    sliderPool: round(sliderPool),
    /** B4. Còn lại sau khi trừ các khoản đã chọn và các gói gợi ý */
    remaining: round(remaining),
    leftover: remaining > 0 ? { amount: round(remaining), message: `Còn dư ${vnd(remaining)}: bạn có thể nâng gói hoặc thêm hạng mục.` } : null,
    feasibility,
    overBudget,
    status: overBudget ? ('OVER_BUDGET' as const) : ('OK' as const),
  };
}

export type AllocResult = ReturnType<typeof allocate>;

/**
 * Hệ quả khi khách chọn một chi phí cho hạng mục (chọn gói ngoài gợi ý): các dịch vụ chưa chọn còn lại tối đa bao nhiêu
 * so với tổng giá rẻ nhất cần. Dùng cho dropdown gói và cảnh báo sau khi chọn.
 */
export function consequenceOf(input: AllocInput, categoryId: string, cost: number) {
  const tables = tableCount(input.guestCount, input.tableOverride ?? null);
  const others = input.planVendors.filter((v) => !v.cancelled && v.categoryId !== categoryId && !(input.ownVenue && v.slug === VENUE_SLUG));
  const chosenOthers = sum(others.map((v) => chosenItem(v, input.guestCount, tables).cost));
  const chosenIds = new Set([...others.map((v) => v.categoryId), categoryId]);
  const openCats = input.categories.filter((c) => !chosenIds.has(c.id) && !(input.ownVenue && c.slug === VENUE_SLUG));
  const mins = openCats.map((c) => priceLevels(c, input.guestCount, tables).min).filter((m): m is number => m !== null);
  const available = round(input.total - chosenOthers - cost - (input.lostDeposits ?? 0) - (input.extraCosts ?? 0) - (input.ownVenue ? Math.max(0, input.ownVenueCost ?? 0) : 0));
  const need = round(sum(mins));
  const shortfall = Math.max(0, need - available);
  return {
    openCount: mins.length,
    available,
    need,
    shortfall,
    message:
      shortfall > 0
        ? mins.length
          ? `Chọn gói này, ${mins.length} dịch vụ còn lại còn tối đa ${vnd(Math.max(0, available))} so với gói rẻ nhất cần ${vnd(need)}, thiếu ${vnd(shortfall)}.`
          : `Chọn gói này sẽ vượt ngân sách ${vnd(shortfall)}.`
        : null,
  };
}

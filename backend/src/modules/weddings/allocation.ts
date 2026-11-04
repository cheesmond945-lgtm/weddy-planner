/**
 * Phân bổ ngân sách và gợi ý gói theo thuật toán (không DB, không Nest, không gọi AI). Unit test: backend/test/allocation.test.cjs.
 * Đặc tả: docs/api/weddings.md mục 7 và tài liệu triển khai "Luồng Tùy chỉnh ngân sách" v1.2 (mục 3, 5).
 * Thuật toán tỷ lệ (chia số nguyên, tự cân bằng, nhóm chia thay đổi): budget-split.ts, bản sao ở frontend.
 *
 * Phân bổ của từng hạng mục là giá trị dẫn xuất: chạy lại hàm này từ đầu mỗi khi đầu vào đổi, không lưu số tiền.
 * Quỹ dịch vụ = tổng − mọi khoản đã chọn − cọc mất − tiệc tự lo − chi phí ngoài − gói tiệc đề xuất (khi tiệc chưa chọn).
 * Nhóm chia = các dịch vụ (không phải tiệc) chưa chọn, có gói hợp lệ, chưa bị khách bỏ khỏi phần chia (chỉ ở mức Tùy chỉnh).
 * Tiền hạng mục trong nhóm = quỹ × tỷ lệ; hạng mục đã chọn / có đơn chưa cọc có giới hạn gợi ý theo tỷ lệ ảo.
 * Ngân sách là ràng buộc mềm: không có gói trong giới hạn thì gợi ý gói rẻ nhất kèm nhãn "Vượt", không chặn.
 */
import { VENUE_SLUG, type BudgetPreset } from './allocation.config';
import { fitsGuests, packageCost, plannedPackage, tableCount, type EnginePackage, type EnginePlanVendor } from './budget-engine';
import {
  initFromMode,
  pickPackage,
  reconcile,
  splitAmounts,
  suggestedLimit,
  TOTAL,
  type BaseMode,
  type GroupMember,
  type SplitPackage,
  type SplitState,
} from './budget-split';
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
  /** Cấu hình Tùy chỉnh đã lưu (tỷ lệ, khóa, bỏ khỏi phần chia, giá trần); chỉ dùng khi preset = CUSTOM */
  split?: SplitState | null;
  ownVenue: boolean;
  ownVenueCost?: number | null;
  /** Chi phí khác ngoài Forever: trừ như khoản đã chọn */
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

export type AllocLabel = { code: 'OVER_BY'; amount: number };

export interface Suggestion {
  package: AllocPackage;
  cost: number;
  chargedTables: number | null;
  label: AllocLabel | null;
}

/** Gói của hạng mục trong nhóm chia, gửi cho client để chọn gói gợi ý ngay khi kéo thanh (cùng hàm pickPackage) */
export interface CandidatePackage extends SplitPackage {
  vendorId: string;
  vendorName: string;
  name: string;
  chargedTables: number | null;
  unit: EnginePackage['unit'];
}

export interface AllocRow {
  categoryId: string;
  slug: string;
  name: string;
  kind: 'VENUE' | 'SERVICE';
  /**
   * CHOSEN đã chọn; SUGGESTED trong nhóm chia / tiệc được đề xuất; NO_VENDOR chưa có gói hợp lệ; OWN_VENUE tự lo tiệc;
   * EXCLUDED khách bỏ khỏi phần chia (Tùy chỉnh): không tỷ lệ, không ngân sách, không gợi ý gói
   */
  status: 'CHOSEN' | 'SUGGESTED' | 'NO_VENDOR' | 'OWN_VENUE' | 'EXCLUDED';
  chosen: ChosenItem[];
  /** Chi phí đang tính cho hạng mục: tổng đã chọn, chi phí tự lo, hoặc chi phí gói gợi ý */
  cost: number;
  /** Tỷ lệ trong nhóm chia, số nguyên theo 0,01% (tổng nhóm = 10000); null nếu ngoài nhóm */
  ratio: number | null;
  /** ratio / 10000 (0..1) */
  share: number | null;
  /**
   * Ngân sách của hạng mục (đồng): trong nhóm = quỹ × tỷ lệ (một hạng mục: min(giá trần, quỹ)); đã chọn / có đơn chưa cọc =
   * giới hạn gợi ý theo tỷ lệ ảo; tiệc chưa chọn = giới hạn chọn gói tiệc. Một số duy nhất cho Ngân sách, Gợi ý cho bạn, So sánh.
   */
  limit: number | null;
  /** Như `limit` (tên cũ, trang Dịch vụ / So sánh đọc trường này) */
  shareLimit: number | null;
  suggestion: Suggestion | null;
  /** Mặt bằng giá của hạng mục (tiệc: theo số bàn và sức chứa của kế hoạch) */
  minPrice: number | null;
  medianPrice: number | null;
  /** Giá gói đắt nhất trong các gói hợp lệ (vạch và cảnh báo trên thanh, mục 5.1) */
  maxPackagePrice: number | null;
  /** Gói hợp lệ của hạng mục trong nhóm chia (client tự chọn gói gợi ý khi tỷ lệ đổi) */
  packages: CandidatePackage[];
  message: string | null;
}

const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const vnd = (n: number) => `${Math.round(n).toLocaleString('vi-VN')}đ`;
/** Mọi số tiền làm tròn tới đồng */
const round = (n: number) => Math.round(n);

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
 * Mặt bằng giá: giá rẻ nhất, trung vị, đắt nhất. Dịch vụ: theo giá gói. Tiệc: theo chi phí gói tiệc của kế hoạch (số bàn, sức chứa),
 * không lọc theo khu vực.
 */
export function priceLevels(c: AllocCategory, guestCount: number, tables: number) {
  const costs = candidates(c, guestCount, tables).map((x) => x.cost);
  return { min: costs.length ? Math.min(...costs) : null, median: median(costs), max: costs.length ? Math.max(...costs) : null, count: costs.length };
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

/** Gói kèm tiêu chí xếp hạng của pickPackage: cùng phường/xã với nơi tổ chức, phong cách trùng */
function toCandidates(c: AllocCategory, guestCount: number, tables: number, ward?: string | null, styles: string[] = []): (CandidatePackage & { p: AllocPackage })[] {
  const want = new Set(styles.map(normalizePlace));
  return candidates(c, guestCount, tables).map(({ p, cost, chargedTables }) => ({
    p,
    id: p.id,
    cost,
    chargedTables,
    unit: p.unit,
    vendorId: p.vendorId,
    vendorName: p.vendorName,
    name: p.name,
    place: ward ? (p.ward && normalizePlace(p.ward) === normalizePlace(ward) ? 0 : 1) : 0,
    rating: p.rating,
    reviewCount: p.reviewCount,
    overlap: p.styles.filter((s) => want.has(normalizePlace(s))).length,
  }));
}

function suggestionOf(pool: ReturnType<typeof toCandidates>, limit: number): Suggestion | null {
  const r = pickPackage(pool, limit);
  return r && { package: r.pkg.p, cost: r.pkg.cost, chargedTables: r.pkg.chargedTables, label: r.over === null ? null : { code: 'OVER_BY', amount: r.over } };
}

export interface Feasibility {
  ok: boolean;
  /** Tối thiểu cần: các khoản đã chọn + giá rẻ nhất của hạng mục chưa chọn */
  minNeed: number;
  shortfall: number;
  message: string | null;
  options: string[];
}

/** Tiệc trong quỹ: CHOSEN đã chọn, OWN tự lo, SUGGESTED gói đề xuất, NO_PACKAGE chưa có gói hợp lệ, NONE không dùng tiệc */
export type VenueFundStatus = 'CHOSEN' | 'OWN' | 'SUGGESTED' | 'NO_PACKAGE' | 'NONE';

export function allocate(input: AllocInput) {
  const tables = tableCount(input.guestCount, input.tableOverride ?? null);
  const guests = input.guestCount;
  const custom = input.preset === 'CUSTOM';

  // Hạng mục đã chọn: NCC trong kế hoạch, trừ NCC có đơn mới nhất đã hủy
  const chosenBy = new Map<string, ChosenItem[]>();
  for (const v of input.planVendors) {
    if (v.cancelled) continue;
    if (input.ownVenue && v.slug === VENUE_SLUG) continue;
    chosenBy.set(v.categoryId, [...(chosenBy.get(v.categoryId) ?? []), chosenItem(v, guests, tables)]);
  }

  const levels = new Map(input.categories.map((c) => [c.id, priceLevels(c, guests, tables)]));
  const ownVenueCost = input.ownVenue ? Math.max(0, input.ownVenueCost ?? 0) : 0;
  const selectedCost = sum([...chosenBy.values()].flat().map((i) => i.cost));
  const venueCat = input.categories.find((c) => c.slug === VENUE_SLUG) ?? null;
  const venueSelectedCost = venueCat ? sum((chosenBy.get(venueCat.id) ?? []).map((i) => i.cost)) : 0;
  const lost = input.lostDeposits ?? 0;
  const extra = input.extraCosts ?? 0;
  const committed = selectedCost + lost + ownVenueCost + extra;
  // Mục 3: tiền cọc nằm trong giá đơn nên không trừ thêm
  const remaining = input.total - committed;

  // Hạng mục chưa chọn, có gói hợp lệ (tiệc: có gói đủ sức chứa)
  const open = input.categories.filter((c) => !chosenBy.has(c.id) && !(input.ownVenue && c.slug === VENUE_SLUG));
  const hasPackages = (c: AllocCategory) => (levels.get(c.id)?.count ?? 0) > 0;
  const openServices = open.filter((c) => c.slug !== VENUE_SLUG && hasPackages(c));
  const venueOpen = open.find((c) => c.slug === VENUE_SLUG) ?? null;
  // Bỏ khỏi phần chia: chỉ ở mức Tùy chỉnh, chỉ hạng mục chưa chọn
  const excluded = new Set(custom ? (input.split?.excluded ?? []).filter((id) => open.some((c) => c.id === id && c.slug !== VENUE_SLUG)) : []);
  const groupCats = openServices.filter((c) => !excluded.has(c.id));
  const members: GroupMember[] = groupCats.map((c) => ({ id: c.id, slug: c.slug, median: levels.get(c.id)!.median! }));

  // B0. Kiểm tra khả thi (chỉ cảnh báo)
  const openForMin = [...groupCats, ...(venueOpen && hasPackages(venueOpen) ? [venueOpen] : [])];
  const minNeed = committed + sum(openForMin.map((c) => levels.get(c.id)!.min!));
  const shortfall = Math.max(0, minNeed - input.total);
  const feasibility: Feasibility = {
    ok: shortfall === 0,
    minNeed,
    shortfall,
    message: shortfall > 0 ? `Ngân sách chưa đủ cho số khách này, cần tối thiểu ${vnd(minNeed)} (thiếu ${vnd(shortfall)}).` : null,
    options: shortfall > 0 ? ['Giảm số khách', `Tăng ngân sách thêm ${vnd(shortfall)}`, 'Đổi sang gói rẻ hơn'] : [],
  };

  const rows = new Map<string, AllocRow>();
  for (const c of input.categories) {
    const lv = levels.get(c.id);
    const row: AllocRow = {
      categoryId: c.id,
      slug: c.slug,
      name: c.name,
      kind: c.slug === VENUE_SLUG ? 'VENUE' : 'SERVICE',
      status: 'SUGGESTED',
      chosen: [],
      cost: 0,
      ratio: null,
      share: null,
      limit: null,
      shareLimit: null,
      suggestion: null,
      minPrice: lv?.min ?? null,
      medianPrice: lv?.median ?? null,
      maxPackagePrice: lv?.max ?? null,
      packages: [],
      message: null,
    };
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
    } else if (!lv?.count) {
      row.status = 'NO_VENDOR';
      row.message = c.slug === VENUE_SLUG ? (c.packages.length ? `Chưa có gói tiệc phù hợp cho ${guests} khách` : 'Chưa có gói tiệc phù hợp') : 'Chưa có gói dịch vụ phù hợp';
    } else if (excluded.has(c.id)) {
      row.status = 'EXCLUDED';
      row.message = 'Đã bỏ khỏi phần chia';
    }
    rows.set(c.id, row);
  }

  // Mục 3. Tiệc chưa chọn, không tự lo: trừ gói tiệc tốt nhất trong giới hạn (giới hạn = còn lại − trung vị các dịch vụ trong nhóm);
  // đều vượt thì gói rẻ nhất kèm "Vượt Y"; không có gói hợp lệ thì chưa trừ tiệc (kèm cảnh báo)
  // Tự lo tiệc tính cả khi kế hoạch không có hạng mục trung tâm tiệc
  let venueStatus: VenueFundStatus = venueCat && chosenBy.has(venueCat.id) ? 'CHOSEN' : input.ownVenue ? 'OWN' : venueCat ? 'NO_PACKAGE' : 'NONE';
  let suggestedVenueCost = 0;
  if (venueOpen && hasPackages(venueOpen)) {
    const row = rows.get(venueOpen.id)!;
    const limit = remaining - sum(members.map((m) => m.median));
    row.limit = row.shareLimit = round(Math.max(0, limit));
    row.suggestion = suggestionOf(toCandidates(venueOpen, guests, tables, input.ward, input.styles), limit);
    row.cost = suggestedVenueCost = row.suggestion?.cost ?? 0;
    venueStatus = 'SUGGESTED';
  }
  const serviceBudgetRaw = remaining - suggestedVenueCost;
  const serviceBudget = Math.max(0, serviceBudgetRaw);

  // Tỷ lệ của nhóm chia: phương án có sẵn khởi tạo lại mỗi lần đọc; Tùy chỉnh dùng cấu hình đã lưu, áp nhóm hiện tại (mục 4.5)
  let state: SplitState | null = null;
  let changed = false;
  let unlocked: string[] = [];
  if (custom) {
    if (input.split) {
      const r = reconcile({ ...input.split, excluded: [...excluded] }, members);
      state = r.state;
      unlocked = r.unlocked;
      // Danh sách bỏ khỏi phần chia đổi (hạng mục đã bỏ vừa được chọn gói) cũng cần lưu lại
      changed = r.changed || excluded.size !== input.split.excluded.length;
    } else {
      // Chưa có cấu hình (dữ liệu cũ): khởi tạo theo Cân bằng và lưu
      state = { baseMode: 'BALANCED', excluded: [], capAmount: null, items: initFromMode(members, 'BALANCED') };
      changed = true;
    }
  }
  const baseMode: BaseMode = state ? state.baseMode : (input.preset as BaseMode);
  const items = state ? state.items : initFromMode(members, baseMode);
  const { amounts, leftover } = splitAmounts(items, serviceBudget, state?.capAmount ?? null);

  for (const it of items) {
    const row = rows.get(it.id)!;
    const amount = amounts[it.id];
    const cat = groupCats.find((c) => c.id === it.id)!;
    const pool = toCandidates(cat, guests, tables, input.ward, input.styles);
    row.ratio = it.ratio;
    row.share = it.ratio / TOTAL;
    row.limit = row.shareLimit = round(amount);
    row.packages = pool.map(({ p: _p, ...x }) => x);
    row.suggestion = suggestionOf(pool, amount);
    row.cost = row.suggestion?.cost ?? 0;
  }

  // Hạng mục đã bỏ khỏi phần chia: vẫn gửi gói để client tính ngay khi khách bấm "Thêm lại"
  for (const c of openServices.filter((c) => excluded.has(c.id))) {
    rows.get(c.id)!.packages = toCandidates(c, guests, tables, input.ward, input.styles).map(({ p: _p, ...x }) => x);
  }

  // Mục 5. Hạng mục đã chọn hoặc có đơn chưa cọc (dịch vụ, không phải tiệc): giới hạn gợi ý theo tỷ lệ ảo; đã cọc thì không có
  for (const row of rows.values()) {
    if (row.status !== 'CHOSEN' || row.kind !== 'SERVICE' || row.medianPrice === null) continue;
    if (row.chosen.some((i) => i.costSource === 'DEPOSITED')) continue;
    row.limit = row.shareLimit = suggestedLimit({ slug: row.slug, median: row.medianPrice }, members, baseMode, serviceBudgetRaw, row.cost);
  }

  const list = input.categories.map((c) => rows.get(c.id)!);
  const suggestedTotal = sum(list.filter((r) => r.status === 'SUGGESTED').map((r) => r.cost));
  // Vượt ngân sách (cảnh báo mềm): rõ khi giá đơn thật đã vượt, nhẹ khi vượt do số dự kiến
  const firm = sum([...chosenBy.values()].flat().filter((i) => i.costSource !== 'PLANNED').map((i) => i.cost)) + lost + extra + ownVenueCost;
  const over = committed - input.total;
  const overBudget = over > 0 ? { level: firm > input.total ? ('strong' as const) : ('soft' as const), amount: round(over), message: `Vượt ngân sách ${vnd(over)}` } : null;
  const venueRow = venueCat ? rows.get(venueCat.id)! : null;

  return {
    tables,
    rows: list,
    committed: round(committed),
    lostDeposits: lost,
    ownVenueCost,
    suggestedTotal: round(suggestedTotal),
    /** Còn lại sau khi trừ các khoản đã chọn và các gói gợi ý */
    remaining: round(input.total - committed - suggestedTotal),
    /** "Còn dư": phần quỹ không phân bổ cho hạng mục nào (nhóm rỗng, hoặc chênh lệch với giá trần) */
    leftover: leftover > 0 ? { amount: round(leftover), message: `Còn dư ${vnd(leftover)}` } : null,
    feasibility,
    overBudget,
    status: overBudget ? ('OVER_BUDGET' as const) : ('OK' as const),
    /** Mục 3: quỹ dịch vụ và chi tiết (ⓘ) */
    fund: {
      totalBudget: input.total,
      selectedCost: round(selectedCost),
      venueSelectedCost: round(venueSelectedCost),
      lostDeposit: lost,
      selfVenueCost: ownVenueCost,
      externalCost: extra,
      remaining: round(remaining),
      venue: {
        status: venueStatus,
        amount:
          venueStatus === 'CHOSEN' ? round(venueSelectedCost) : venueStatus === 'OWN' ? ownVenueCost : venueStatus === 'SUGGESTED' ? suggestedVenueCost : null,
        overBy: venueStatus === 'SUGGESTED' ? (venueRow?.suggestion?.label?.amount ?? null) : null,
      },
      serviceBudgetRaw: round(serviceBudgetRaw),
      serviceBudget: round(serviceBudget),
    },
    /** Nhóm chia: phương án, cấu hình Tùy chỉnh (đã áp nhóm hiện tại) và các hạng mục tự mở khóa */
    split: { mode: input.preset, baseMode, state, changed, unlocked, members },
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
  const open = openCats
    .map((c) => ({ name: c.name, min: priceLevels(c, input.guestCount, tables).min }))
    .filter((x): x is { name: string; min: number } => x.min !== null);
  const mins = open.map((x) => x.min);
  const available = round(input.total - chosenOthers - cost - (input.lostDeposits ?? 0) - (input.extraCosts ?? 0) - (input.ownVenue ? Math.max(0, input.ownVenueCost ?? 0) : 0));
  const need = round(sum(mins));
  const shortfall = Math.max(0, need - available);
  return {
    openCount: mins.length,
    available,
    need,
    shortfall,
    message: shortfall > 0 ? consequenceMessage(open.map((x) => x.name), available, need, shortfall) : null,
  };
}

/**
 * Cảnh báo cho cặp đôi khi chọn gói làm thiếu tiền: chuyện gì xảy ra (vượt bao nhiêu, dịch vụ nào chưa đủ tiền) và nên làm gì.
 * `names`: các hạng mục chưa chọn dịch vụ; `available`: tiền còn lại cho chúng (âm là đã vượt); `need`: tổng gói rẻ nhất của chúng.
 */
function consequenceMessage(names: string[], available: number, need: number, shortfall: number) {
  const fix = 'Hãy chọn gói rẻ hơn hoặc tăng tổng ngân sách.';
  if (!names.length) return `Nếu chọn gói này, kế hoạch sẽ vượt ngân sách ${vnd(shortfall)}. ${fix}`;
  const list = names.map((n) => n.toLowerCase()).join(', ');
  const rest = `${names.length > 1 ? `${names.length} dịch vụ chưa chọn` : 'dịch vụ chưa chọn'} (${list})`;
  if (available <= 0) {
    const over = available < 0 ? `kế hoạch sẽ vượt ngân sách ${vnd(-available)}, ` : 'ngân sách sẽ hết, ';
    return `Nếu chọn gói này, ${over}trong khi ${rest} vẫn cần ít nhất ${vnd(need)}. Tổng cộng bạn thiếu ${vnd(shortfall)}. ${fix}`;
  }
  return `Nếu chọn gói này, chỉ còn ${vnd(available)} cho ${rest}, nhưng gói rẻ nhất cũng cần ${vnd(need)}. Bạn sẽ thiếu ${vnd(shortfall)}. ${fix}`;
}

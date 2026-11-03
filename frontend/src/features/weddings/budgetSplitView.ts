import {
  BASE_MODES,
  initFromMode,
  pickPackage,
  priceMarker,
  splitAmounts,
  suggestedLimit,
  type BaseMode,
  type GroupMember,
  type SplitItem,
  type SplitState,
} from './budgetSplit.ts'
import type { Budget, BudgetCandidatePackage, BudgetCategory, BudgetFund, BudgetSplitConfig } from '@/types/wedding'

/*
 * Số liệu tab Ngân sách tính ở client từ dữ liệu backend + cấu hình Tùy chỉnh đang sửa (hàm thuần, test ở budgetSplitView.test.ts).
 * Dùng cùng thuật toán với backend (budgetSplit.ts) nên kéo thanh là thấy ngay tỷ lệ, tiền, gói gợi ý; sau khi lưu backend trả lại cùng số.
 */

/** Cấu hình đã lưu (API) → trạng thái thuật toán */
export function stateFromConfig(config: BudgetSplitConfig, b: Pick<Budget, 'categories'>): SplitState {
  const slug = (id: string) => b.categories.find((c) => c.categoryId === id)?.slug ?? ''
  return {
    baseMode: config.baseMode,
    excluded: config.excluded,
    capAmount: config.capAmount,
    items: config.items.map((i) => ({ id: i.categoryId, slug: slug(i.categoryId), ratio: i.ratio, locked: i.locked })),
  }
}

/** Trạng thái → body lưu (PUT budget/split) */
export const configBody = (s: SplitState, version: number) => ({
  version,
  baseMode: s.baseMode,
  excluded: s.excluded,
  capAmount: s.capAmount,
  items: s.items.map((i) => ({ categoryId: i.id, ratio: i.ratio, locked: i.locked })),
})

export interface SplitRowView {
  item: SplitItem
  category: BudgetCategory
  /** Tiền của hạng mục (số chính xác) */
  amount: number
  suggestion: { pkg: BudgetCandidatePackage; over: number | null } | null
  /** Vạch giá gói cao nhất (đơn vị 0,01%), cảnh báo và phần không dùng hết */
  marker: number | null
  warn: boolean
  unused: number
}

export interface SplitView {
  custom: boolean
  baseMode: BaseMode
  /** Nhóm chia hiện tại (đã trừ hạng mục bỏ khỏi phần chia) */
  group: GroupMember[]
  rows: SplitRowView[]
  /** Hạng mục đã bỏ khỏi phần chia (chỉ Tùy chỉnh) */
  excluded: BudgetCategory[]
  leftover: number
  capAmount: number | null
  /**
   * Dự kiến chi tối đa của nhóm chia: mỗi hạng mục tiêu tối đa min(tiền phân bổ, giá gói cao nhất).
   * Phần còn lại của quỹ (gồm "Còn dư" và phần không dùng hết) là `unspent`.
   */
  spendMax: number
  unspent: number
  /**
   * Quỹ dư so với khả năng chi: tổng giá gói cao nhất của cả nhóm nhỏ hơn quỹ. Khi đó kéo thanh không đổi được gói nào
   * cho mọi hạng mục cùng lúc; tab Ngân sách hiện một khung chung thay vì cảnh báo từng dòng.
   */
  surplus: boolean
  /** Giới hạn gợi ý của hạng mục đã chọn / có đơn chưa cọc, theo categoryId */
  limits: Record<string, number>
}

/** Đã cọc: chỉ hiện giá trị đơn, không giới hạn gợi ý */
export const isDeposited = (c: BudgetCategory) => c.vendors.some((v) => v.costSource === 'DEPOSITED')

/**
 * Tính bảng chia: phương án có sẵn khởi tạo lại từ trung vị × h; Tùy chỉnh dùng `state` (bản đang sửa).
 * Hạng mục đã chọn chưa cọc nhận giới hạn gợi ý theo tỷ lệ ảo trên nhóm hiện tại.
 * `surplus` (quỹ đủ cho gói đắt nhất của mọi dịch vụ, xem presetsLocked): Tùy chỉnh tạm không áp dụng, tính như phương án nền
 * nhưng vẫn giữ các hạng mục khách đã chọn Tự lo. Chỉ là hiển thị, cấu hình đã lưu giữ nguyên.
 */
export function splitView(b: Budget, state: SplitState | null, surplus = false): SplitView {
  const saved = b.preset === 'CUSTOM' && !!state
  const custom = saved && !surplus
  const excludedIds = saved ? state!.excluded : []
  const group: GroupMember[] = b.split.eligible
    .filter((e) => !excludedIds.includes(e.categoryId))
    .map((e) => ({ id: e.categoryId, slug: e.slug, median: e.median }))
  const baseMode: BaseMode = saved ? state!.baseMode : b.split.baseMode
  const items = custom ? state!.items : initFromMode(group, baseMode)
  const capAmount = custom ? state!.capAmount : null
  const sb = b.fund.serviceBudget
  const { amounts, leftover } = splitAmounts(items, sb, capAmount)
  const byId = new Map(b.categories.map((c) => [c.categoryId, c]))
  const rows = items.flatMap((item) => {
    const category = byId.get(item.id)
    if (!category) return []
    const amount = amounts[item.id] ?? 0
    return [{ item, category, amount, suggestion: pickPackage(category.packages, amount), ...priceMarker(amount, category.maxPackagePrice, sb) }]
  })
  const limits: Record<string, number> = {}
  for (const c of b.categories) {
    if (c.kind !== 'SERVICE' || c.status !== 'CHOSEN' || c.medianPrice === null || isDeposited(c)) continue
    limits[c.categoryId] = suggestedLimit({ slug: c.slug, median: c.medianPrice }, group, baseMode, b.fund.serviceBudgetRaw, c.cost)
  }
  const spendMax = rows.reduce((t, r) => t + Math.min(r.amount, r.category.maxPackagePrice ?? r.amount), 0)
  const capacity = rows.reduce((t, r) => t + (r.category.maxPackagePrice ?? Infinity), 0)
  return {
    custom,
    baseMode,
    spendMax,
    unspent: Math.max(0, sb - spendMax),
    surplus: sb > 0 && rows.length > 0 && capacity < sb,
    group,
    rows,
    excluded: excludedIds.flatMap((id) => byId.get(id) ?? []),
    leftover,
    capAmount,
    limits,
  }
}

/** Biên khi bật khóa: tiền phải dư ít nhất 5% so với giá gói đắt nhất (tắt khi không còn đủ) để quỹ dao động quanh ngưỡng không làm giao diện nhảy */
export const PRESET_LOCK_MARGIN = 1.05

/**
 * Ba mức chia có sẵn có còn ảnh hưởng gợi ý không. Không còn (trả true, khóa ba thẻ) khi ở CẢ 3 mức, MỌI dịch vụ trong nhóm
 * (chưa trừ hạng mục bỏ khỏi phần chia, vì mức có sẵn không bỏ) đều được chia ≥ giá gói đắt nhất của nó: quỹ × ratio_i(mức) ≥ max_i.
 * Chống nhấp nháy: đang mở thì cần dư PRESET_LOCK_MARGIN mới khóa; đang khóa thì chỉ mở khi không còn đủ (biên 1).
 * Chỉ là hiển thị, không đổi cấu hình đã lưu.
 */
export function presetsLocked(b: Budget, wasLocked: boolean) {
  const sb = b.fund.serviceBudget
  const group: GroupMember[] = b.split.eligible.map((e) => ({ id: e.categoryId, slug: e.slug, median: e.median }))
  if (!(sb > 0) || !group.length) return false
  const margin = wasLocked ? 1 : PRESET_LOCK_MARGIN
  const maxOf = new Map(b.categories.map((c) => [c.categoryId, c.maxPackagePrice]))
  return BASE_MODES.every((mode) => {
    const items = initFromMode(group, mode)
    const { amounts } = splitAmounts(items, sb, null)
    return items.every((it) => {
      const max = maxOf.get(it.id)
      return max != null && amounts[it.id] >= max * margin
    })
  })
}

/** Ảnh chụp các đầu vào của quỹ để biết vì sao quỹ đổi khi khách không chạm vào thanh */
export interface FundSnapshot {
  fund: BudgetFund
  tables: number
  guestCount: number
}

export const fundSnapshot = (b: Budget): FundSnapshot => ({ fund: b.fund, tables: b.tables.count, guestCount: b.guestCount })

/**
 * Lý do quỹ dịch vụ đổi (mục 3, "Quỹ dịch vụ vừa thay đổi vì {lý do}"): so các đầu vào giữa hai lần đọc.
 * Quỹ không đổi hoặc không rõ lý do (ví dụ do chính thao tác chia) thì trả null.
 */
export function fundChangeReason(prev: FundSnapshot, next: FundSnapshot): string | null {
  if (prev.fund.serviceBudgetRaw === next.fund.serviceBudgetRaw) return null
  const a = prev.fund
  const z = next.fund
  const reasons: string[] = []
  if (prev.tables !== next.tables || prev.guestCount !== next.guestCount) reasons.push('số bàn hoặc số khách')
  if (a.venueSelectedCost !== z.venueSelectedCost) reasons.push('gói tiệc đã chọn')
  else if (a.venue.status === 'SUGGESTED' && z.venue.status === 'SUGGESTED' && a.venue.amount !== z.venue.amount) reasons.push('gói tiệc đề xuất đổi')
  if (a.selectedCost - a.venueSelectedCost !== z.selectedCost - z.venueSelectedCost || a.lostDeposit !== z.lostDeposit)
    reasons.push('gói hoặc đơn dịch vụ đã chọn')
  if (a.selfVenueCost !== z.selfVenueCost) reasons.push('chi phí tiệc tự lo')
  if (a.externalCost !== z.externalCost) reasons.push('chi phí ngoài nền tảng')
  if (a.totalBudget !== z.totalBudget) reasons.push('tổng ngân sách')
  return reasons.length ? `Quỹ dịch vụ vừa thay đổi vì ${reasons.join(', ')}.` : null
}

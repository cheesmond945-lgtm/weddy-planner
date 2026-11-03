/*
 * Luồng Tùy chỉnh ngân sách (tài liệu triển khai v1.2, mục 3–5): tỷ lệ là số nguyên theo 0,01% (TOTAL = 10000),
 * tự cân bằng, khóa, nhóm chia thay đổi, giới hạn gợi ý (tỷ lệ ảo), cảnh báo giá gói cao nhất. Hàm thuần, không gọi AI.
 * Phép chia tỷ lệ dùng BigInt, không dùng số thực, để client và backend ra cùng kết quả từng đơn vị.
 *
 * HAI BẢN GIỐNG NHAU: frontend/src/features/weddings/budgetSplit.ts và backend/src/modules/weddings/budget-split.ts.
 * Sửa bản này thì sửa bản kia; budgetSplit.test.ts chạy cùng bộ test (mục 8) trên cả hai bản.
 * File không import gì để Node chạy thẳng được (test) ở cả hai phía.
 */

export const TOTAL = 10000
/** Mức làm tròn mọi số tiền hiển thị ở tab Ngân sách */
export const DISPLAY_ROUND_UNIT = 10000

/** Thứ tự cố định khi xếp hòa: Trang trí, Chụp ảnh, Trang phục, Trang điểm, Hoa cưới (slug theo category-kind) */
export const SPLIT_ORDER = ['decor', 'chup-anh', 'trang-phuc', 'makeup', 'hoa-cuoi']

export type BaseMode = 'BALANCED' | 'SPACE' | 'VISUAL'
export const BASE_MODES: BaseMode[] = ['BALANCED', 'SPACE', 'VISUAL']

/** Hệ số h nhân 10 (để tính bằng số nguyên); slug không có trong bảng thì h = 1 (10) */
export const H10: Record<BaseMode, Record<string, number>> = {
  BALANCED: {},
  SPACE: { decor: 13 },
  VISUAL: { 'chup-anh': 15, 'trang-phuc': 13, makeup: 12 },
}

/** Một hạng mục trong nhóm chia (cấu hình lưu): id là categoryId */
export interface SplitItem {
  id: string
  slug: string
  ratio: number
  locked: boolean
}

export interface SplitState {
  baseMode: BaseMode
  /** categoryId các hạng mục khách bỏ khỏi phần chia */
  excluded: string[]
  /** Giá trần (đồng), chỉ có nghĩa khi nhóm có đúng một hạng mục */
  capAmount: number | null
  items: SplitItem[]
}

/** Hạng mục của nhóm chia kèm giá trung vị (để tính trọng số) */
export interface GroupMember {
  id: string
  slug: string
  median: number
}

const rank = (slug: string) => {
  const i = SPLIT_ORDER.indexOf(slug)
  return i < 0 ? SPLIT_ORDER.length : i
}

/** So sánh theo thứ tự cố định (slug lạ xếp sau, rồi theo id) */
export const byOrder = (a: { id: string; slug: string }, b: { id: string; slug: string }) =>
  rank(a.slug) - rank(b.slug) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

const sorted = <T extends { id: string; slug: string }>(xs: T[]) => [...xs].sort(byOrder)
const big = (n: number | bigint) => (typeof n === 'bigint' ? n : BigInt(Math.round(n)))
const sumRatio = (items: SplitItem[]) => items.reduce((s, c) => s + c.ratio, 0)

/** Trọng số của hạng mục theo phương án: giá trung vị × h × 10 (số nguyên) */
export const weightOf = (m: { slug: string; median: number }, mode: BaseMode) => big(Math.max(0, m.median)) * BigInt(H10[mode][m.slug] ?? 10)

/**
 * 4.1. Chia số nguyên `total` theo trọng số (≥ 0): làm tròn xuống từng phần, phần thiếu cộng 1 đơn vị cho phần có phần lẻ
 * lớn nhất (hòa thì theo thứ tự cố định). Tổng trọng số bằng 0 thì chia đều. Kết quả cộng lại đúng bằng `total`.
 */
export function distribute(total: number, entries: { id: string; slug: string; weight: number | bigint }[]): Record<string, number> {
  if (!entries.length) return {}
  let ws = entries.map((e) => big(e.weight))
  let sumW = ws.reduce((s, w) => s + w, BigInt(0))
  if (sumW === BigInt(0)) {
    ws = entries.map(() => BigInt(1))
    sumW = BigInt(entries.length)
  }
  const T = BigInt(total)
  const parts = entries.map((e, i) => ({ e, q: (T * ws[i]) / sumW, r: (T * ws[i]) % sumW }))
  let left = T - parts.reduce((s, p) => s + p.q, BigInt(0))
  const order = [...parts].sort((a, b) => (a.r > b.r ? -1 : a.r < b.r ? 1 : byOrder(a.e, b.e)))
  for (const p of order) {
    if (left <= BigInt(0)) break
    p.q += BigInt(1)
    left -= BigInt(1)
  }
  return Object.fromEntries(parts.map((p) => [p.e.id, Number(p.q)]))
}

/** 4.2. Khởi tạo tỷ lệ từ phương án: trọng số = trung vị × h; mọi hạng mục mở khóa. Một hạng mục thì 100%. */
export function initFromMode(group: GroupMember[], mode: BaseMode): SplitItem[] {
  const g = sorted(group)
  if (g.length <= 1) return g.map((m) => ({ id: m.id, slug: m.slug, ratio: TOTAL, locked: false }))
  const shares = distribute(
    TOTAL,
    g.map((m) => ({ id: m.id, slug: m.slug, weight: weightOf(m, mode) })),
  )
  return g.map((m) => ({ id: m.id, slug: m.slug, ratio: shares[m.id], locked: false }))
}

/**
 * 4.3. Khách đặt hạng mục `id` (mở khóa) thành `wanted`: kẹp về [0, 10000 − L], các hạng mục mở khóa khác chia phần còn lại
 * theo tương quan hiện tại. `clamped`: giá trị bị kéo về mức tối đa `max` (hiện thông báo).
 * Không còn hạng mục nào để hấp thụ thì hạng mục này luôn bằng 10000 − L.
 */
export function rebalance(items: SplitItem[], id: string, wanted: number) {
  const k = items.find((c) => c.id === id)
  const L = sumRatio(items.filter((c) => c.locked && c.id !== id))
  const max = TOTAL - L
  if (!k || k.locked) return { items, clamped: false, max }
  const F = items.filter((c) => c.id !== id && !c.locked)
  if (!F.length) return { items: items.map((c) => (c.id === id ? { ...c, ratio: max } : c)), clamped: false, max }
  const w = Math.trunc(Number.isFinite(wanted) ? wanted : 0)
  const p = Math.min(Math.max(w, 0), max)
  const shares = distribute(
    TOTAL - L - p,
    F.map((c) => ({ id: c.id, slug: c.slug, weight: c.ratio })),
  )
  return {
    items: items.map((c) => (c.id === id ? { ...c, ratio: p } : c.id in shares ? { ...c, ratio: shares[c.id] } : c)),
    clamped: w > max,
    max,
  }
}

export type LockError = 'SINGLE' | 'LAST_UNLOCKED'

/**
 * 4.4. Khóa / mở khóa. Không khóa được khi nhóm chỉ có một hạng mục, hoặc đây là hạng mục mở khóa cuối cùng.
 * Khóa hạng mục đang 0% thì cho phép, kèm `zero` để nhắc (lối tắt "Bỏ khỏi phần chia").
 */
export function setLock(items: SplitItem[], id: string, value: boolean): { items: SplitItem[]; error: LockError | null; zero: boolean } {
  const k = items.find((c) => c.id === id)
  if (!k) return { items, error: null, zero: false }
  if (value) {
    if (items.length === 1) return { items, error: 'SINGLE', zero: false }
    if (!k.locked && items.filter((c) => !c.locked).length === 1) return { items, error: 'LAST_UNLOCKED', zero: false }
  }
  return { items: items.map((c) => (c.id === id ? { ...c, locked: value } : c)), error: null, zero: value && k.ratio === 0 }
}

/** Hạng mục được mở khóa khi mọi hạng mục còn lại đều khóa: tỷ lệ lớn nhất, hòa thì theo thứ tự cố định (cờ hành vi, mục 9) */
export function pickToUnlock(items: SplitItem[]) {
  return sorted(items).reduce((best, c) => (c.ratio > best.ratio ? c : best))
}

/** 4.5. Hạng mục rời nhóm (chọn gói, có đơn, đặt cọc, bỏ khỏi phần chia). `unlocked`: id hạng mục hệ thống tự mở khóa. */
export function onRemove(items: SplitItem[], id: string): { items: SplitItem[]; unlocked: string | null } {
  let rest = items.filter((c) => c.id !== id)
  if (rest.length === items.length) return { items, unlocked: null }
  if (!rest.length) return { items: [], unlocked: null }
  if (rest.length === 1) return { items: [{ ...rest[0], ratio: TOTAL, locked: false }], unlocked: null }
  let unlocked: string | null = null
  if (rest.every((c) => c.locked)) {
    unlocked = pickToUnlock(rest).id
    rest = rest.map((c) => (c.id === unlocked ? { ...c, locked: false } : c))
  }
  const L = sumRatio(rest.filter((c) => c.locked))
  const shares = distribute(
    TOTAL - L,
    rest.filter((c) => !c.locked).map((c) => ({ id: c.id, slug: c.slug, weight: c.ratio })),
  )
  return { items: rest.map((c) => (c.id in shares ? { ...c, ratio: shares[c.id] } : c)), unlocked }
}

/**
 * 4.5. Hạng mục `member` quay lại nhóm (hủy đơn, bỏ chọn, thêm lại): vào ở trạng thái mở khóa với tỷ lệ khởi đầu
 * theo trọng số phương án nền trên cả nhóm (gồm nó), các hạng mục mở khóa khác thu nhỏ như rebalance.
 * `medianOf`: giá trung vị của các hạng mục đang trong nhóm.
 */
export function onAdd(items: SplitItem[], member: GroupMember, medianOf: (id: string) => number, mode: BaseMode): SplitItem[] {
  if (items.some((c) => c.id === member.id)) return items
  const next = sorted([...items, { id: member.id, slug: member.slug, ratio: 0, locked: false }])
  if (next.length === 1) return [{ ...next[0], ratio: TOTAL }]
  const ws = next.map((c) => weightOf({ slug: c.slug, median: c.id === member.id ? member.median : medianOf(c.id) }, mode))
  const sumW = ws.reduce((s, w) => s + w, BigInt(0))
  const wk = ws[next.findIndex((c) => c.id === member.id)]
  const start = sumW === BigInt(0) ? Math.floor(TOTAL / next.length) : Number((BigInt(TOTAL) * wk) / sumW)
  return rebalance(next, member.id, start).items
}

/** Bất biến: tổng 10000, mỗi tỷ lệ là số nguyên 0..10000, nhóm từ 2 hạng mục còn ít nhất một hạng mục mở khóa */
export function isValidSplit(items: SplitItem[]) {
  if (!items.length) return true
  if (items.some((c) => !Number.isInteger(c.ratio) || c.ratio < 0 || c.ratio > TOTAL)) return false
  if (sumRatio(items) !== TOTAL) return false
  return items.length === 1 || items.some((c) => !c.locked)
}

/**
 * Áp nhóm chia hiện tại vào cấu hình đã lưu: xử lý các hạng mục rời nhóm trước (thứ tự cố định), rồi các hạng mục quay lại.
 * Có thay đổi thì capAmount = null. `unlocked`: các hạng mục hệ thống tự mở khóa (để báo khách).
 */
export function reconcile(state: SplitState, group: GroupMember[]): { state: SplitState; unlocked: string[]; changed: boolean } {
  const ids = new Set(group.map((m) => m.id))
  const median = new Map(group.map((m) => [m.id, m.median]))
  let items = sorted(state.items.filter((c, i, xs) => xs.findIndex((x) => x.id === c.id) === i))
  let changed = items.length !== state.items.length
  const unlocked: string[] = []
  for (const c of sorted(items.filter((c) => !ids.has(c.id)))) {
    const r = onRemove(items, c.id)
    items = r.items
    if (r.unlocked) unlocked.push(r.unlocked)
    changed = true
  }
  for (const m of sorted(group.filter((m) => !items.some((c) => c.id === m.id)))) {
    items = onAdd(items, m, (id) => median.get(id) ?? 0, state.baseMode)
    changed = true
  }
  // Dữ liệu đã lưu sai bất biến (sửa tay / phiên bản cũ): khởi tạo lại theo phương án nền
  if (!isValidSplit(items)) {
    items = initFromMode(group, state.baseMode)
    changed = true
  }
  return { state: changed ? { ...state, items, capAmount: null } : state, unlocked, changed }
}

/** Bỏ hạng mục khỏi phần chia (khách bấm "Bỏ khỏi phần chia") */
export function excludeCategory(state: SplitState, id: string) {
  const r = onRemove(state.items, id)
  return { state: { ...state, excluded: [...new Set([...state.excluded, id])], capAmount: null, items: r.items }, unlocked: r.unlocked }
}

/** Thêm lại hạng mục đã bỏ ("Thêm lại"); `group` là nhóm sau khi thêm (gồm hạng mục này) để lấy giá trung vị */
export function includeCategory(state: SplitState, member: GroupMember, group: GroupMember[]): SplitState {
  const median = new Map(group.map((m) => [m.id, m.median]))
  return {
    ...state,
    excluded: state.excluded.filter((x) => x !== member.id),
    capAmount: null,
    items: onAdd(state.items, member, (id) => median.get(id) ?? 0, state.baseMode),
  }
}

/** "Đặt lại theo phương án nền": khởi tạo lại tỷ lệ, mở khóa tất cả, xóa giá trần, giữ danh sách đã bỏ */
export const resetToBase = (state: SplitState, group: GroupMember[]): SplitState => ({ ...state, capAmount: null, items: initFromMode(group, state.baseMode) })

/**
 * "Chuyển phần thừa sang dịch vụ khác" (chỉ ở client, thay cho nút từng dòng): hạng mục mở khóa đang vượt vạch giá gói cao nhất
 * về đúng vạch, phần thừa chia cho các hạng mục mở khóa còn dưới vạch theo tương quan hiện tại. Lặp vì nhận thêm có thể làm
 * hạng mục khác vượt; hết chỗ nhận thì phần thừa ở lại (thành "Còn dư" khi hiển thị). Tổng tỷ lệ giữ nguyên.
 * `markers`: vạch theo id (null: không giới hạn).
 */
export function trimToMax(items: SplitItem[], markers: Record<string, number | null>): SplitItem[] {
  let cur = items
  for (let n = 0; n < items.length; n++) {
    const cap = (c: SplitItem) => markers[c.id] ?? null
    const over = cur.filter((c) => !c.locked && cap(c) !== null && c.ratio > cap(c)!)
    const room = cur.filter((c) => !c.locked && (cap(c) === null || c.ratio < cap(c)!))
    if (!over.length || !room.length) break
    const freed = sumRatio(over.map((c) => ({ ...c, ratio: c.ratio - cap(c)! })))
    const allZero = room.every((c) => c.ratio === 0)
    const shares = distribute(
      freed,
      room.map((c) => ({ id: c.id, slug: c.slug, weight: allZero ? 1 : c.ratio })),
    )
    cur = cur.map((c) => (over.includes(c) ? { ...c, ratio: cap(c)! } : c.id in shares ? { ...c, ratio: c.ratio + shares[c.id] } : c))
  }
  return cur
}

/**
 * Mục 3. Tiền của các hạng mục trong nhóm (số chính xác, chưa làm tròn) và "Còn dư".
 * Từ 2 hạng mục: quỹ × tỷ lệ; một hạng mục: min(giá trần, quỹ); nhóm rỗng: cả quỹ là "Còn dư".
 */
export function splitAmounts(items: SplitItem[], serviceBudget: number, capAmount: number | null) {
  const sb = Math.max(0, serviceBudget)
  if (!items.length) return { amounts: {} as Record<string, number>, leftover: sb }
  if (items.length === 1) {
    const b = capAmount === null ? sb : Math.min(Math.max(0, capAmount), sb)
    return { amounts: { [items[0].id]: b } as Record<string, number>, leftover: sb - b }
  }
  return { amounts: Object.fromEntries(items.map((c) => [c.id, (sb * c.ratio) / TOTAL])) as Record<string, number>, leftover: 0 }
}

/** Số tiền khách nhập → tỷ lệ mong muốn: floor(số tiền × 10000 / quỹ). Quỹ ≤ 0 thì không quy đổi được. */
export const ratioFromAmount = (amount: number, serviceBudget: number) => (serviceBudget > 0 ? Math.floor((Math.max(0, amount) * TOTAL) / serviceBudget) : null)

/** Hiển thị tiền: làm tròn gần nhất tới DISPLAY_ROUND_UNIT (5.000đ làm tròn lên). Không dùng số này để tính tiếp. */
export const displayMoney = (x: number) => Math.floor(x / DISPLAY_ROUND_UNIT + 0.5) * DISPLAY_ROUND_UNIT

/** Tỷ lệ hiển thị "30,00" (2 chữ số thập phân lấy thẳng từ số nguyên) */
export const ratioText = (ratio: number) => `${Math.floor(ratio / 100)},${String(ratio % 100).padStart(2, '0')}`

/**
 * 5.1. Vạch giá gói cao nhất và cảnh báo (chỉ báo, không chặn, không đổi tỷ lệ). Quỹ ≤ 0 thì không vạch, không cảnh báo.
 * `marker`: tỷ lệ tương ứng giá gói cao nhất (đơn vị 0,01%); chỉ vẽ khi < 10000. `unused`: phần tiền không dùng hết.
 */
export function priceMarker(amount: number, maxPackagePrice: number | null, serviceBudget: number) {
  if (!(serviceBudget > 0) || maxPackagePrice === null) return { marker: null, warn: false, unused: 0 }
  const marker = Math.floor((maxPackagePrice * TOTAL) / serviceBudget)
  const warn = amount > maxPackagePrice
  return { marker, warn, unused: warn ? amount - maxPackagePrice : 0 }
}

/**
 * Mục 5. Giới hạn gợi ý của hạng mục đã chọn / có đơn chưa cọc (nằm ngoài nhóm): tỷ lệ ảo = w_i / (Σ w nhóm + w_i);
 * giới hạn = max(0, quỹ chưa chặn + giá đang chọn của i) × tỷ lệ ảo. Nhóm rỗng: tỷ lệ ảo = 1. Làm tròn tới đồng.
 */
export function suggestedLimit(item: { slug: string; median: number }, group: GroupMember[], mode: BaseMode, serviceBudgetRaw: number, chosenCost: number) {
  const pool = big(Math.max(0, serviceBudgetRaw + chosenCost))
  if (!group.length) return Number(pool)
  const w = weightOf(item, mode)
  const den = group.reduce((s, m) => s + weightOf(m, mode), BigInt(0)) + w
  if (den === BigInt(0)) return 0
  return Number((pool * w * BigInt(2) + den) / (BigInt(2) * den))
}

/** Gói để chọn gợi ý: chi phí theo kế hoạch và các tiêu chí xếp hạng (đã tính sẵn ở backend) */
export interface SplitPackage {
  id: string
  cost: number
  /** 0 = cùng phường/xã với nơi tổ chức (hoặc chưa có nơi tổ chức), 1 = khác */
  place: number
  rating: number | null
  reviewCount: number
  /** Số phong cách trùng với đám cưới */
  overlap: number
}

/**
 * Gói gợi ý: có gói trong giới hạn thì chọn gói tốt nhất (cùng khu vực trước, chi phí gần giới hạn, đánh giá, lượt đánh giá,
 * phong cách trùng); không có thì gói rẻ nhất kèm số "Vượt"; không có gói thì null.
 */
export function pickPackage<T extends SplitPackage>(packages: T[], limit: number): { pkg: T; over: number | null } | null {
  if (!packages.length) return null
  const within = packages.filter((p) => p.cost <= limit)
  if (within.length) {
    const best = [...within].sort(
      (a, b) =>
        a.place - b.place ||
        limit - a.cost - (limit - b.cost) ||
        (b.rating ?? -1) - (a.rating ?? -1) ||
        b.reviewCount - a.reviewCount ||
        b.overlap - a.overlap ||
        a.cost - b.cost ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    )[0]
    return { pkg: best, over: null }
  }
  const cheapest = [...packages].sort((a, b) => a.cost - b.cost || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0]
  return { pkg: cheapest, over: Math.round(cheapest.cost - Math.max(0, limit)) }
}

export type PercentInput = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ok'; ratio: number; negative: boolean }

/** Ô nhập %: tối đa 2 chữ số thập phân (thừa thì cắt bỏ), số âm đưa về 0 (kèm cờ để báo), trống giữ giá trị cũ, chữ là lỗi */
export function parsePercent(text: string): PercentInput {
  const s = text.trim().replace(',', '.')
  if (!s) return { kind: 'empty' }
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(s)
  if (!m || (!m[2] && !m[3])) return { kind: 'invalid' }
  if (m[1]) return { kind: 'ok', ratio: 0, negative: true }
  const ratio = Number(m[2] || '0') * 100 + Number(((m[3] ?? '') + '00').slice(0, 2))
  return { kind: 'ok', ratio, negative: false }
}

/*
 * Unit test cho budgetSplitView.ts (bảng chia tính ở client, lý do quỹ đổi). Chạy: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { displayMoney } from './budgetSplit.ts'
import { configBody, fundChangeReason, presetPicks, presetsLocked, presetsSame, splitView, stateFromConfig, type FundSnapshot } from './budgetSplitView.ts'
import type { Budget, BudgetCategory, BudgetFund } from '@/types/wedding'

const M = 1_000_000

const fund = (over: Partial<BudgetFund> = {}): BudgetFund => ({
  totalBudget: 350 * M,
  selectedCost: 40 * M,
  venueSelectedCost: 0,
  lostDeposit: 0,
  selfVenueCost: 0,
  externalCost: 2 * M,
  remaining: 308 * M,
  venue: { status: 'SUGGESTED', amount: 150 * M, overBy: null },
  serviceBudgetRaw: 158 * M,
  serviceBudget: 158 * M,
  ...over,
})
const snap = (over: Partial<BudgetFund> = {}, tables = 30): FundSnapshot => ({ fund: fund(over), tables, guestCount: tables * 10 })

describe('fundChangeReason (mục 3, T54, T61)', () => {
  it('T54 tăng chi phí ngoài nền tảng', () => {
    assert.equal(fundChangeReason(snap(), snap({ externalCost: 12 * M, serviceBudgetRaw: 148 * M })), 'Quỹ chưa phân bổ vừa thay đổi vì chi phí ngoài nền tảng.')
  })
  it('T61 gói tiệc đề xuất đổi cùng chi phí ngoài nền tảng', () => {
    const r = fundChangeReason(snap(), snap({ externalCost: 32 * M, venue: { status: 'SUGGESTED', amount: 120 * M, overBy: null }, serviceBudgetRaw: 156 * M }))
    assert.equal(r, 'Quỹ chưa phân bổ vừa thay đổi vì gói tiệc đề xuất đổi, chi phí ngoài nền tảng.')
  })
  it('đổi số bàn, chọn thêm gói dịch vụ', () => {
    assert.match(fundChangeReason(snap(), snap({ serviceBudgetRaw: 100 * M }, 35))!, /số bàn hoặc số khách/)
    assert.match(fundChangeReason(snap(), snap({ selectedCost: 50 * M, serviceBudgetRaw: 148 * M }))!, /gói hoặc đơn dịch vụ đã chọn/)
  })
  it('quỹ không đổi, hoặc đổi vì chính thao tác chia: không báo', () => {
    assert.equal(fundChangeReason(snap(), snap({ externalCost: 5 * M })), null)
    assert.equal(fundChangeReason(snap(), snap({ serviceBudgetRaw: 150 * M })), null)
  })
})

const category = (id: string, slug: string, over: Partial<BudgetCategory> = {}): BudgetCategory => ({
  categoryId: id,
  slug,
  name: id,
  kind: 'SERVICE',
  status: 'SUGGESTED',
  cost: 0,
  ratio: null,
  limit: null,
  minPrice: null,
  medianPrice: 10 * M,
  maxPackagePrice: 6 * M,
  message: null,
  suggestion: null,
  packages: [2, 4, 6].map((tr) => ({ id: `${id}-${tr}`, cost: tr * M, place: 0, rating: null, reviewCount: 0, overlap: 0, vendorId: 'v', vendorName: 'NCC', name: `${tr}tr`, chargedTables: null, unit: 'PACKAGE' })),
  vendors: [],
  ...over,
})

const budget = (preset: Budget['preset']): Budget =>
  ({
    preset,
    fund: fund({ serviceBudget: 20 * M, serviceBudgetRaw: 20 * M }),
    split: {
      mode: preset,
      baseMode: 'BALANCED',
      config: null,
      eligible: [
        { categoryId: 'TT', slug: 'decor', median: 10 * M },
        { categoryId: 'HC', slug: 'hoa-cuoi', median: 10 * M },
      ],
      notices: [],
    },
    categories: [category('TT', 'decor'), category('HC', 'hoa-cuoi'), category('CA', 'chup-anh', { status: 'CHOSEN', cost: 8 * M })],
  }) as unknown as Budget

describe('splitView', () => {
  it('phương án có sẵn: chia theo trung vị, cắt về giá gói cao nhất, gói gợi ý trong giới hạn, giới hạn gợi ý cho hạng mục đã chọn', () => {
    const v = splitView(budget('BALANCED'), null)
    // 50/50 của 20tr = 10tr mỗi bên > gói cao nhất 6tr: cả hai về vạch 30%, 40% còn lại là Dự phòng (8tr)
    assert.deepEqual(v.rows.map((r) => [r.item.id, r.item.ratio, r.amount, r.suggestion?.pkg.cost]), [
      ['TT', 3000, 6 * M, 6 * M],
      ['HC', 3000, 6 * M, 6 * M],
    ])
    assert.equal(v.leftover, 8 * M)
    // Tỷ lệ ảo 1/3, pool = 20 + 8 = 28tr
    assert.equal(v.limits.CA, 9_333_333)
    assert.deepEqual([v.rows[0].warn, v.rows[0].marker], [false, 3000])
    // Gói đắt nhất 6tr × 2 = 12tr < quỹ 20tr: quỹ dư, dự kiến chi tối đa 12tr, còn dư 8tr
    assert.deepEqual([v.surplus, v.spendMax, v.unspent], [true, 12 * M, 8 * M])
  })
  it('phương án có sẵn, quỹ không đủ mọi gói cao nhất: phần vượt sang hạng mục còn thiếu, dùng hết quỹ', () => {
    const b = budget('BALANCED')
    const cats = [category('TT', 'decor', { maxPackagePrice: 4 * M }), category('HC', 'hoa-cuoi', { maxPackagePrice: 12 * M }), b.categories[2]]
    const v = splitView({ ...b, fund: { ...b.fund, serviceBudget: 14 * M, serviceBudgetRaw: 14 * M }, categories: cats }, null)
    // 50/50 = 7tr mỗi bên; TT về vạch 28,57% (≈ 4tr), phần thừa sang HC (≈ 10tr ≤ 12tr)
    assert.deepEqual(v.rows.map((r) => [r.item.id, r.item.ratio, displayMoney(r.amount)]), [
      ['TT', 2857, 4 * M],
      ['HC', 7143, 10 * M],
    ])
    assert.equal(v.leftover, 0)
  })
  it('quỹ nhỏ hơn tổng giá gói cao nhất: không phải quỹ dư, chi tối đa bằng tiền phân bổ', () => {
    const b = budget('BALANCED')
    const v = splitView({ ...b, fund: { ...b.fund, serviceBudget: 10 * M, serviceBudgetRaw: 10 * M } }, null)
    assert.deepEqual([v.surplus, v.spendMax, v.unspent], [false, 10 * M, 0])
  })
  it('Tùy chỉnh: bỏ HC khỏi phần chia, TT nhận 100% và giá trần', () => {
    const b = budget('CUSTOM')
    const st = stateFromConfig({ version: 3, baseMode: 'BALANCED', excluded: ['HC'], capAmount: 5 * M, items: [{ categoryId: 'TT', ratio: 10000, locked: false }] }, b)
    const v = splitView(b, st)
    assert.deepEqual(v.excluded.map((c) => c.categoryId), ['HC'])
    assert.equal(v.rows[0].amount, 5 * M)
    assert.equal(v.leftover, 15 * M)
    assert.equal(v.limits.CA, 14 * M)
    assert.deepEqual(configBody(st, 3), { version: 3, baseMode: 'BALANCED', excluded: ['HC'], capAmount: 5 * M, items: [{ categoryId: 'TT', ratio: 10000, locked: false }] })
  })
  it('mức có sẵn vẫn giữ dịch vụ Tự lo (danh sách excluded backend trả về): không chia tiền, không gợi ý', () => {
    const b = budget('BALANCED')
    const v = splitView({ ...b, split: { ...b.split, excluded: ['HC'] } }, null)
    assert.equal(v.custom, false)
    assert.deepEqual(v.excluded.map((c) => c.categoryId), ['HC'])
    assert.ok(!v.rows.some((r) => r.item.id === 'HC'))
    assert.ok(!v.group.some((m) => m.id === 'HC'))
  })
  it('quỹ dư: vẫn dùng Tùy chỉnh như backend (giữ mức chi khách đặt, giá trần, hạng mục Tự lo)', () => {
    const b = budget('CUSTOM')
    const st = stateFromConfig({ version: 3, baseMode: 'BALANCED', excluded: ['HC'], capAmount: 5 * M, items: [{ categoryId: 'TT', ratio: 10000, locked: false }] }, b)
    const v = splitView({ ...b, fund: { ...b.fund, serviceBudget: 400 * M, serviceBudgetRaw: 400 * M } }, st)
    assert.equal(v.custom, true)
    assert.equal(v.capAmount, 5 * M)
    assert.equal(v.rows[0].amount, 5 * M)
    assert.deepEqual(v.excluded.map((c) => c.categoryId), ['HC'])
    assert.ok(!v.rows.some((r) => r.item.id === 'HC'))
  })
})

describe('presetsLocked: khóa 3 mức có sẵn khi quỹ đủ cho gói đắt nhất của mọi dịch vụ', () => {
  // Hai dịch vụ, gói đắt nhất 6tr mỗi bên: tổng 12tr. Các mức đã cắt về vạch nên khi quỹ ≥ 12tr cả 3 mức cho cùng kết quả
  const at = (sbTr: number) => {
    const b = budget('BALANCED')
    return { ...b, fund: { ...b.fund, serviceBudget: sbTr * M, serviceBudgetRaw: sbTr * M } } as Budget
  }
  it('quỹ dưới tổng giá gói đắt nhất thì không khóa', () => assert.equal(presetsLocked(at(11), false), false))
  it('bật khóa cần dư 5%, tắt chỉ khi không còn đủ (chống nhấp nháy)', () => {
    // Bật cần ≥ 12 × 1,05 = 12,6tr; đang khóa thì giữ tới 12tr
    assert.equal(presetsLocked(at(12.5), false), false)
    assert.equal(presetsLocked(at(12.6), false), true)
    assert.equal(presetsLocked(at(12), true), true)
    assert.equal(presetsLocked(at(11.9), true), false)
  })
  it('quỹ 0 hoặc nhóm rỗng: không khóa', () => assert.equal(presetsLocked(at(0), true), false))
})

describe('presetsSame: so ba mức theo gói gợi ý, không theo số tiền', () => {
  // Trang trí và Chụp ảnh cùng trung vị, gói 2–6tr: Ưu tiên hình ảnh bớt Trang trí (×0,8), thêm Chụp ảnh (×1,8)
  const pk = (id: string) => [2, 3, 4, 5, 6].map((tr) => ({ id: `${id}-${tr}`, cost: tr * M, place: 0, rating: null, reviewCount: 0, overlap: 0, vendorId: `${id}-v${tr}`, vendorName: `${id} ${tr}tr`, name: `${tr}tr`, chargedTables: null, unit: 'PACKAGE' as const }))
  const at = (sbTr: number) => {
    const b = budget('BALANCED')
    return {
      ...b,
      split: { ...b.split, eligible: [{ categoryId: 'TT', slug: 'decor', median: 10 * M }, { categoryId: 'CA', slug: 'chup-anh', median: 10 * M }] },
      categories: [category('TT', 'decor', { packages: pk('TT') }), category('CA', 'chup-anh', { packages: pk('CA') })],
      fund: { ...b.fund, serviceBudget: sbTr * M, serviceBudgetRaw: sbTr * M },
    } as Budget
  }
  it('quỹ 8tr: Cân bằng 4tr / 4tr; Ưu tiên hình ảnh Trang trí xuống gói 2tr, Chụp ảnh lên gói 5tr', () => {
    assert.equal(presetsSame(at(8)), false)
    const p = presetPicks(at(8))!
    assert.deepEqual([p.BALANCED, p.VISUAL].map((m) => m.picks.map((x) => x.pkg?.cost)), [
      [4 * M, 4 * M],
      [2 * M, 5 * M],
    ])
  })
  it('quỹ đủ gói đắt nhất (12tr): mọi mức cùng gói 6tr / 6tr, ẩn ba thẻ', () => assert.equal(presetsSame(at(12.5)), true))
})

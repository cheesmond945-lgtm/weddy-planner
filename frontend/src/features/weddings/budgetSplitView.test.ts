/*
 * Unit test cho budgetSplitView.ts (bảng chia tính ở client, lý do quỹ đổi). Chạy: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { configBody, fundChangeReason, presetsLocked, splitView, stateFromConfig, type FundSnapshot } from './budgetSplitView.ts'
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
    assert.equal(fundChangeReason(snap(), snap({ externalCost: 12 * M, serviceBudgetRaw: 148 * M })), 'Quỹ dịch vụ vừa thay đổi vì chi phí ngoài nền tảng.')
  })
  it('T61 gói tiệc đề xuất đổi cùng chi phí ngoài nền tảng', () => {
    const r = fundChangeReason(snap(), snap({ externalCost: 32 * M, venue: { status: 'SUGGESTED', amount: 120 * M, overBy: null }, serviceBudgetRaw: 156 * M }))
    assert.equal(r, 'Quỹ dịch vụ vừa thay đổi vì gói tiệc đề xuất đổi, chi phí ngoài nền tảng.')
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
  it('phương án có sẵn: chia theo trung vị, gói gợi ý trong giới hạn, giới hạn gợi ý cho hạng mục đã chọn', () => {
    const v = splitView(budget('BALANCED'), null)
    assert.deepEqual(v.rows.map((r) => [r.item.id, r.item.ratio, r.amount, r.suggestion?.pkg.cost]), [
      ['TT', 5000, 10 * M, 6 * M],
      ['HC', 5000, 10 * M, 6 * M],
    ])
    // Tỷ lệ ảo 1/3, pool = 20 + 8 = 28tr
    assert.equal(v.limits.CA, 9_333_333)
    // 10tr > gói cao nhất 6tr: cảnh báo, vạch ở 30%
    assert.deepEqual([v.rows[0].warn, v.rows[0].unused, v.rows[0].marker], [true, 4 * M, 3000])
    // Gói đắt nhất 6tr × 2 = 12tr < quỹ 20tr: quỹ dư, dự kiến chi tối đa 12tr, còn dư 8tr
    assert.deepEqual([v.surplus, v.spendMax, v.unspent], [true, 12 * M, 8 * M])
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
  it('quỹ dư: Tùy chỉnh tạm không áp dụng (tính theo phương án nền) nhưng vẫn giữ hạng mục Tự lo', () => {
    const b = budget('CUSTOM')
    const st = stateFromConfig({ version: 3, baseMode: 'BALANCED', excluded: ['HC'], capAmount: 5 * M, items: [{ categoryId: 'TT', ratio: 10000, locked: false }] }, b)
    const v = splitView(b, st, true)
    assert.equal(v.custom, false)
    assert.deepEqual(v.excluded.map((c) => c.categoryId), ['HC'])
    assert.equal(v.capAmount, null)
    assert.ok(!v.rows.some((r) => r.item.id === 'HC'))
  })
})

describe('presetsLocked: khóa 3 mức có sẵn khi mọi dịch vụ ở cả 3 mức đều được chia ≥ gói đắt nhất', () => {
  // Hai dịch vụ cùng trung vị, gói đắt nhất 6tr. Mức Ưu tiên không gian cho Trang trí 13/23, Hoa cưới 10/23 → Hoa cưới nhận ít nhất
  const at = (sbTr: number) => {
    const b = budget('BALANCED')
    return { ...b, fund: { ...b.fund, serviceBudget: sbTr * M, serviceBudgetRaw: sbTr * M } } as Budget
  }
  it('một hạng mục ở một mức không đủ thì không khóa', () => {
    // 13tr: Hoa cưới ở mức Không gian = 13 × 10/23 ≈ 5,65tr < 6tr
    assert.equal(presetsLocked(at(13), false), false)
  })
  it('bật khóa cần dư 5%, tắt chỉ khi không còn đủ (chống nhấp nháy)', () => {
    // Ngưỡng đủ: Hoa cưới ≥ 6tr ⇔ quỹ ≥ 13,8tr; bật cần ≥ 6,3tr ⇔ quỹ ≥ 14,49tr
    assert.equal(presetsLocked(at(14), false), false)
    assert.equal(presetsLocked(at(14.5), false), true)
    assert.equal(presetsLocked(at(14), true), true)
    assert.equal(presetsLocked(at(13.7), true), false)
  })
  it('quỹ 0 hoặc nhóm rỗng: không khóa', () => assert.equal(presetsLocked(at(0), true), false))
})

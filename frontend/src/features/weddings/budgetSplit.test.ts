/*
 * Bộ test có số liệu của luồng Tùy chỉnh ngân sách (tài liệu triển khai v1.2, mục 8), chạy trên CẢ HAI bản thuật toán:
 * frontend/src/features/weddings/budgetSplit.ts và backend/src/modules/weddings/budget-split.ts (mục 7: client và backend
 * phải ra cùng kết quả từng đơn vị ratio). Chạy: npm run test (frontend).
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import * as fe from './budgetSplit.ts'
import * as be from '../../../../backend/src/modules/weddings/budget-split.ts'

type Impl = typeof fe
const M = 1_000_000

for (const [side, S] of [
  ['frontend', fe],
  ['backend', be as unknown as Impl],
] as const) {
  // Tỷ lệ theo % để dễ đọc như tài liệu: TT = Trang trí, CA = Chụp ảnh, TP = Trang phục, TD = Trang điểm, HC = Hoa cưới
  const SLUG = { TT: 'decor', CA: 'chup-anh', TP: 'trang-phuc', TD: 'makeup', HC: 'hoa-cuoi' } as const
  type K = keyof typeof SLUG
  const member = (k: K, medianTr: number) => ({ id: k, slug: SLUG[k], median: medianTr * M })
  const items = (spec: Partial<Record<K, number | [number, 'L']>>) =>
    (Object.keys(spec) as K[]).map((k) => {
      const v = spec[k]!
      return { id: k, slug: SLUG[k], ratio: Math.round((Array.isArray(v) ? v[0] : v) * 100), locked: Array.isArray(v) }
    })
  /** { TT: '30,00', … } để so như tài liệu */
  const pct = (xs: { id: string; ratio: number }[]) => Object.fromEntries(xs.map((c) => [c.id, S.ratioText(c.ratio)]))
  const total = (xs: { ratio: number }[]) => xs.reduce((s, c) => s + c.ratio, 0)

  describe(`${side}: 8.1 khởi tạo`, () => {
    it('T01 Cân bằng: tỷ lệ theo giá trung vị', () => {
      const r = S.initFromMode([member('TT', 20), member('CA', 30), member('TP', 10), member('TD', 20), member('HC', 20)], 'BALANCED')
      assert.deepEqual(pct(r), { TT: '20,00', CA: '30,00', TP: '10,00', TD: '20,00', HC: '20,00' })
    })
    it('T02 Ưu tiên hình ảnh: trọng số 20, 30, 13, 12, 10', () => {
      const r = S.initFromMode([member('TT', 20), member('CA', 20), member('TP', 10), member('TD', 10), member('HC', 10)], 'VISUAL')
      assert.deepEqual(pct(r), { TT: '23,53', CA: '35,29', TP: '15,29', TD: '14,12', HC: '11,77' })
      assert.equal(total(r), 10000)
    })
    it('T03 Ưu tiên không gian: trọng số 26, 20, 20, 20, 20', () => {
      const r = S.initFromMode((['TT', 'CA', 'TP', 'TD', 'HC'] as K[]).map((k) => member(k, 20)), 'SPACE')
      assert.deepEqual(pct(r), { TT: '24,53', CA: '18,87', TP: '18,87', TD: '18,87', HC: '18,86' })
    })
    it('T04 ba hạng mục bằng nhau: phần dư về hạng mục đứng trước', () => {
      const r = S.initFromMode([member('HC', 5), member('CA', 5), member('TT', 5)], 'BALANCED')
      assert.deepEqual(pct(r), { TT: '33,34', CA: '33,33', HC: '33,33' })
    })
    it('T05 một hạng mục: 100%, không khóa được', () => {
      const r = S.initFromMode([member('HC', 5)], 'BALANCED')
      assert.equal(r[0].ratio, 10000)
      assert.equal(S.setLock(r, 'HC', true).error, 'SINGLE')
    })
    it('T06 nhóm rỗng', () => assert.deepEqual(S.initFromMode([], 'BALANCED'), []))
  })

  describe(`${side}: 8.2 tự cân bằng`, () => {
    it('T07 không khóa, TT = 40', () => {
      const r = S.rebalance(items({ TT: 30, CA: 25, TP: 25, TD: 20 }), 'TT', 4000)
      assert.deepEqual(pct(r.items), { TT: '40,00', CA: '21,43', TP: '21,43', TD: '17,14' })
      assert.equal(total(r.items), 10000)
    })
    const t08 = () => items({ TT: 30, CA: [25, 'L'], TP: [20, 'L'], TD: 15, HC: 10 })
    it('T08 khóa CA, TP (L = 45), TT = 35', () => {
      assert.deepEqual(pct(S.rebalance(t08(), 'TT', 3500).items), { TT: '35,00', CA: '25,00', TP: '20,00', TD: '12,00', HC: '8,00' })
    })
    it('T09 TT = 60 bị kéo về 55, có thông báo; T10 hạ về 30 thì chia đều', () => {
      const r = S.rebalance(t08(), 'TT', 6000)
      assert.equal(r.clamped, true)
      assert.equal(r.max, 5500)
      assert.deepEqual(pct(r.items), { TT: '55,00', CA: '25,00', TP: '20,00', TD: '0,00', HC: '0,00' })
      assert.deepEqual(pct(S.rebalance(r.items, 'TT', 3000).items), { TT: '30,00', CA: '25,00', TP: '20,00', TD: '12,50', HC: '12,50' })
    })
    it('T11 bốn mục khóa: HC không chỉnh được, giữ 10', () => {
      const r = S.rebalance(items({ TT: [30, 'L'], CA: [25, 'L'], TP: [20, 'L'], TD: [15, 'L'], HC: 10 }), 'HC', 5000)
      assert.equal(r.items.find((c) => c.id === 'HC')!.ratio, 1000)
    })
    it('T12 L = 100: HC giữ 0', () => {
      const r = S.rebalance(items({ TT: [40, 'L'], CA: [30, 'L'], TP: [20, 'L'], TD: [10, 'L'], HC: 0 }), 'HC', 2000)
      assert.equal(r.items.find((c) => c.id === 'HC')!.ratio, 0)
    })
    it('T13 nhập số tiền 25tr trên quỹ 100tr', () => {
      const wanted = S.ratioFromAmount(25 * M, 100 * M)!
      const r = S.rebalance(items({ TT: 30, CA: 25, TP: 20, TD: 15, HC: 10 }), 'TT', wanted)
      assert.deepEqual(pct(r.items), { TT: '25,00', CA: '26,79', TP: '21,43', TD: '16,07', HC: '10,71' })
    })
    it('T14 nhập 60tr khi L = 45: kéo về 55,00, có thông báo', () => {
      const r = S.rebalance(t08(), 'TT', S.ratioFromAmount(60 * M, 100 * M)!)
      assert.equal(r.clamped, true)
      assert.equal(S.ratioText(r.items[0].ratio), '55,00')
    })
    it('T15 quỹ ≤ 0: không quy đổi được số tiền', () => assert.equal(S.ratioFromAmount(5 * M, 0), null))
    it('T16 nhập -5%, trống, chữ, quá 2 chữ số thập phân', () => {
      assert.deepEqual(S.parsePercent('-5'), { kind: 'ok', ratio: 0, negative: true })
      assert.deepEqual(S.parsePercent('  '), { kind: 'empty' })
      assert.deepEqual(S.parsePercent('abc'), { kind: 'invalid' })
      assert.deepEqual(S.parsePercent('12,345'), { kind: 'ok', ratio: 1234, negative: false })
      assert.deepEqual(S.parsePercent('7.5'), { kind: 'ok', ratio: 750, negative: false })
    })
  })

  describe(`${side}: 8.3 khóa`, () => {
    it('T17 khóa hạng mục mở khóa cuối: từ chối', () => {
      assert.equal(S.setLock(items({ TT: [60, 'L'], CA: 40 }), 'CA', true).error, 'LAST_UNLOCKED')
    })
    it('T18 khóa hạng mục 0%: cho phép kèm nhắc', () => {
      const r = S.setLock(items({ TT: 60, CA: 40, HC: 0 }), 'HC', true)
      assert.equal(r.error, null)
      assert.equal(r.zero, true)
    })
    it('T19 khóa rồi chỉnh hạng mục khác: hạng mục khóa không đổi; T20 mở khóa giữ ratio', () => {
      const locked = S.setLock(items({ TT: 30, CA: 25, TP: 25, TD: 20 }), 'CA', true).items
      const r = S.rebalance(locked, 'TT', 5000).items
      assert.equal(r.find((c) => c.id === 'CA')!.ratio, 2500)
      const un = S.setLock(r, 'CA', false).items
      assert.equal(un.find((c) => c.id === 'CA')!.ratio, 2500)
    })
  })

  describe(`${side}: 8.4 nhóm chia thay đổi`, () => {
    it('T21 HC được chọn gói, TP khóa', () => {
      const r = S.onRemove(items({ TT: 30, CA: 25, TP: [20, 'L'], TD: 15, HC: 10 }), 'HC')
      assert.deepEqual(pct(r.items), { TT: '34,29', CA: '28,57', TP: '20,00', TD: '17,14' })
      assert.equal(r.unlocked, null)
    })
    it('T22 mọi mục còn lại đều khóa: mở khóa đúng TT (lớn nhất)', () => {
      const r = S.onRemove(items({ TT: [30, 'L'], CA: [25, 'L'], TP: [20, 'L'], TD: [15, 'L'], HC: 10 }), 'HC')
      assert.equal(r.unlocked, 'TT')
      assert.deepEqual(pct(r.items), { TT: '40,00', CA: '25,00', TP: '20,00', TD: '15,00' })
      assert.deepEqual(
        r.items.filter((c) => c.locked).map((c) => c.id),
        ['CA', 'TP', 'TD'],
      )
    })
    const eq = (k: K) => member(k, 10)
    it('T23 TP quay lại, CA và TD khóa: phần còn lại dồn cho TT', () => {
      const cur = items({ TT: 50, CA: [30, 'L'], TD: [20, 'L'] })
      const r = S.onAdd(cur, eq('TP'), () => 10 * M, 'BALANCED')
      assert.deepEqual(pct(r), { TT: '25,00', CA: '30,00', TP: '25,00', TD: '20,00' })
    })
    it('T24 TP quay lại, không khóa', () => {
      const r = S.onAdd(items({ TT: 50, CA: 30, TD: 20 }), eq('TP'), () => 10 * M, 'BALANCED')
      assert.deepEqual(pct(r), { TT: '37,50', CA: '22,50', TP: '25,00', TD: '15,00' })
    })
    it('T26 tải cấu hình đã lưu khi nhóm đã đổi: rời trước, quay lại sau, tổng 100', () => {
      const saved = { baseMode: 'BALANCED' as const, excluded: [], capAmount: 5 * M, items: items({ TT: 30, CA: 25, TP: 20, TD: 15, HC: 10 }) }
      const r = S.reconcile(saved, [eq('TT'), eq('CA'), eq('TD'), eq('HC')])
      assert.equal(r.changed, true)
      assert.equal(r.state.capAmount, null)
      assert.equal(total(r.state.items), 10000)
      assert.deepEqual(pct(r.state.items), { TT: '37,50', CA: '31,25', TD: '18,75', HC: '12,50' })
      assert.equal(S.reconcile(r.state, [eq('TT'), eq('CA'), eq('TD'), eq('HC')]).changed, false)
    })
    it('T39 TD 0% rời nhóm, TT và CA khóa: mở khóa TT', () => {
      const r = S.onRemove(items({ TT: [60, 'L'], CA: [40, 'L'], TD: 0 }), 'TD')
      assert.equal(r.unlocked, 'TT')
      assert.deepEqual(pct(r.items), { TT: '60,00', CA: '40,00' })
    })
    it('T40 bỏ CA khỏi phần chia; T41 thêm lại CA', () => {
      const st = { baseMode: 'BALANCED' as const, excluded: [] as string[], capAmount: null, items: items({ TT: 30, CA: 25, TP: 20, TD: 15, HC: 10 }) }
      const ex = S.excludeCategory(st, 'CA').state
      assert.deepEqual(ex.excluded, ['CA'])
      assert.deepEqual(pct(ex.items), { TT: '40,00', TP: '26,67', TD: '20,00', HC: '13,33' })
      const group = (['TT', 'CA', 'TP', 'TD', 'HC'] as K[]).map(eq)
      const back = S.includeCategory(ex, eq('CA'), group)
      assert.deepEqual(back.excluded, [])
      assert.deepEqual(pct(back.items), { TT: '32,00', CA: '20,00', TP: '21,34', TD: '16,00', HC: '10,66' })
    })
    it('nhóm còn một hạng mục: 100%, mở khóa', () => {
      const r = S.onRemove(items({ TT: [60, 'L'], CA: 40 }), 'CA')
      assert.deepEqual(r.items, [{ id: 'TT', slug: 'decor', ratio: 10000, locked: false }])
    })
  })

  describe(`${side}: 8.5 tiền, giới hạn, làm tròn`, () => {
    const group = [member('CA', 30), member('TD', 20), member('HC', 20)]
    it('T30 giới hạn gợi ý TT đã chọn gói 20tr, quỹ 90tr', () => {
      assert.equal(S.suggestedLimit(member('TT', 20), group, 'BALANCED', 90 * M, 20 * M), 24_444_444)
      assert.equal(S.displayMoney(24_444_444), 24_440_000)
    })
    it('T46 đổi gói TT sang 30tr (quỹ còn 80tr): giới hạn giữ nguyên, Vượt 5.555.556đ', () => {
      const limit = S.suggestedLimit(member('TT', 20), group, 'BALANCED', 80 * M, 30 * M)
      assert.equal(limit, 24_444_444)
      assert.equal(30 * M - limit, 5_555_556)
    })
    it('T47 làm tròn hiển thị 10.000đ', () => {
      assert.deepEqual([24_444_444, 5_555_556, 24_445_000].map(S.displayMoney), [24_440_000, 5_560_000, 24_450_000])
    })
    it('nhóm rỗng: tỷ lệ ảo = 1, quỹ âm thì giới hạn 0', () => {
      assert.equal(S.suggestedLimit(member('TT', 20), [], 'BALANCED', 10 * M, 5 * M), 15 * M)
      assert.equal(S.suggestedLimit(member('TT', 20), group, 'BALANCED', -50 * M, 5 * M), 0)
    })
  })

  describe(`${side}: 8.6 giá trần và còn dư`, () => {
    const one = items({ HC: 100 })
    it('T42 giá trần 15tr trên quỹ 20tr', () => assert.deepEqual(S.splitAmounts(one, 20 * M, 15 * M), { amounts: { HC: 15 * M }, leftover: 5 * M }))
    it('T44 quỹ giảm còn 12tr', () => assert.deepEqual(S.splitAmounts(one, 12 * M, 15 * M), { amounts: { HC: 12 * M }, leftover: 0 }))
    it('T45 hạng mục khác quay lại: giá trần bị xóa', () => {
      const r = S.reconcile({ baseMode: 'BALANCED', excluded: [], capAmount: 15 * M, items: one }, [member('HC', 5), member('TT', 5)])
      assert.equal(r.state.capAmount, null)
      assert.equal(r.state.items.length, 2)
    })
    it('nhóm rỗng: cả quỹ là còn dư', () => assert.deepEqual(S.splitAmounts([], 7 * M, null), { amounts: {}, leftover: 7 * M }))
  })

  describe(`${side}: 8.8 cảnh báo giá gói cao nhất`, () => {
    const sb = 158 * M
    it('T56 HC 40% trên quỹ 158tr, gói cao nhất 6tr', () => {
      const r = S.priceMarker((sb * 4000) / 10000, 6 * M, sb)
      assert.deepEqual(r, { marker: 379, warn: true, unused: 57_200_000 })
    })
    it('T57 về mức gói cao nhất: 3,79%, 5.988.200đ, hết cảnh báo; T58 quỹ 300tr; T59 quỹ 100tr', () => {
      const st = items({ TT: 30, CA: 20, HC: 40, TD: 10 })
      const r = S.rebalance(st, 'HC', S.priceMarker((sb * 4000) / 10000, 6 * M, sb).marker!)
      assert.equal(S.ratioText(r.items.find((c) => c.id === 'HC')!.ratio), '3,79')
      assert.equal(total(r.items), 10000)
      assert.equal(S.splitAmounts(r.items, sb, null).amounts.HC, 5_988_200)
      assert.equal(S.priceMarker(5_988_200, 6 * M, sb).warn, false)
      assert.deepEqual(S.priceMarker(S.splitAmounts(r.items, 300 * M, null).amounts.HC, 6 * M, 300 * M), { marker: 200, warn: true, unused: 5_370_000 })
      assert.deepEqual(S.priceMarker(S.splitAmounts(r.items, 100 * M, null).amounts.HC, 6 * M, 100 * M), { marker: 600, warn: false, unused: 0 })
    })
    it('T55 quỹ ≤ 0: không vạch, không cảnh báo', () => assert.deepEqual(S.priceMarker(0, 6 * M, 0), { marker: null, warn: false, unused: 0 }))
    it('T60 một hạng mục có giá trần 15tr, gói cao nhất 6tr: cảnh báo 9tr, còn dư vẫn 5tr', () => {
      const { amounts, leftover } = S.splitAmounts(items({ HC: 100 }), 20 * M, 15 * M)
      assert.equal(leftover, 5 * M)
      assert.equal(S.priceMarker(amounts.HC, 6 * M, 20 * M).unused, 9 * M)
    })
  })

  describe(`${side}: T38 bất biến`, () => {
    it('chuỗi thao tác ngẫu nhiên: tổng luôn 10000, nhóm từ 2 mục còn mục mở khóa', () => {
      let seed = 7
      const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed % n)
      const all = (['TT', 'CA', 'TP', 'TD', 'HC'] as K[]).map((k, i) => member(k, 3 + i * 4))
      let st = { baseMode: 'VISUAL' as const, excluded: [] as string[], capAmount: null as number | null, items: S.initFromMode(all, 'VISUAL') }
      for (let step = 0; step < 400; step++) {
        const ids = st.items.map((c) => c.id)
        const pick = ids[rnd(Math.max(1, ids.length))]
        const op = rnd(5)
        if (op === 0 && pick) st = { ...st, items: S.rebalance(st.items, pick, rnd(12000) - 1000).items }
        else if (op === 1 && pick) st = { ...st, items: S.setLock(st.items, pick, rnd(2) === 0).items }
        else if (op === 2 && pick) st = S.excludeCategory(st, pick).state
        else if (op === 3 && st.excluded.length) {
          const back = all.find((m) => m.id === st.excluded[0])!
          st = S.includeCategory(st, back, all.filter((m) => !st.excluded.includes(m.id) || m.id === back.id))
        } else st = S.reconcile(st, all.filter((m) => !st.excluded.includes(m.id) && rnd(4) > 0)).state
        assert.ok(S.isValidSplit(st.items), `bước ${step}: ${JSON.stringify(st.items)}`)
      }
    })
  })
}

describe('hai bản thuật toán cho cùng kết quả', () => {
  it('distribute với trọng số lớn (giá × h) và hòa', () => {
    const entries = [
      { id: 'a', slug: 'hoa-cuoi', weight: 123_456_789 * 13 },
      { id: 'b', slug: 'decor', weight: 987_654_321 * 15 },
      { id: 'c', slug: 'makeup', weight: 1 },
      { id: 'd', slug: 'chup-anh', weight: 1 },
    ]
    assert.deepEqual(fe.distribute(9999, entries), be.distribute(9999, entries))
    assert.equal(Object.values(fe.distribute(9999, entries)).reduce((s, x) => s + x, 0), 9999)
  })
})

describe('trimToMax: chuyển phần thừa sang dịch vụ khác', () => {
  const it3 = (a: number, b: number, c: number, locked = '') =>
    [
      { id: 'a', slug: 'chup-anh', ratio: a, locked: locked.includes('a') },
      { id: 'b', slug: 'trang-phuc', ratio: b, locked: locked.includes('b') },
      { id: 'c', slug: 'hoa-cuoi', ratio: c, locked: locked.includes('c') },
    ]
  const sum = (xs: { ratio: number }[]) => xs.reduce((s, x) => s + x.ratio, 0)

  it('dịch vụ vượt về vạch, phần thừa sang dịch vụ còn dưới vạch; tổng giữ 10000', () => {
    const out = fe.trimToMax(it3(6000, 3000, 1000), { a: 2000, b: null, c: null })
    assert.equal(out[0].ratio, 2000)
    assert.equal(sum(out), 10000)
    assert.ok(out[1].ratio > 3000 && out[2].ratio > 1000)
  })

  it('nhận thêm làm vượt thì lặp tiếp; hết chỗ nhận thì giữ phần thừa', () => {
    const out = fe.trimToMax(it3(6000, 3000, 1000), { a: 2000, b: 3500, c: null })
    assert.deepEqual(
      out.map((x) => x.ratio),
      [2000, 3500, 4500],
    )
    const none = it3(6000, 3000, 1000)
    assert.deepEqual(fe.trimToMax(none, { a: 2000, b: 1000, c: 500 }), none)
  })

  it('không đụng hạng mục khóa', () => {
    const out = fe.trimToMax(it3(6000, 3000, 1000, 'b'), { a: 2000, b: 1000, c: null })
    assert.deepEqual(
      out.map((x) => x.ratio),
      [2000, 3000, 5000],
    )
  })
})

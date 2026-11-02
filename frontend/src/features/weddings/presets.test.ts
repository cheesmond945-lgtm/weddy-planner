/*
 * Unit test cho presets.ts (mức chia ngân sách), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { amountFromPercent, percentFromAmount, percentText, PRESET_LABEL, PRESET_OPTIONS, rebalanceWeights } from './presets.ts'

const total = (w: Record<string, number>) => Math.round(Object.values(w).reduce((s, x) => s + x, 0) * 1e4) / 1e4

describe('mức chia', () => {
  it('form có 3 mức, không có Tùy chỉnh; không còn tên Cao cấp / Tiêu chuẩn', () => {
    assert.deepEqual(PRESET_OPTIONS.map((p) => p.value), ['BALANCED', 'SPACE', 'VISUAL'])
    assert.equal(PRESET_LABEL.CUSTOM, 'Tùy chỉnh')
    assert.ok(!Object.values(PRESET_LABEL).some((l) => /Cao cấp|Tiêu chuẩn/.test(l)))
  })
})

describe('rebalanceWeights', () => {
  const w = { decor: 40, 'chup-anh': 30, 'trang-phuc': 15, 'trang-diem': 10, 'hoa-cuoi': 5 }

  it('kéo một thanh: tổng vẫn 100%, các thanh khác giữ tỷ lệ cũ', () => {
    const r = rebalanceWeights(w, 'decor', 60)
    assert.equal(r.decor, 60)
    assert.equal(total(r), 100)
    assert.equal(r['chup-anh'], 20)
    assert.equal(Math.round(r['hoa-cuoi'] * 1e4) / 1e4, 3.3333)
    assert.equal(percentText(r['hoa-cuoi']), '3,3%')
  })

  it('kéo lên 100: các thanh khác về 0; kéo về 0 rồi kéo thanh khác: chia đều phần còn lại', () => {
    const all = rebalanceWeights(w, 'decor', 100)
    assert.ok(Object.entries(all).every(([k, v]) => (k === 'decor' ? v === 100 : v === 0)))
    const back = rebalanceWeights(all, 'decor', 60)
    assert.equal(total(back), 100)
    assert.equal(back['chup-anh'], 10)
  })

  it('giá trị ngoài 0–100 bị kẹp lại', () => {
    assert.equal(rebalanceWeights(w, 'decor', 150).decor, 100)
    assert.equal(rebalanceWeights(w, 'decor', -5).decor, 0)
    assert.equal(total(rebalanceWeights(w, 'decor', -5)), 100)
  })
})

describe('đổi số tiền ↔ % ở thanh kéo', () => {
  it('gõ số tiền thì ra % trên tiền đang chia; vượt quá thì kẹp 100%', () => {
    assert.equal(percentFromAmount(5_000_000, 50_000_000), 10)
    assert.equal(percentFromAmount(1_234_567, 10_000_000), 12.34567)
    // Gõ 5.000.000đ trên 199.200.000đ: đổi lại ra đúng số đã gõ
    assert.equal(amountFromPercent(percentFromAmount(5_000_000, 199_200_000), 199_200_000), 5_000_000)
    assert.equal(percentFromAmount(90_000_000, 50_000_000), 100)
    assert.equal(percentFromAmount(5_000_000, 0), 0)
    assert.equal(percentFromAmount(0, 50_000_000), 0)
  })

  it('% ra số tiền, làm tròn tới 1.000đ', () => {
    assert.equal(amountFromPercent(10, 50_000_000), 5_000_000)
    assert.equal(amountFromPercent(33.3, 10_000_001), 3_330_000)
    assert.equal(amountFromPercent(100 / 3, 25_000_000), 8_333_000)
    assert.equal(amountFromPercent(50, -1), 0)
  })
})

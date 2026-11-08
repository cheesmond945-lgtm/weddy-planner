/*
 * Unit test cho presets.ts (mức chia ngân sách), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PRESET_LABEL, PRESET_OPTIONS, presetOptionsFor } from './presets.ts'

const total = (w: Record<string, number>) => Math.round(Object.values(w).reduce((s, x) => s + x, 0) * 1e4) / 1e4

describe('mức chia', () => {
  it('form có 3 mức, không có Tùy chỉnh; không còn tên Cao cấp / Tiêu chuẩn', () => {
    assert.deepEqual(PRESET_OPTIONS.map((p) => p.value), ['BALANCED', 'SPACE', 'VISUAL'])
    assert.equal(PRESET_LABEL.CUSTOM, 'Tùy chỉnh')
    assert.ok(!Object.values(PRESET_LABEL).some((l) => /Cao cấp|Tiêu chuẩn/.test(l)))
  })
})

describe('mức chia theo dịch vụ đang chọn ở form', () => {
  const NAME: Record<string, string> = { decor: 'Trang trí', 'hoa-cuoi': 'Hoa cưới', 'chup-anh': 'Chụp ảnh', 'trang-phuc': 'Trang phục', makeup: 'Trang điểm' }
  const opts = (selected: string[]) => Object.fromEntries(presetOptionsFor(selected, (s) => NAME[s] ?? s).map((o) => [o.value, o]))

  it('mô tả mức Ưu tiên chỉ kể dịch vụ ưu tiên đang chọn', () => {
    const o = opts(['nha-hang', 'decor', 'chup-anh', 'makeup'])
    assert.equal(o.SPACE.description, 'Dành thêm cho trang trí.')
    assert.equal(o.VISUAL.description, 'Dành thêm cho chụp ảnh, trang điểm.')
    assert.ok(!o.SPACE.disabled && !o.VISUAL.disabled)
  })

  it('bỏ hết dịch vụ ưu tiên thì khóa mức đó; Cân bằng luôn chọn được', () => {
    const o = opts(['nha-hang', 'decor'])
    assert.equal(o.VISUAL.disabled, true)
    assert.equal(o.VISUAL.description, 'Cần chọn chụp ảnh, trang phục hoặc trang điểm.')
    assert.ok(!o.BALANCED.disabled && !o.SPACE.disabled)
  })
})

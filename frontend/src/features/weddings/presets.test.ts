/*
 * Unit test cho presets.ts (mức chia ngân sách), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PRESET_LABEL, PRESET_OPTIONS } from './presets.ts'

const total = (w: Record<string, number>) => Math.round(Object.values(w).reduce((s, x) => s + x, 0) * 1e4) / 1e4

describe('mức chia', () => {
  it('form có 3 mức, không có Tùy chỉnh; không còn tên Cao cấp / Tiêu chuẩn', () => {
    assert.deepEqual(PRESET_OPTIONS.map((p) => p.value), ['BALANCED', 'SPACE', 'VISUAL'])
    assert.equal(PRESET_LABEL.CUSTOM, 'Tùy chỉnh')
    assert.ok(!Object.values(PRESET_LABEL).some((l) => /Cao cấp|Tiêu chuẩn/.test(l)))
  })
})

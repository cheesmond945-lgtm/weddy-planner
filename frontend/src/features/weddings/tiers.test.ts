/*
 * Unit test cho tiers.ts (Mức chi tiêu ở form và tab Ngân sách), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { TIER_HINT, TIER_OPTIONS, tierText } from './tiers.ts'

describe('mức chi tiêu', () => {
  it('bốn thẻ theo thứ tự, mặc định Tự động đứng đầu, mỗi thẻ có mô tả một dòng', () => {
    assert.deepEqual(
      TIER_OPTIONS.map((t) => t.value),
      ['AUTO', 'SAVING', 'BALANCED', 'PREMIUM'],
    )
    assert.equal(TIER_OPTIONS[0].label, 'Tự động theo ngân sách')
    assert.ok(TIER_OPTIONS.every((t) => t.description && !t.description.includes('\n')))
  })

  it('Tự động ghi mức đang áp dụng', () => {
    assert.equal(tierText('AUTO', 'BALANCED'), 'Tự động (đang áp dụng Cân đối)')
    assert.equal(tierText('PREMIUM', 'PREMIUM'), 'Cao cấp')
  })

  it('gợi ý dưới ô đúng câu chữ', () => {
    assert.equal(TIER_HINT, 'Dùng để gợi ý ngân sách từng hạng mục. Bạn vẫn sửa được từng ô và đổi lại sau.')
  })
})

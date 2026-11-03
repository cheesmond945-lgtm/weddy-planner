/*
 * Unit test cho taskTitle.ts (tách / ghép "tên — ghi chú"), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { joinTitle, splitTitle } from './taskTitle.ts'

describe('splitTitle / joinTitle', () => {
  it('tách theo lần xuất hiện ĐẦU TIÊN của " — "', () => {
    assert.deepEqual(splitTitle('Gửi mẫu thiệp — bản in thử — kèm phong bì'), { title: 'Gửi mẫu thiệp', note: 'bản in thử — kèm phong bì' })
  })

  it('không có dấu phân cách / ghi chú rỗng: chỉ có tên', () => {
    assert.deepEqual(splitTitle('Gửi mẫu thiệp'), { title: 'Gửi mẫu thiệp', note: null })
    assert.deepEqual(splitTitle('Gửi mẫu thiệp — '), { title: 'Gửi mẫu thiệp', note: null })
    assert.deepEqual(splitTitle(' — chỉ ghi chú'), { title: '— chỉ ghi chú', note: null })
  })

  it('ghép rồi tách ra đúng như cũ; ghi chú trống thì không có dấu phân cách', () => {
    assert.equal(joinTitle(' Tên ', ' ghi chú '), 'Tên — ghi chú')
    assert.equal(joinTitle('Tên', null), 'Tên')
    assert.equal(joinTitle('Tên', '  '), 'Tên')
    assert.deepEqual(splitTitle(joinTitle('A', 'B — C')), { title: 'A', note: 'B — C' })
  })
})

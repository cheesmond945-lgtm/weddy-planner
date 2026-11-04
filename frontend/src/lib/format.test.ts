import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { capitalizeFirst } from './format.ts'

describe('capitalizeFirst: tên dịch vụ viết hoa chữ cái đầu khi hiển thị', () => {
  it('các tên dịch vụ của timeline', () => {
    const cases: [string, string][] = [
      ['trang trí', 'Trang trí'],
      ['makeup', 'Makeup'],
      ['nhà hàng', 'Nhà hàng'],
      ['chụp ảnh & quay phim', 'Chụp ảnh & quay phim'],
      ['trang phục', 'Trang phục'],
      ['hoa cưới', 'Hoa cưới'],
    ]
    for (const [raw, shown] of cases) assert.equal(capitalizeFirst(raw), shown)
  })
  it('đã viết hoa thì giữ nguyên; chuỗi rỗng không lỗi; chữ có dấu ở đầu', () => {
    assert.equal(capitalizeFirst('Trang điểm'), 'Trang điểm')
    assert.equal(capitalizeFirst(''), '')
    assert.equal(capitalizeFirst('đồ cưới'), 'Đồ cưới')
  })
})

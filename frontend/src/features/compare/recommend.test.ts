/*
 * Unit test cho recommend.ts, chạy bằng test runner có sẵn của Node (không thêm thư viện):
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { recommend, type RecommendItem } from './recommend.ts'

const A: RecommendItem = { id: 'A', price: 128_000_000, rating: 4.7, reviewCount: 1824, capacity: 600, styles: ['Sang trọng', 'Truyền thống'], city: 'Hà Nội' }
const B: RecommendItem = { id: 'B', price: 96_000_000, rating: 4.5, reviewCount: 932, capacity: 400, styles: ['Truyền thống', 'Cổ điển'], city: 'Hà Nội' }

describe('recommend', () => {
  it('không có thông tin đám cưới: đề xuất gói rẻ hơn với lý do "giá thấp nhất"', () => {
    const r = recommend([A, B], null, 'nha-hang')
    assert.equal(r.isTie, false)
    assert.equal(r.recommendedId, 'B')
    assert.ok(r.reasons.includes('giá thấp nhất'))
  })

  it('có đám cưới 500 khách, 300 triệu, phong cách Sang trọng: đề xuất A, có lý do đủ chỗ', () => {
    const r = recommend([A, B], { budget: 300_000_000, guestCount: 500, city: null, styles: ['Sang trọng'] }, 'nha-hang')
    assert.equal(r.recommendedId, 'A')
    assert.ok(r.reasons.includes('đủ chỗ cho 500 khách'))
    assert.ok(r.reasons.length <= 3)
  })

  it('hai gói gần như giống nhau về giá và đánh giá: hòa, không đề xuất', () => {
    const C = { ...A, id: 'C', price: 100_000_000, rating: 4.6, reviewCount: 500 }
    const D = { ...A, id: 'D', price: 101_000_000, rating: 4.6, reviewCount: 510 }
    const r = recommend([C, D], null, 'nha-hang')
    assert.equal(r.isTie, true)
    assert.equal(r.recommendedId, null)
    assert.deepEqual(r.reasons, [])
  })

  it('một gói thiếu điểm Google: không dùng yếu tố điểm, chỉ so giá', () => {
    // A có điểm cao hơn nhưng B thiếu điểm -> chỉ so giá -> B rẻ hơn được đề xuất
    const r = recommend([A, { ...B, rating: null, reviewCount: null }], null, 'nha-hang')
    assert.equal(r.usedRating, false)
    assert.equal(r.recommendedId, 'B')
    assert.ok(r.reasons.includes('giá thấp nhất'))
    assert.ok(!r.reasons.includes('điểm Google Maps cao nhất'))
  })

  it('thiếu điểm nhưng có thông tin đám cưới: vẫn dùng giá và độ phù hợp', () => {
    const wedding = { budget: 300_000_000, guestCount: 500, city: 'Hà Nội', styles: ['Sang trọng'] }
    const r = recommend([{ ...A, rating: null, reviewCount: null }, B], wedding, 'nha-hang')
    assert.equal(r.usedRating, false)
    assert.equal(r.recommendedId, 'A')
    assert.ok(r.reasons.includes('đủ chỗ cho 500 khách'))
    assert.ok(!r.reasons.some((x) => x.includes('Google')))
  })

  it('thiếu điểm và hai gói cùng giá: hòa', () => {
    const r = recommend([{ ...A, rating: null, reviewCount: null }, { ...B, price: A.price }], null, 'decor')
    assert.equal(r.isTie, true)
  })

  it('ít hơn 2 phương án: không đề xuất', () => {
    const r = recommend([A], null, 'nha-hang')
    assert.equal(r.recommendedId, null)
    assert.equal(r.isTie, false)
  })

  it('hạng mục không phải nhà hàng: không xét sức chứa', () => {
    const r = recommend([A, B], { budget: null, guestCount: 500, city: null, styles: [] }, 'decor')
    assert.ok(!r.reasons.some((x) => x.startsWith('đủ chỗ')))
  })
})

/*
 * Unit test cho recommend.ts, chạy bằng test runner có sẵn của Node (không thêm thư viện):
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { recommend, type RecommendItem } from './recommend.ts'

const A: RecommendItem = { id: 'A', price: 128_000_000, rating: 4.7, reviewCount: 1824, capacity: 600 }
const B: RecommendItem = { id: 'B', price: 96_000_000, rating: 4.5, reviewCount: 932, capacity: 400 }

describe('recommend', () => {
  it('không có thông tin đám cưới: đề xuất gói rẻ hơn với lý do "giá thấp nhất"', () => {
    const r = recommend([A, B], null, 'nha-hang')
    assert.equal(r.isTie, false)
    assert.equal(r.recommendedId, 'B')
    assert.ok(r.reasons.includes('giá thấp nhất'))
  })

  it('có đám cưới 500 khách, ngân sách hạng mục 120 triệu: đề xuất A, có lý do đủ chỗ', () => {
    const r = recommend([A, B], { categoryBudget: 120_000_000, guestCount: 500 }, 'nha-hang')
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
    const wedding = { categoryBudget: 120_000_000, guestCount: 500 }
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

  it('phù hợp = min(1, ngân sách hạng mục / chi phí gói): gói vừa ngân sách có lý do riêng', () => {
    // Cùng điểm, A rẻ hơn một chút nhưng vượt ngân sách 100 triệu; B đắt hơn nhưng vẫn vượt; C vừa ngân sách
    const C: RecommendItem = { id: 'C', price: 95_000_000, rating: 4.5, reviewCount: 900 }
    const D: RecommendItem = { id: 'D', price: 140_000_000, rating: 4.5, reviewCount: 900 }
    const r = recommend([C, D], { categoryBudget: 100_000_000, guestCount: 200 }, 'decor')
    assert.equal(r.recommendedId, 'C')
    assert.ok(r.reasons.includes('nằm trong ngân sách hạng mục'))
  })

  it('không có ngân sách hạng mục: dùng trọng số không có đám cưới (chỉ điểm và giá)', () => {
    const withBudget = recommend([A, B], { categoryBudget: 1, guestCount: null }, 'decor')
    const without = recommend([A, B], { categoryBudget: null, guestCount: null }, 'decor')
    const noWedding = recommend([A, B], null, 'decor')
    assert.deepEqual(without, noWedding)
    assert.ok(withBudget.recommendedId !== null)
  })

  it('ít hơn 2 phương án: không đề xuất', () => {
    const r = recommend([A], null, 'nha-hang')
    assert.equal(r.recommendedId, null)
    assert.equal(r.isTie, false)
  })

  it('hạng mục không phải nhà hàng: không xét sức chứa', () => {
    const r = recommend([A, B], { categoryBudget: null, guestCount: 500 }, 'decor')
    assert.ok(!r.reasons.some((x) => x.startsWith('đủ chỗ')))
  })
})

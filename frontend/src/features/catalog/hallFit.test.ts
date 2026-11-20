/*
 * Unit test cho hallFit.ts (sảnh có hợp với đám cưới của khách không), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { expectedTables, hallMismatch } from './hallFit.ts'

describe('expectedTables', () => {
  it('tự tính ⌈số khách / 10⌉, ưu tiên số bàn khách tự nhập', () => {
    assert.equal(expectedTables({ guestCount: 300 }), 30)
    assert.equal(expectedTables({ guestCount: 305 }), 31)
    assert.equal(expectedTables({ guestCount: 300, tableCountOverride: 35 }), 35)
    assert.equal(expectedTables({ guestCount: null }), null)
    assert.equal(expectedTables(null), null)
  })
})

describe('hallMismatch', () => {
  const w = { guestCount: 300, tableCountOverride: null }

  it('đủ chỗ, tối thiểu không vượt số bàn dự kiến: phù hợp', () => {
    assert.equal(hallMismatch({ capacity: 300, minTables: 20 }, w), null)
    assert.equal(hallMismatch({ capacity: 400, minTables: 30 }, w), null)
    assert.equal(hallMismatch({ capacity: null, minTables: null }, w), null)
  })

  it('tối thiểu nhiều hơn số bàn dự kiến: không phù hợp', () => {
    assert.equal(hallMismatch({ capacity: 500, minTables: 40 }, w), 'Không phù hợp: đặt tối thiểu 40 bàn, nhiều hơn 30 bàn dự kiến')
  })

  it('sức chứa ít hơn số khách: không phù hợp (báo sức chứa trước)', () => {
    assert.equal(hallMismatch({ capacity: 250, minTables: 40 }, w), 'Không phù hợp: sảnh chứa tối đa 250 khách, ít hơn 300 khách dự kiến')
  })

  it('chưa có số khách: không đánh giá', () => {
    assert.equal(hallMismatch({ capacity: 250, minTables: 40 }, { guestCount: null }), null)
    assert.equal(hallMismatch({ capacity: 250, minTables: 40 }, undefined), null)
  })
})

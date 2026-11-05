import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { depositPercentError } from '../../lib/deposit.ts'

describe('depositPercentError: tỷ lệ cọc 10 đến 99, số nguyên', () => {
  it('hợp lệ: 10, 30, 99', () => {
    for (const p of [10, 30, 99]) assert.equal(depositPercentError(p), undefined)
  })
  it('dưới 10 hoặc từ 100 trở lên bị chặn', () => {
    for (const p of [1, 5, 9, 100, 150, -3]) assert.ok(depositPercentError(p), `${p}`)
  })
  it('ô trống (0) hoặc chữ (NaN) bị chặn với thông báo nhập tỷ lệ', () => {
    assert.match(depositPercentError(0)!, /Nhập tỷ lệ cọc/)
    assert.match(depositPercentError(Number('abc'))!, /Nhập tỷ lệ cọc/)
  })
  it('số lẻ bị chặn', () => assert.ok(depositPercentError(12.5)))
})

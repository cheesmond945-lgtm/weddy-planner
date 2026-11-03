/*
 * Unit test cho messageSender.ts (ai gửi tin chứng từ), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { effectiveSender } from './messageSender.ts'

describe('effectiveSender', () => {
  it('FinalInvoice luôn là NCC, kể cả tin cũ lưu sai sender', () => {
    for (const sender of ['VENDOR', 'SYSTEM', 'COUPLE'] as const) assert.equal(effectiveSender({ sender, type: 'FinalInvoice' }), 'VENDOR', sender)
  })

  it('DepositReceipt luôn là hệ thống', () => {
    for (const sender of ['VENDOR', 'SYSTEM', 'COUPLE'] as const) assert.equal(effectiveSender({ sender, type: 'DepositReceipt' }), 'SYSTEM', sender)
  })

  it('tin khác giữ sender trong dữ liệu (thẻ đơn do NCC gửi, tin hệ thống, tin của khách)', () => {
    assert.equal(effectiveSender({ sender: 'VENDOR', type: 'Order' }), 'VENDOR')
    assert.equal(effectiveSender({ sender: 'SYSTEM', type: 'Text' }), 'SYSTEM')
    assert.equal(effectiveSender({ sender: 'COUPLE', type: 'Text' }), 'COUPLE')
  })
})

/*
 * Unit test cho revisionHistory.ts (ghép lịch sử chỉnh sửa đơn), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { OrderRevision } from '@/types/vendorOrder'
import { revisionHistory } from './revisionHistory.ts'

const rev = (r: Partial<OrderRevision> & Pick<OrderRevision, 'id'>): OrderRevision => ({
  revisionType: 'AfterDeposit',
  requestNote: null,
  changes: [],
  oldTotalAmount: 210_000_000,
  newTotalAmount: 210_000_000,
  status: 'Applied',
  createdDate: '2026-11-06T17:08:00.000Z',
  appliedDate: '2026-11-06T17:08:00.000Z',
  ...r,
})

describe('revisionHistory', () => {
  // Đúng dữ liệu trong ảnh: yêu cầu 23:53 06/11, NCC sửa 00:08 07/11, một lần đổi số bàn trước cọc
  const data: OrderRevision[] = [
    rev({ id: 'ncc', requestNote: 'đã thay đổi theo yêu cầu của khách', changes: ['Other'], createdDate: '2026-11-06T17:08:00.010Z', appliedDate: '2026-11-06T17:08:00.012Z' }),
    rev({ id: 'kh', requestNote: 'đổi số điện thoại liên hệ', changes: ['Other'], createdDate: '2026-11-06T16:53:00.000Z', appliedDate: '2026-11-06T17:08:00.005Z' }),
    rev({ id: 'truoc', revisionType: 'BeforeDeposit', requestNote: 'tôi muốn đổi số bàn lên 25 bàn', changes: ['Quantity'], oldTotalAmount: 115_500_000, newTotalAmount: 210_000_000, createdDate: '2026-11-05T03:55:00.000Z', appliedDate: '2026-11-05T03:58:00.000Z' }),
  ]

  it('gộp yêu cầu của khách và lần NCC sửa thành một thẻ: còn 2 thẻ', () => {
    const h = revisionHistory(data)
    assert.equal(h.length, 2)
    assert.equal(h[0].request?.note, 'đổi số điện thoại liên hệ')
    assert.equal(h[0].request?.date, '2026-11-06T16:53:00.000Z')
    assert.equal(h[0].edit?.note, 'đã thay đổi theo yêu cầu của khách')
  })

  it('trước cọc: yêu cầu của khách và lúc NCC sửa nằm cùng thẻ, tổng theo lần sửa', () => {
    const t = revisionHistory(data)[1]
    assert.deepEqual(t.request?.changes, ['Quantity'])
    assert.equal(t.edit?.date, '2026-11-05T03:58:00.000Z')
    assert.equal(t.oldTotal, 115_500_000)
    assert.equal(t.newTotal, 210_000_000)
  })

  it('NCC tự sửa (không có yêu cầu): thẻ chỉ có phần NCC sửa', () => {
    const h = revisionHistory([rev({ id: 'a', requestNote: 'đổi gói', changes: ['Item'], oldTotalAmount: 13_500_000, newTotalAmount: 18_500_000 })])
    assert.equal(h[0].request, null)
    assert.equal(h[0].edit?.note, 'đổi gói')
  })

  it('yêu cầu đang chờ hoặc bị từ chối: chỉ có phần khách yêu cầu', () => {
    const h = revisionHistory([
      rev({ id: 'w', status: 'Requested', requestNote: 'đổi ngày', changes: ['EventDate'], newTotalAmount: null, appliedDate: null }),
      rev({ id: 'r', status: 'Rejected', requestNote: 'xin giảm giá', changes: ['Other'], newTotalAmount: null, appliedDate: null, createdDate: '2026-11-01T00:00:00.000Z' }),
    ])
    assert.equal(h.length, 2)
    assert.ok(h.every((e) => e.request && !e.edit))
  })

  it('trước cọc, NCC tự sửa (không lời nhắn): không có phần khách yêu cầu', () => {
    const h = revisionHistory([rev({ id: 'b', revisionType: 'BeforeDeposit', requestNote: null, changes: [], createdDate: '2026-11-05T03:00:00.000Z', appliedDate: '2026-11-05T03:00:00.000Z' })])
    assert.equal(h[0].request, null)
    assert.ok(h[0].edit)
  })
})

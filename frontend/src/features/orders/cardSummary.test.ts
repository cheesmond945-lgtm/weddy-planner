import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { depositChip, endedReason, itemsSummary, itemsSummaryParts } from './cardSummary.ts'

describe('itemsSummary: một dòng hạng mục', () => {
  it('sảnh tính theo bàn: tên · số bàn', () => {
    assert.equal(itemsSummary([{ itemName: 'Sảnh Vàng Cánh Bướm', unit: 'Bàn', quantity: 30 }]), 'Sảnh Vàng Cánh Bướm · 30 bàn')
  })
  it('gói hiện số lượng kèm đơn vị', () => {
    assert.equal(itemsSummary([{ itemName: 'Trang điểm cô dâu', unit: 'Gói', quantity: 1 }]), 'Trang điểm cô dâu · 1 gói')
    assert.equal(itemsSummary([{ itemName: 'Phụ kiện', unit: 'Gói', quantity: 3 }]), 'Phụ kiện · 3 gói')
  })
  it('nhiều hạng mục: dòng đầu + N hạng mục khác', () => {
    assert.equal(
      itemsSummary([{ itemName: 'Sảnh A', unit: 'Bàn', quantity: 20 }, { itemName: 'Hoa', unit: 'Gói', quantity: 1 }, { itemName: 'Âm thanh', unit: 'Gói', quantity: 1 }]),
      'Sảnh A + 2 hạng mục khác',
    )
  })
  it('tách 2 cột: tên | số lượng; nhiều dòng thì cột phải trống', () => {
    assert.deepEqual(itemsSummaryParts([{ itemName: 'Sảnh A', unit: 'Bàn', quantity: 30 }]), { name: 'Sảnh A', more: '', qty: '30 bàn' })
    assert.deepEqual(itemsSummaryParts([{ itemName: 'Sảnh A', unit: 'Bàn', quantity: 30 }, { itemName: 'Hoa', unit: 'Gói', quantity: 1 }]), { name: 'Sảnh A', more: ' + 1 hạng mục khác', qty: '' })
  })
  it('không có dòng nào', () => assert.equal(itemsSummary([]), 'Chưa có hạng mục'))
})

describe('depositChip: hạn đặt cọc gọn', () => {
  const due = '2026-11-05T14:30:00Z' // 21:30 05/11 giờ Việt Nam
  const at = (iso: string) => Date.parse(iso)
  it('còn nhiều giờ: bình thường', () => {
    const c = depositChip(due, at('2026-11-05T01:00:00Z'))
    assert.equal(c.text, 'Hạn đặt cọc còn 13 giờ (21:30 05/11)')
    assert.equal(c.urgent, false)
  })
  it('còn dưới 6 giờ: cảnh báo; dưới 1 giờ thì tính phút', () => {
    assert.equal(depositChip(due, at('2026-11-05T10:00:00Z')).urgent, true)
    assert.equal(depositChip(due, at('2026-11-05T14:00:00Z')).text, 'Hạn đặt cọc còn 30 phút (21:30 05/11)')
  })
  it('quá hạn', () => {
    const c = depositChip(due, at('2026-11-05T15:00:00Z'))
    assert.deepEqual([c.overdue, c.urgent, c.text], [true, true, 'Đã quá hạn đặt cọc (21:30 05/11)'])
  })
})

describe('endedReason', () => {
  it('hết hạn và hai lý do hủy', () => {
    assert.equal(endedReason('Expired'), 'Quá hạn đặt cọc')
    assert.match(endedReason('Cancelled', 'VENDOR_UNABLE'), /NCC không thể thực hiện/)
    assert.match(endedReason('Cancelled', 'CUSTOMER_REQUEST'), /cọc không hoàn/)
  })
})

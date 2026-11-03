/*
 * Unit test cho budgetView.ts (bảng ngân sách và đổi gói), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { costSourceText, packageLabel, packageOptionText, parseMoneyInput, suggestionLabelText, unitLabel } from './budgetView.ts'

describe('bảng ngân sách', () => {
  it('nhãn gói gợi ý: vượt phân bổ, vượt X đ, không nhãn', () => {
    assert.equal(suggestionLabelText({ code: 'OVER_BY', amount: 17_004_999 }), 'Vượt 17.000.000đ')
    assert.equal(suggestionLabelText(null), null)
  })

  it('nhãn nguồn dưới số chi phí: chỉ dùng chữ "Đã cọc", không dùng "Đã chi"', () => {
    assert.equal(costSourceText('PLANNED', 0), 'Dự kiến')
    assert.equal(costSourceText('ORDER', 0), 'Theo đơn')
    assert.equal(costSourceText('DEPOSITED', 3_000_000), 'Đã cọc 3.000.000đ')
  })

  it('ô tiền: bỏ dấu chấm và chữ, trống là null', () => {
    assert.equal(parseMoneyInput('127.000.000'), 127_000_000)
    assert.equal(parseMoneyInput('12tr'), 12)
    assert.equal(parseMoneyInput(''), null)
  })
})

describe('đổi gói', () => {
  it('nhãn gói: dự kiến, đã chọn, theo đơn', () => {
    assert.equal(packageLabel({ id: 'a', name: 'Sảnh Ngọc', source: 'PLANNED', unavailable: false }), 'Gói dự kiến: Sảnh Ngọc, bấm để đổi')
    assert.equal(packageLabel({ id: 'a', name: 'Sảnh Ngọc', source: 'SELECTED', unavailable: false }), 'Sảnh Ngọc')
    assert.equal(packageLabel({ id: 'a', name: 'Sảnh Ngọc', source: 'ORDER', unavailable: false }), 'Sảnh Ngọc (theo đơn)')
    assert.equal(packageLabel(null), 'Chưa có gói')
  })

  it('đơn vị giá và dòng chọn gói: theo bàn có phép tính, vượt sức chứa thì ghi rõ', () => {
    assert.equal(unitLabel('TABLE'), '/ bàn')
    assert.equal(unitLabel('PACKAGE'), '/ gói')
    const hall = { id: 'h', name: 'Sảnh A', price: 5_000_000, unit: 'TABLE' as const, cost: 150_000_000, capacity: 200, minTables: 30, fits: false }
    assert.equal(packageOptionText(hall, 250, 25), 'Sảnh A: 5.000.000đ / bàn, 30 bàn = 150.000.000đ. Vượt sức chứa (250 khách)')
    const photo = { id: 'p', name: 'Gói 1', price: 18_000_000, unit: 'PACKAGE' as const, cost: 18_000_000, capacity: null, minTables: null, fits: true }
    assert.equal(packageOptionText(photo, 250, 25), 'Gói 1: 18.000.000đ / gói')
  })
})

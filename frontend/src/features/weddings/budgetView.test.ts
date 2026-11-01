/*
 * Unit test cho budgetView.ts (bảng ngân sách và đổi gói), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { budgetCellAction, diffView, packageLabel, packageOptionText, parseMoneyInput, unitLabel } from './budgetView.ts'

describe('bảng ngân sách', () => {
  it('chênh lệch: còn lại xanh, vượt đỏ, chưa có nhà cung cấp là gạch', () => {
    assert.deepEqual(diffView(5_000_000), { text: 'Còn 5.000.000đ', tone: 'left' })
    assert.deepEqual(diffView(-2_500_000), { text: 'Vượt 2.500.000đ', tone: 'over' })
    assert.deepEqual(diffView(0), { text: 'Còn 0đ', tone: 'left' })
    assert.equal(diffView(null).tone, 'none')
  })

  it('ô tiền: bỏ dấu chấm và chữ, trống là null', () => {
    assert.equal(parseMoneyInput('127.000.000'), 127_000_000)
    assert.equal(parseMoneyInput('12tr'), 12)
    assert.equal(parseMoneyInput(''), null)
  })

  it('lưu ô ngân sách: trống thì bỏ số sửa tay, trùng số thì không gọi API', () => {
    assert.deepEqual(budgetCellAction({ budget: 18_000_000, manual: true }, ''), { type: 'clear' })
    assert.deepEqual(budgetCellAction({ budget: 18_000_000, manual: false }, ''), { type: 'none' })
    assert.deepEqual(budgetCellAction({ budget: 18_000_000, manual: false }, '18.000.000'), { type: 'none' })
    assert.deepEqual(budgetCellAction({ budget: 18_000_000, manual: false }, '20.000.000'), { type: 'set', amount: 20_000_000 })
  })
})

describe('đổi gói', () => {
  it('nhãn gói: dự kiến, đã chọn, theo đơn', () => {
    assert.equal(packageLabel({ id: 'a', name: 'Sảnh Ngọc', source: 'PLANNED', unavailable: false }), 'Gói dự kiến: Sảnh Ngọc, bấm để đổi')
    assert.equal(packageLabel({ id: 'a', name: 'Sảnh Ngọc', source: 'SELECTED', unavailable: false }), 'Sảnh Ngọc')
    assert.equal(packageLabel({ id: 'a', name: 'Sảnh Ngọc', source: 'ORDER', unavailable: false }), 'Sảnh Ngọc (theo đơn)')
    assert.equal(packageLabel(null), 'Chưa có gói')
  })

  it('đơn vị giá và dòng chọn gói: theo bàn có phép tính, không đủ chỗ thì ghi rõ', () => {
    assert.equal(unitLabel('TABLE'), '/ bàn')
    assert.equal(unitLabel('PACKAGE'), '/ gói')
    const hall = { id: 'h', name: 'Sảnh A', price: 5_000_000, unit: 'TABLE' as const, cost: 150_000_000, capacity: 200, minTables: 30, fits: false }
    assert.equal(packageOptionText(hall, 250, 25), 'Sảnh A: 5.000.000đ / bàn, 30 bàn = 150.000.000đ. Không đủ cho 250 khách')
    const photo = { id: 'p', name: 'Gói 1', price: 18_000_000, unit: 'PACKAGE' as const, cost: 18_000_000, capacity: null, minTables: null, fits: true }
    assert.equal(packageOptionText(photo, 250, 25), 'Gói 1: 18.000.000đ / gói')
  })
})

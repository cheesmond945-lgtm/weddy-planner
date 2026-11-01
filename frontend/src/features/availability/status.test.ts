/*
 * Unit test cho status.ts (lịch khả dụng theo gói), chạy bằng test runner có sẵn của Node:
 *   npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { availabilityRequestText, calendarCells, monthGrid, monthLabel, shiftMonth, weekdayName } from './status.ts'

describe('lịch khả dụng', () => {
  it('lưới tháng bắt đầu thứ hai, đủ số ngày', () => {
    // 01/11/2026 là chủ nhật: 6 ô trống đầu
    const g = monthGrid('2026-11')
    assert.equal(g.indexOf('2026-11-01'), 6)
    assert.equal(g.filter(Boolean).length, 30)
    assert.equal(monthGrid('2027-02').filter(Boolean).length, 28)
  })

  it('ô lịch đủ tuần, có ngày của tháng trước và tháng sau', () => {
    // Tháng 10/2026: bắt đầu thứ năm, như trang Lịch làm việc (28, 29, 30/09 ... 01/11)
    const c = calendarCells('2026-10')
    assert.equal(c.length % 7, 0)
    assert.deepEqual(c[0], { date: '2026-09-28', inMonth: false })
    assert.deepEqual(c[3], { date: '2026-10-01', inMonth: true })
    assert.deepEqual(c[c.length - 1], { date: '2026-11-01', inMonth: false })
  })

  it('chuyển tháng qua năm, nhãn tháng, thứ trong tuần', () => {
    assert.equal(shiftMonth('2026-12', 1), '2027-01')
    assert.equal(shiftMonth('2027-01', -1), '2026-12')
    assert.equal(monthLabel('2026-11'), 'Tháng 11/2026')
    assert.equal(weekdayName('2026-11-28'), 'Thứ bảy')
  })

  it('tin soạn sẵn có ngày tổ chức, gói đang xem và trạng thái đang hiện', () => {
    const t = availabilityRequestText({ vendorName: 'Grand Lotus', packageName: 'Gold', date: '2026-11-28', status: 'AVAILABLE', guestCount: 300 })
    assert.match(t, /gói "Gold" vào ngày 28\/11\/2026 \(thứ bảy\), khoảng 300 khách\./)
    assert.match(t, /Lịch trên WebPlan đang hiển thị: Còn trống\./)
    assert.match(availabilityRequestText({ vendorName: 'A', packageName: 'B', date: null, status: null }), /chưa chốt ngày/)
  })
})

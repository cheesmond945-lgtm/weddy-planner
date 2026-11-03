/*
 * Unit test cho restPayment.ts (nhãn đợt 2 của hai phía), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { restLabel, vnDayMonth } from './restPayment.ts'

type O = Parameters<typeof restLabel>[0]
const order = (status: string, rest: { status: string; receivedDate?: string | null } | null): O =>
  ({ status, restPayment: rest && { amount: 6_700_000, receivedDate: null, ...rest } }) as unknown as O

describe('vnDayMonth', () => {
  it('đổi sang ngày giờ Việt Nam (UTC+7)', () => {
    assert.equal(vnDayMonth('2027-01-08T03:00:00.000Z'), '08/01')
    assert.equal(vnDayMonth('2027-01-08T18:00:00.000Z'), '09/01') // 01:00 sáng hôm sau giờ VN
  })
})

describe('restLabel', () => {
  const received = { status: 'Received', receivedDate: '2027-01-08T03:00:00.000Z' }

  it('NCC: Đã nhận dd/mm; Chưa nhận; Completed mà chưa nhận cùng chữ nhưng màu cam', () => {
    assert.deepEqual(restLabel(order('Deposited', received), 'VENDOR'), { text: 'Đã nhận 08/01', tone: 'ok' })
    assert.deepEqual(restLabel(order('Deposited', { status: 'Pending' }), 'VENDOR'), { text: 'Chưa nhận', tone: 'wait' })
    // Completed mà chưa nhận: cùng chữ "Chưa nhận", chỉ khác màu (warn = cam)
    assert.deepEqual(restLabel(order('Completed', { status: 'Pending' }), 'VENDOR'), { text: 'Chưa nhận', tone: 'warn' })
    assert.equal(restLabel(order('Completed', received), 'VENDOR').tone, 'ok')
  })

  it('khách: Đã thanh toán dd/mm; Chưa thanh toán (trả trực tiếp cho NCC)', () => {
    assert.deepEqual(restLabel(order('Completed', received), 'COUPLE'), { text: 'Đã thanh toán 08/01', tone: 'ok' })
    assert.deepEqual(restLabel(order('Deposited', { status: 'Pending' }), 'COUPLE'), { text: 'Chưa thanh toán (trả trực tiếp cho NCC)', tone: 'wait' })
    assert.equal(restLabel(order('Completed', { status: 'Pending' }), 'COUPLE').tone, 'wait') // khách không bị cảnh báo
  })

  it('đã hủy: "Không thu"; chưa cọc hoặc không có dữ liệu: "—"', () => {
    assert.deepEqual(restLabel(order('Cancelled', { status: 'NotApplicable' }), 'VENDOR'), { text: 'Không thu', tone: 'none' })
    assert.deepEqual(restLabel(order('Pending', { status: 'NotApplicable' }), 'COUPLE'), { text: '—', tone: 'none' })
    assert.deepEqual(restLabel(order('Deposited', null), 'VENDOR'), { text: '—', tone: 'none' })
  })

  it('Received mà thiếu ngày nhận: vẫn là đã nhận, không kèm ngày', () => {
    assert.equal(restLabel(order('Deposited', { status: 'Received' }), 'VENDOR').text, 'Đã nhận')
  })
})

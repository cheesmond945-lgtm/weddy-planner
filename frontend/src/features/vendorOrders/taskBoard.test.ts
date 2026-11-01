/*
 * Unit test cho taskBoard.ts (cột theo trạng thái, nhắc "Cần chốt lịch", hàng theo đơn), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { boardLanes, canMove, columnOf, needsScheduleConfirm, statusOfColumn } from './taskBoard.ts'

type T = Parameters<typeof boardLanes>[0][number]
const task = (extra: Partial<T> = {}): T =>
  ({ id: 't', title: 't', dueDate: '2027-03-10', isDone: false, status: 'Todo', owner: 'VENDOR', dateStatus: 'PLANNED', overdue: false, orderId: 'o1', orderCode: 'DH1', customerName: 'A', eventDate: '2027-03-20', packageNames: [], ...extra }) as T

describe('cột theo trạng thái', () => {
  it('Done là Đã xong, Waiting là Chờ khách làm, còn lại Cần làm', () => {
    assert.equal(columnOf({ isDone: true, status: 'Done' }), 'done')
    assert.equal(columnOf({ isDone: false, status: 'Waiting' }), 'customer')
    assert.equal(columnOf({ isDone: false, status: 'Todo' }), 'todo')
  })

  it('kéo sang cột nào thì thành trạng thái đó; kéo được mọi việc sang cột khác', () => {
    assert.equal(statusOfColumn('done'), 'Done')
    assert.equal(statusOfColumn('customer'), 'Waiting')
    assert.equal(statusOfColumn('todo'), 'Todo')
    assert.equal(canMove({ isDone: false, status: 'Todo' }, 'customer'), true)
    assert.equal(canMove({ isDone: false, status: 'Waiting' }, 'todo'), true)
    assert.equal(canMove({ isDone: false, status: 'Todo' }, 'todo'), false)
  })
})

describe('"Cần chốt lịch"', () => {
  const today = '2027-03-05'
  it('Hai bên, chưa xong, chưa chốt, hạn còn ≤ 7 ngày (kể cả đã quá hạn)', () => {
    assert.equal(needsScheduleConfirm({ owner: 'BOTH', isDone: false, dateStatus: 'PLANNED', dueDate: '2027-03-12' }, today), true)
    assert.equal(needsScheduleConfirm({ owner: 'BOTH', isDone: false, dateStatus: 'PLANNED', dueDate: '2027-03-01' }, today), true)
  })
  it('hạn còn > 7 ngày, đã chốt, đã xong, hoặc không phải Hai bên: không', () => {
    assert.equal(needsScheduleConfirm({ owner: 'BOTH', isDone: false, dateStatus: 'PLANNED', dueDate: '2027-03-13' }, today), false)
    assert.equal(needsScheduleConfirm({ owner: 'BOTH', isDone: false, dateStatus: 'CONFIRMED', dueDate: '2027-03-06' }, today), false)
    assert.equal(needsScheduleConfirm({ owner: 'BOTH', isDone: true, dateStatus: 'PLANNED', dueDate: '2027-03-06' }, today), false)
    assert.equal(needsScheduleConfirm({ owner: 'VENDOR', isDone: false, dateStatus: 'PLANNED', dueDate: '2027-03-06' }, today), false)
    assert.equal(needsScheduleConfirm({ owner: 'CUSTOMER', isDone: false, dateStatus: 'PLANNED', dueDate: '2027-03-06' }, today), false)
  })
})

describe('hàng theo đơn: gói và việc đã chốt lịch', () => {
  it('đếm việc đã chốt, lấy tên gói của đơn', () => {
    const lanes = boardLanes([task({ id: 'a', dateStatus: 'CONFIRMED', packageNames: ['Gói A', 'Gói B'] }), task({ id: 'b', isDone: true, status: 'Done' }), task({ id: 'c', status: 'Waiting' })], 'order')
    assert.equal(lanes.length, 1)
    assert.equal(lanes[0].total, 3)
    assert.equal(lanes[0].done, 1)
    assert.equal(lanes[0].confirmed, 1)
    assert.equal(lanes[0].packages, 'Gói A, Gói B')
    assert.equal(lanes[0].columns.customer.length, 1)
  })
  it('không gom: không có tên gói', () => {
    assert.equal(boardLanes([task({ packageNames: ['Gói A'] })], 'none')[0].packages, '')
  })
})

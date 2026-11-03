/*
 * Unit test cho taskBoard.ts (cột theo trạng thái, nhắc "Cần chốt lịch"), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canMove, columnOf, needsScheduleConfirm, statusOfColumn } from './taskBoard.ts'

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

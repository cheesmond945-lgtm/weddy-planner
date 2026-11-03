/*
 * Unit test cho taskPatch.ts (cập nhật lạc quan việc chi tiết, tiến độ tại chỗ), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { applyToCalendar, applyToTask, patchState, progressOf, stateOf, type TaskState } from './taskPatch.ts'

const TODAY = '2027-03-10'
const NOW = '2027-03-10T03:00:00.000Z'
const base: TaskState = { status: 'Todo', isDone: false, completedDate: null, dueDate: '2027-03-12', dateStatus: 'PLANNED', confirmedAt: null, overdue: false, needsRecheck: false }

describe('patchState', () => {
  it('Done: ghi ngày hoàn thành, hết quá hạn; về Todo / Waiting: xóa ngày, tính lại quá hạn', () => {
    const late = { ...base, dueDate: '2027-03-01', overdue: true }
    const done = patchState(late, { kind: 'status', status: 'Done' }, TODAY, NOW)
    assert.deepEqual([done.status, done.isDone, done.completedDate, done.overdue], ['Done', true, NOW, false])
    const back = patchState(done, { kind: 'status', status: 'Waiting' }, TODAY, NOW)
    assert.deepEqual([back.status, back.isDone, back.completedDate, back.overdue], ['Waiting', false, null, true])
  })

  it('chốt ngày: Đã chốt, giữ nguyên ngày; bỏ chốt: về Dự kiến', () => {
    const c = patchState({ ...base, needsRecheck: true }, { kind: 'confirm' }, TODAY, NOW)
    assert.deepEqual([c.dateStatus, c.confirmedAt, c.dueDate, c.needsRecheck], ['CONFIRMED', NOW, '2027-03-12', false])
    const u = patchState(c, { kind: 'unconfirm' }, TODAY, NOW)
    assert.deepEqual([u.dateStatus, u.confirmedAt, u.dueDate], ['PLANNED', null, '2027-03-12'])
  })

  it('đổi ngày = đổi ngày và chốt luôn; quá hạn tính lại theo ngày mới (việc đã xong không quá hạn)', () => {
    const d = patchState({ ...base, overdue: true, dueDate: '2027-03-01' }, { kind: 'date', date: '2027-03-20' }, TODAY, NOW)
    assert.deepEqual([d.dueDate, d.dateStatus, d.overdue], ['2027-03-20', 'CONFIRMED', false])
    assert.equal(patchState(base, { kind: 'date', date: '2027-03-05' }, TODAY, NOW).overdue, true)
    assert.equal(patchState({ ...base, isDone: true, status: 'Done' }, { kind: 'date', date: '2027-03-05' }, TODAY, NOW).overdue, false)
  })

  it('không đổi trạng thái gốc (hàm thuần)', () => {
    const copy = { ...base }
    patchState(base, { kind: 'status', status: 'Done' }, TODAY, NOW)
    assert.deepEqual(base, copy)
  })
})

describe('áp vào Bảng việc / Lịch', () => {
  it('applyToTask chỉ đổi các trường trạng thái', () => {
    const t = { id: 'a', title: 'x', owner: 'BOTH', ...base } as never as Parameters<typeof applyToTask>[0]
    const out = applyToTask(t, patchState(stateOf(t), { kind: 'date', date: '2027-03-20' }, TODAY, NOW))
    assert.equal(out.id, 'a')
    assert.equal(out.dueDate, '2027-03-20')
    assert.equal(out.dateStatus, 'CONFIRMED')
  })

  it('Lịch: dùng trường date; mục ORDER không bị đụng', () => {
    const task = { kind: 'TASK', id: 'a', date: '2027-03-12', isDone: false, status: 'Todo', dateStatus: 'PLANNED', overdue: false } as never as Parameters<typeof applyToCalendar>[0]
    const s = patchState(base, { kind: 'status', status: 'Done' }, TODAY, NOW)
    const out = applyToCalendar(task, s) as unknown as { date: string; isDone: boolean; status: string }
    assert.deepEqual([out.date, out.isDone, out.status], ['2027-03-12', true, 'Done'])
    const order = { kind: 'ORDER', id: 'o' } as never as Parameters<typeof applyToCalendar>[0]
    assert.equal(applyToCalendar(order, s), order)
  })
})

describe('progressOf: cùng cách tính với backend', () => {
  const t = (over: object) => ({ isDone: false, status: 'Todo', dueDate: '2027-03-20', title: 't', overdue: false, ...over }) as Parameters<typeof progressOf>[0][number]

  it('đếm xong, mở, trễ phía NCC / phía khách, sắp đến hạn; "tiếp theo" là việc phía NCC gần hạn nhất', () => {
    const p = progressOf(
      [t({ isDone: true, status: 'Done' }), t({ dueDate: '2027-03-05', overdue: true }), t({ status: 'Waiting', dueDate: '2027-03-05', overdue: true }), t({ dueDate: '2027-03-11' }), t({ status: 'Waiting', dueDate: '2027-03-11' }), t({ dueDate: '2027-03-30', title: 'xa' })],
      TODAY,
    )
    assert.deepEqual([p.total, p.done, p.open, p.overdueVendor, p.overdueCustomer, p.dueSoonVendor], [6, 1, 5, 1, 1, 1])
    assert.deepEqual(p.next, { due: '2027-03-05', title: 't' })
  })

  it('tick một việc: số việc chưa xong giảm, số trễ đổi ngay', () => {
    const items = [t({ dueDate: '2027-03-05', overdue: true }), t({})]
    assert.equal(progressOf(items, TODAY).overdueVendor, 1)
    const after = items.map((x, i) => (i === 0 ? { ...x, isDone: true, status: 'Done' as const, overdue: false } : x))
    const p = progressOf(after, TODAY)
    assert.deepEqual([p.open, p.done, p.overdueVendor], [1, 1, 0])
  })
})

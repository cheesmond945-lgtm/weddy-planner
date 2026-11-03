/*
 * Unit test cho packageTasks.ts (danh sách việc của gói đang sửa trên màn), chạy bằng: npm run test
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { canMove, countByOwner, fromServer, isDirty, move, offsetLabel, remove, sortByOffset, toRequest, upsert, validateTask, type TaskDraft } from './packageTasks.ts'

const t = (key: string, offsetDays: number, extra: Partial<TaskDraft> = {}): TaskDraft => ({ key, title: key, note: '', owner: 'VENDOR', offsetDays, ...extra })
const keys = (l: TaskDraft[]) => l.map((x) => x.key)

describe('nhãn mốc', () => {
  it('trước / đúng ngày / sau', () => {
    assert.equal(offsetLabel(-14), 'Trước 14 ngày')
    assert.equal(offsetLabel(0), 'Đúng ngày thực hiện')
    assert.equal(offsetLabel(3), 'Sau 3 ngày')
  })
})

describe('sắp theo mốc', () => {
  it('luôn theo offsetDays tăng dần, cùng mốc giữ thứ tự cũ', () => {
    assert.deepEqual(keys(sortByOffset([t('a', 3), t('b', -10), t('c', 0), t('d', -10)])), ['b', 'd', 'c', 'a'])
  })
  it('thêm việc mới chèn đúng chỗ theo mốc; cùng mốc nằm sau việc có sẵn', () => {
    assert.deepEqual(keys(upsert([t('a', -21), t('b', 0)], t('n', -21))), ['a', 'n', 'b'])
    assert.deepEqual(keys(upsert([t('a', -21), t('b', 0)], t('n', -30))), ['n', 'a', 'b'])
  })
  it('sửa mốc thì việc chuyển chỗ', () => {
    assert.deepEqual(keys(upsert([t('a', -21), t('b', 0)], t('a', 5))), ['b', 'a'])
  })
  it('fromServer xếp theo mốc', () => {
    const l = fromServer([
      { id: '2', title: 'B', note: null, owner: 'BOTH', offsetDays: 2, sortOrder: 0 },
      { id: '1', title: 'A', note: 'n', owner: 'CUSTOMER', offsetDays: -2, sortOrder: 1 },
    ])
    assert.deepEqual(keys(l), ['1', '2'])
    assert.equal(l[1].note, '')
  })
})

describe('↑ ↓ chỉ trong cùng mốc', () => {
  const l = [t('a', -5), t('b', -5), t('c', 0)]
  it('canMove', () => {
    assert.equal(canMove(l, 0, -1), false) // đầu danh sách
    assert.equal(canMove(l, 0, 1), true) // cùng mốc
    assert.equal(canMove(l, 1, 1), false) // khác mốc
    assert.equal(canMove(l, 2, -1), false)
  })
  it('move đổi chỗ khi cùng mốc, giữ nguyên khi khác mốc', () => {
    assert.deepEqual(keys(move(l, 0, 1)), ['b', 'a', 'c'])
    assert.equal(move(l, 1, 1), l)
  })
})

describe('đếm, xóa, gửi lên, thay đổi chưa lưu', () => {
  it('countByOwner', () => {
    assert.deepEqual(countByOwner([t('a', 0), t('b', 0, { owner: 'CUSTOMER' }), t('c', 0, { owner: 'BOTH' }), t('d', 0)]), { ALL: 4, VENDOR: 2, CUSTOMER: 1, BOTH: 1 })
  })
  it('remove theo key', () => {
    assert.deepEqual(keys(remove([t('a', 0), t('b', 0)], 'a')), ['b'])
  })
  it('toRequest: id chỉ có ở việc đã lưu, ghi chú rỗng thành null, theo thứ tự mảng', () => {
    const r = toRequest([t('x', -1, { id: 'id1', title: ' Tên ', note: '  ' }), t('y', 0, { note: ' ghi ' })])
    assert.deepEqual(r.tasks, [
      { id: 'id1', title: 'Tên', note: null, owner: 'VENDOR', offsetDays: -1 },
      { title: 'y', note: 'ghi', owner: 'VENDOR', offsetDays: 0 },
    ])
  })
  it('isDirty: đổi nội dung hoặc thứ tự là có thay đổi; giống nhau thì không', () => {
    const saved = [t('a', -5, { id: '1' }), t('b', -5, { id: '2' })]
    assert.equal(isDirty([...saved], saved), false)
    assert.equal(isDirty(move(saved, 0, 1), saved), true)
    assert.equal(isDirty([saved[0], { ...saved[1], title: 'khác' }], saved), true)
    assert.equal(isDirty([saved[0]], saved), true)
  })
})

describe('validateTask (dialog)', () => {
  const ok = { title: 'Thử váy', note: '', kind: 'before' as const, days: '21' }
  it('trước 21 ngày thành -21; sau 3 ngày thành +3; đúng ngày thành 0 (bỏ qua ô số)', () => {
    assert.equal(validateTask(ok).offsetDays, -21)
    assert.equal(validateTask({ ...ok, kind: 'after', days: '3' }).offsetDays, 3)
    assert.equal(validateTask({ ...ok, kind: 'on', days: '' }).offsetDays, 0)
  })
  it('tên bắt buộc ≤ 255, ghi chú ≤ 500', () => {
    assert.ok(validateTask({ ...ok, title: '  ' }).title)
    assert.ok(validateTask({ ...ok, title: 'x'.repeat(256) }).title)
    assert.ok(validateTask({ ...ok, note: 'x'.repeat(501) }).note)
    assert.equal(validateTask({ ...ok, title: 'x'.repeat(255), note: 'x'.repeat(500) }).offsetDays, -21)
  })
  it('mốc: trước ≤ 365, sau ≤ 120, số nguyên ≥ 1', () => {
    assert.equal(validateTask({ ...ok, days: '365' }).offsetDays, -365)
    for (const days of ['366', '0', '-1', '1.5', '', 'abc']) assert.ok(validateTask({ ...ok, days }).days, days)
    assert.equal(validateTask({ ...ok, kind: 'after', days: '120' }).offsetDays, 120)
    assert.ok(validateTask({ ...ok, kind: 'after', days: '121' }).days)
  })
})

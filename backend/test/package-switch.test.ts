/*
 * Đổi gói của đơn đã cọc (src/modules/weddings/timeline-rows.ts packageSwitchPlan), chạy bằng: npm test. Hàm thuần, không đụng CSDL.
 * Việc trùng tên giữa gói cũ và gói mới giữ tiến độ (dùng lại dòng cũ), việc chỉ gói cũ có thì bỏ, việc chỉ gói mới có thì tạo.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { packageChangeLock } from '../src/modules/orders/order-rules.ts';
import { packageSwitchPlan, pkgCode, taskNameKey, type PackageTaskRef } from '../src/modules/weddings/timeline-rows.ts';

const ORDER = 'oooooooo-oooo-4ooo-8ooo-oooooooooooo';
const task = (id: string, title: string, offsetDays = -10): PackageTaskRef => ({ id, title, note: null, owner: 'VENDOR', offsetDays });
const row = (id: string, taskId: string, title: string) => ({ id, code: pkgCode(taskId, ORDER), title });

// Gói cũ P1: a1 "Tư vấn ý tưởng" (đã xong), a2 "Chốt bảng màu", a3 "Giao hoa"; gói giữ nguyên K: k1
const rowTasks = new Map([
  ['a1', { packageId: 'P1', title: 'Tư vấn ý tưởng' }],
  ['a2', { packageId: 'P1', title: 'Chốt bảng màu' }],
  ['a3', { packageId: 'P1', title: 'Giao hoa' }],
  ['k1', { packageId: 'K', title: 'Thử món' }],
]);
const rows = [row('r1', 'a1', 'Tư vấn ý tưởng'), row('r2', 'a2', 'Chốt bảng màu'), row('r3', 'a3', 'Giao hoa'), row('r4', 'k1', 'Thử món')];
const base = { weddingId: 'w', orderId: ORDER, categoryId: 'c', ctx: { today: '2026-11-05', event: '2026-12-20', deposit: '2026-11-01' }, rows, rowTasks, removedPackageIds: new Set(['P1']) };

describe('packageSwitchPlan: đổi gói sau cọc', () => {
  it('việc trùng tên (bỏ dấu, hoa thường, khoảng trắng) dùng lại dòng cũ: đổi mã sang việc mới, giữ trạng thái', () => {
    const p = packageSwitchPlan({ ...base, added: [task('b1', 'tu van  Y TUONG'), task('b2', 'Chốt bảng màu')] });
    assert.deepEqual(p.relink.map((r) => [r.id, r.task_code]), [['r1', pkgCode('b1', ORDER)], ['r2', pkgCode('b2', ORDER)]]);
    assert.equal(p.create.length, 0);
    assert.deepEqual(p.kept, ['tu van  Y TUONG', 'Chốt bảng màu']);
  });
  it('việc chỉ gói mới có thì tạo; việc chỉ gói cũ có thì bỏ (kể cả đã xong)', () => {
    const p = packageSwitchPlan({ ...base, added: [task('b1', 'Tư vấn ý tưởng'), task('b9', 'Cắm hoa bàn tiệc')] });
    assert.deepEqual(p.create.map((r) => r.task_code), [pkgCode('b9', ORDER)]);
    assert.deepEqual(p.deleteIds.sort(), ['r2', 'r3']);
    assert.deepEqual(p.removedTitles.sort(), ['Chốt bảng màu', 'Giao hoa']);
    assert.deepEqual(p.addedTitles, ['Cắm hoa bàn tiệc']);
  });
  it('việc của gói vẫn giữ trong đơn không bị đụng tới', () => {
    const p = packageSwitchPlan({ ...base, added: [] });
    assert.ok(!p.deleteIds.includes('r4'));
    assert.ok(!p.relink.some((r) => r.id === 'r4'));
  });
  it('mỗi dòng cũ chỉ dùng lại một lần (gói mới có hai việc cùng tên thì việc thứ hai tạo mới)', () => {
    const p = packageSwitchPlan({ ...base, added: [task('b1', 'Giao hoa'), task('b2', 'Giao hoa')] });
    assert.equal(p.relink.length, 1);
    assert.equal(p.create.length, 1);
  });
  it('taskNameKey', () => {
    assert.equal(taskNameKey('  Đặt  Cọc  '), 'dat coc');
  });
});

describe('packageChangeLock: khi nào khách không yêu cầu đổi gói được', () => {
  const base = { deposited: true, today: '2026-11-05', eventDate: '2026-12-20', done: 0, total: 10 };
  it('đơn chưa cọc hoặc còn xa ngày, chưa làm nhiều: đổi được', () => {
    assert.equal(packageChangeLock({ ...base, deposited: false, done: 9 }), null);
    assert.equal(packageChangeLock({ ...base, done: 4 }), null);
  });
  it('NCC đã xong từ 50% việc của gói: khóa', () => {
    assert.match(packageChangeLock({ ...base, done: 5 })!, /5\/10 việc/);
  });
  it('còn dưới 7 ngày tới ngày thực hiện: khóa (đúng 7 ngày vẫn đổi được)', () => {
    assert.match(packageChangeLock({ ...base, eventDate: '2026-11-11' })!, /dưới 7 ngày/);
    assert.equal(packageChangeLock({ ...base, eventDate: '2026-11-12' }), null);
  });
  it('gói không có việc nào: chỉ xét ngày', () => {
    assert.equal(packageChangeLock({ ...base, total: 0 }), null);
  });
});

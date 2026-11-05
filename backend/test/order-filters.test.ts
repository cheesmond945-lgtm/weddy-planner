import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { needsActionWhere, parseStatusFilter, restPendingWhere, tileWheres } from '../src/modules/orders/order-filters.ts';

describe('lọc trạng thái nhiều giá trị (tab Hết hạn / Hủy)', () => {
  it('một hoặc nhiều trạng thái hợp lệ', () => {
    assert.deepEqual(parseStatusFilter('Deposited'), { statuses: ['Deposited'] });
    assert.deepEqual(parseStatusFilter('Expired, Cancelled'), { statuses: ['Expired', 'Cancelled'] });
    assert.deepEqual(parseStatusFilter(undefined), { statuses: [] });
  });
  it('trạng thái lạ: báo lỗi', () => assert.ok('error' in parseStatusFilter('Expired,Foo')));
});

describe('bộ lọc Cần bạn xử lý / Chưa nhận tiền mặt', () => {
  it('cần xử lý = Chờ chỉnh sửa hoặc Đã cọc có yêu cầu đang chờ', () => {
    assert.deepEqual(needsActionWhere(), { OR: [{ status: 'NeedRevision' }, { status: 'Deposited', order_revisions: { some: { status: 'Requested' } } }] });
  });
  it('chưa nhận tiền mặt = Đã cọc / Hoàn thành mà không có việc PAY: Done', () => {
    const w = restPendingWhere();
    assert.deepEqual(w.status, { in: ['Deposited', 'Completed'] });
    assert.deepEqual(w.NOT, { timeline_tasks: { some: { task_code: { startsWith: 'PAY:' }, status: 'Done' } } });
  });
});

describe('điều kiện đếm của 4 thẻ', () => {
  const soon = new Date('2026-11-04T12:00:00Z');
  const w = tileWheres({ today: '2026-11-03', in30: '2026-12-03', soon });
  it('chờ cọc và sắp hết hạn', () => {
    assert.deepEqual(w.pending, { status: 'Pending' });
    assert.deepEqual(w.expiringSoon, { status: 'Pending', deposit_due_date: { lte: soon } });
  });
  it('sắp thực hiện: Đã cọc, từ hôm nay tới hôm nay + 30 ngày (gồm hai đầu)', () => {
    assert.deepEqual(w.upcoming, { status: 'Deposited', event_date: { gte: new Date('2026-11-03T00:00:00Z'), lte: new Date('2026-12-03T00:00:00Z') } });
  });
  it('đến hạn hoàn tất: Đã cọc, ngày thực hiện trước hôm nay; kèm điều kiện chưa nhận tiền mặt', () => {
    assert.deepEqual(w.dueToComplete, { status: 'Deposited', event_date: { lt: new Date('2026-11-03T00:00:00Z') } });
    assert.deepEqual(w.dueRestPending.AND[1], restPendingWhere());
  });
});

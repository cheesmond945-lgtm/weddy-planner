import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BUSY_ORDER_STATUSES, busyDatesOf, busyDays, hallBusyMessage, hallConflict, hallsFreeOn, type BusyOrder, type ManualBusy } from '../src/modules/halls/hall-busy.ts';

/** Hồi quy sau khi bỏ tính năng giờ ngày cưới: lịch bận sảnh (theo ngày) và chặn HALL_BUSY phải giữ nguyên. */
const order = (extra: Partial<BusyOrder> = {}): BusyOrder => ({ orderId: 'o1', orderCode: 'DH26110001', customerName: 'A', packageId: 'h1', date: '2027-06-15', status: 'Deposited', ...extra });
const manual: ManualBusy[] = [{ id: 'm1', packageId: 'h1', startDate: '2027-06-20', endDate: '2027-06-22', reason: 'Bảo trì' }];

describe('lịch bận sảnh (theo ngày)', () => {
  it('đơn Đã cọc / Hoàn thành làm sảnh bận; đơn chờ cọc thì không', () => {
    assert.deepEqual(BUSY_ORDER_STATUSES, ['Deposited', 'Completed']);
    assert.equal(hallConflict('h1', '2027-06-15', [order()], [])?.kind, 'ORDER');
    assert.equal(hallConflict('h1', '2027-06-15', [order({ status: 'Completed' })], [])?.kind, 'ORDER');
    assert.equal(hallConflict('h1', '2027-06-15', [order({ status: 'Pending' })], []), null);
  });

  it('bận thủ công theo khoảng ngày; bỏ qua chính đơn đang kiểm (exceptOrderId)', () => {
    assert.equal(hallConflict('h1', '2027-06-21', [], manual)?.kind, 'MANUAL');
    assert.equal(hallConflict('h1', '2027-06-23', [], manual), null);
    assert.equal(hallConflict('h1', '2027-06-15', [order()], [], 'o1'), null);
  });

  it('busyDays / busyDatesOf trải từng ngày và chỉ lấy đúng sảnh', () => {
    assert.equal(busyDays([order()], manual, '2027-06-01', '2027-06-30').length, 4);
    assert.deepEqual(busyDatesOf('h1', [order(), order({ orderId: 'o2', packageId: 'h2', date: '2027-06-16' })], [], '2027-06-01', '2027-06-30'), ['2027-06-15']);
  });

  it('hallsFreeOn đếm sảnh còn trống; lời báo HALL_BUSY khác nhau cho NCC và khách', () => {
    assert.deepEqual(hallsFreeOn([{ id: 'h1', vendorId: 'v' }, { id: 'h2', vendorId: 'v' }], [order()], [], '2027-06-15'), { v: { halls: 2, free: 1 } });
    const src = hallConflict('h1', '2027-06-15', [order()], [])!;
    assert.match(hallBusyMessage('VENDOR', 'Sảnh A', '2027-06-15', src), /đơn DH26110001 đã đặt cọc/);
    assert.match(hallBusyMessage('COUPLE', 'Sảnh A', '2027-06-15', src), /đã có khách khác đặt cọc/);
  });
});

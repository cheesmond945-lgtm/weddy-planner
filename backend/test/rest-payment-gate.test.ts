import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { completedChatText } from '../src/modules/orders/order-rules.ts';
import { applyRestReceived, clearRestGate, clearRestReceived, type RestDb } from '../src/modules/orders/rest-payment.ts';
import { payCode } from '../src/modules/weddings/timeline-rows.ts';

describe('Bỏ ghi nhận tiền mặt khi đã có hóa đơn cuối', () => {
  it('đã có hóa đơn cuối: 409 REST_PAYMENT_HAS_FINAL_INVOICE kèm mã hóa đơn, thông báo tiếng Việt', () => {
    const e = clearRestGate('HD26110003');
    assert.ok(e);
    assert.equal(e.status, 409);
    assert.equal(e.code, 'REST_PAYMENT_HAS_FINAL_INVOICE');
    assert.equal(e.message, 'Đơn đã xuất hóa đơn cuối HD26110003, không thể bỏ ghi nhận tiền mặt.');
    assert.deepEqual(e.details, { invoiceCode: 'HD26110003' });
  });

  it('chưa có hóa đơn cuối: cho bỏ ghi nhận (việc PAY Done về Waiting, xóa ngày nhận); ghi nhận lại được', async () => {
    assert.equal(clearRestGate(null), null);
    const row = { id: 't1', order_id: 'o1', task_code: payCode('o1'), status: 'Done', completed_date: new Date('2027-01-08T03:00:00Z') as Date | null };
    const db = {
      timeline_tasks: {
        async findFirst() { return row; },
        async create() {},
        async update({ data }: { data: Record<string, unknown> }) { Object.assign(row, data); },
        async updateMany({ data }: { data: Record<string, unknown> }) { Object.assign(row, data); return { count: row.status === 'Waiting' ? 1 : 0 }; },
      },
    } as unknown as RestDb;
    assert.equal(await clearRestReceived(db, 'o1'), true);
    assert.equal(row.status, 'Waiting');
    assert.equal(row.completed_date, null);
    assert.equal(await applyRestReceived(db, { id: 'o1', wedding_id: 'w', category_id: 'c', event_date: new Date('2027-01-20T00:00:00Z'), vendorName: 'A' }, new Date('2027-01-09T00:00:00Z')), true);
    assert.equal(row.status, 'Done');
  });
});

describe('tin hệ thống khi hoàn thành', () => {
  it('NCC bấm tay và hệ thống tự hoàn tất có nội dung khác nhau', () => {
    const manual = completedChatText('DH26110002', 'VENDOR');
    const auto = completedChatText('DH26110002', 'SYSTEM');
    assert.notEqual(manual, auto);
    assert.match(manual, /NCC đã hoàn tất đơn DH26110002/);
    assert.match(auto, /tự hoàn tất .* hơn 7 ngày/);
  });
});

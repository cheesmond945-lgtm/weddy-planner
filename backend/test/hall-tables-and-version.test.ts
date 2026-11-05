/*
 * Số bàn tối thiểu của sảnh (hallTablesIssue) và phiên bản đơn chống lưu đè (orderVersionOf, assertOrderFresh), chạy bằng: npm test
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertOrderFresh, hallTablesIssue, orderVersionOf } from '../src/modules/orders/order-rules.ts';

const hall = { id: 'h1', name: 'Sảnh Vàng', minTables: 20 };

describe('hallTablesIssue: tạo / lưu nháp / gửi đơn mới', () => {
  it('dòng sảnh dưới tối thiểu bị chặn với đúng thông báo', () => {
    const r = hallTablesIssue([{ quantity: 10, packageId: 'h1' }], hall);
    assert.deepEqual(r, { index: 0, message: 'Sảnh Sảnh Vàng đặt tối thiểu 20 bàn.' });
  });
  it('đủ tối thiểu, dòng không gắn sảnh, sảnh không có quy tắc: qua', () => {
    assert.equal(hallTablesIssue([{ quantity: 20, packageId: 'h1' }], hall), null);
    assert.equal(hallTablesIssue([{ quantity: 1, packageId: null }, { quantity: 2, packageId: 'other' }], hall), null);
    assert.equal(hallTablesIssue([{ quantity: 1, packageId: 'h1' }], { ...hall, minTables: null }), null);
  });
  it('báo đúng vị trí dòng sai', () => {
    assert.equal(hallTablesIssue([{ quantity: 1, packageId: null }, { quantity: 5, packageId: 'h1' }], hall)?.index, 1);
  });
});

describe('hallTablesIssue: sửa đơn', () => {
  const prior = { hallId: 'h1', items: [{ id: 'i1', quantity: 12 }] };
  it('đơn cũ dưới tối thiểu mà không đổi dòng sảnh thì không kiểm', () => {
    assert.equal(hallTablesIssue([{ id: 'i1', quantity: 12, packageId: 'h1' }], hall, prior), null);
  });
  it('đổi số lượng dòng sảnh mà vẫn dưới tối thiểu thì chặn; lên đủ thì qua', () => {
    assert.ok(hallTablesIssue([{ id: 'i1', quantity: 15, packageId: 'h1' }], hall, prior));
    assert.equal(hallTablesIssue([{ id: 'i1', quantity: 20, packageId: 'h1' }], hall, prior), null);
  });
  it('đổi sang sảnh khác thì kiểm theo sảnh mới', () => {
    assert.ok(hallTablesIssue([{ id: 'i1', quantity: 12, packageId: 'h2' }], { id: 'h2', name: 'Sảnh Bạc', minTables: 30 }, prior));
  });
});

describe('orderVersionOf / assertOrderFresh: chặn lưu đè', () => {
  const row = () => ({
    status: 'Pending',
    customer_name: 'A',
    customer_phone: '0900000000',
    event_date: new Date('2026-12-20'),
    note: null as string | null,
    deposit_percent: 30,
    package_id: 'h1',
    total_amount: 10_000_000,
    order_items: [{ id: 'i1', item_name: 'Tiệc', unit: 'Bàn', quantity: 20, unit_price: 500_000, package_id: 'h1' as string | null }],
  });
  it('cùng nội dung thì cùng phiên bản (không phụ thuộc thứ tự dòng)', () => {
    const a = row();
    const b = row();
    b.order_items = [{ id: 'i0', item_name: 'x', unit: 'Gói', quantity: 1, unit_price: 1, package_id: null }, ...b.order_items];
    a.order_items = [...b.order_items].reverse();
    assert.equal(orderVersionOf(a), orderVersionOf(b));
  });
  it('đổi trạng thái, ngày, tổng, ghi chú, dòng đều đổi phiên bản', () => {
    const v = orderVersionOf(row());
    for (const f of [(r: ReturnType<typeof row>) => (r.status = 'Deposited'), (r: ReturnType<typeof row>) => (r.event_date = new Date('2026-12-21')), (r: ReturnType<typeof row>) => (r.total_amount = 11), (r: ReturnType<typeof row>) => (r.note = 'x'), (r: ReturnType<typeof row>) => (r.order_items[0].id = 'i9')]) {
      const r = row();
      f(r);
      assert.notEqual(orderVersionOf(r), v);
    }
  });
  it('phiên bản cũ bị 409 ORDER_STALE kèm thông báo; đúng phiên bản hoặc không gửi thì qua', () => {
    const cur = orderVersionOf(row());
    assert.doesNotThrow(() => assertOrderFresh(cur, cur));
    assert.doesNotThrow(() => assertOrderFresh(undefined, cur));
    try {
      assertOrderFresh('cu', cur);
      assert.fail('phải ném lỗi');
    } catch (e) {
      const err = e as { getStatus: () => number; getResponse: () => { code: string; message: string } };
      assert.equal(err.getStatus(), 409);
      assert.equal(err.getResponse().code, 'ORDER_STALE');
      assert.equal(err.getResponse().message, 'Đơn đã được cập nhật ở nơi khác, vui lòng mở lại.');
    }
  });
});

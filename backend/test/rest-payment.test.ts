/*
 * Ghi nhận đợt 2 (tiền mặt phần còn lại) bằng việc PAY:<orderId> (src/modules/orders/rest-payment.ts), chạy bằng: npm test
 * Dùng hàm thuần và CSDL giả trong bộ nhớ, không ghi CSDL thật.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { applyRestReceived, clearRestReceived, closableDetailTasksWhere, completeGate, finalInvoiceGate, isRestPayCode, recordsRestPayment, restPaymentOf, type RestDb, type RestPayment } from '../src/modules/orders/rest-payment.ts';
import { payCode } from '../src/modules/weddings/timeline-rows.ts';

const ORDER = '316cdbcb-6f17-4a12-a897-975fd77970ab';
const NOW = new Date('2027-01-08T03:00:00Z');
const order = (extra = {}) => ({ id: ORDER, wedding_id: 'w1', category_id: 'cat', event_date: new Date('2027-01-06T00:00:00Z'), vendorName: 'White Rose Bridal', ...extra });

interface Row {
  id: string;
  order_id: string;
  task_code: string;
  status: string;
  completed_date: Date | null;
  scheduled_date: Date | null;
  title?: string;
}

/** timeline_tasks giả: đủ cho applyRestReceived / clearRestReceived. */
function fakeDb(rows: Row[]) {
  const created: Record<string, unknown>[] = [];
  const db: RestDb = {
    timeline_tasks: {
      async findFirst(args) {
        const w = (args as { where: { order_id: string; task_code: string } }).where;
        return rows.find((r) => r.order_id === w.order_id && r.task_code === w.task_code) ?? null;
      },
      async findMany(args) {
        const w = (args as { where: { order_id: string } }).where;
        return rows.filter((r) => r.order_id === w.order_id).map((r) => ({ scheduled_date: r.scheduled_date }));
      },
      async create({ data }) {
        created.push(data);
        rows.push({ id: `new${created.length}`, order_id: data.order_id as string, task_code: data.task_code as string, status: data.status as string, completed_date: data.completed_date as Date, scheduled_date: data.scheduled_date as Date });
      },
      async update({ where, data }) {
        Object.assign(rows.find((r) => r.id === where.id)!, data);
      },
      async updateMany(args) {
        const { where, data } = args as { where: { order_id: string; task_code: string; status: string }; data: Record<string, unknown> };
        const hit = rows.filter((r) => r.order_id === where.order_id && r.task_code === where.task_code && r.status === where.status);
        hit.forEach((r) => Object.assign(r, data));
        return { count: hit.length };
      },
    },
  };
  return { db, rows, created };
}
const payRow = (status: string, completed: Date | null = null): Row => ({ id: 'pay1', order_id: ORDER, task_code: payCode(ORDER), status, completed_date: completed, scheduled_date: new Date('2027-01-13T00:00:00Z') });

describe('restPaymentOf: trạng thái đợt 2 suy từ việc PAY', () => {
  const o = (status: string | null) => ({ status, total: 7_900_000, deposit: 1_200_000 });

  it('số tiền = tổng − cọc', () => {
    assert.equal(restPaymentOf(o('Deposited'), null).amount, 6_700_000);
    assert.equal(restPaymentOf({ status: 'Deposited', total: 100, deposit: 300 }, null).amount, 0);
  });

  it('Deposited / Completed: PAY Done là Received kèm ngày nhận; còn lại là Pending', () => {
    const received = restPaymentOf(o('Deposited'), payRow('Done', NOW));
    assert.deepEqual(received, { amount: 6_700_000, status: 'Received', receivedDate: NOW.toISOString() });
    for (const status of ['Waiting', 'Todo']) assert.equal(restPaymentOf(o('Deposited'), payRow(status)).status, 'Pending', status);
    assert.equal(restPaymentOf(o('Completed'), payRow('Waiting')).status, 'Pending');
    assert.equal(restPaymentOf(o('Completed'), payRow('Done', NOW)).status, 'Received');
  });

  it('đơn cũ không có việc PAY: Pending (Deposited / Completed)', () => {
    assert.equal(restPaymentOf(o('Deposited'), null).status, 'Pending');
    assert.equal(restPaymentOf(o('Completed'), undefined).status, 'Pending');
  });

  it('chưa cọc / hết hạn / đã hủy: NotApplicable, kể cả khi còn việc PAY Done', () => {
    for (const status of ['Draft', 'Pending', 'NeedRevision', 'Expired', 'Cancelled', null]) {
      assert.deepEqual(restPaymentOf(o(status), payRow('Done', NOW)), { amount: 6_700_000, status: 'NotApplicable', receivedDate: null }, String(status));
    }
  });
});

describe('ghi nhận / bỏ ghi nhận', () => {
  it('ghi nhận: việc PAY Waiting thành Done, completed_date = ngày nhận; trả true', async () => {
    const { db, rows } = fakeDb([payRow('Waiting')]);
    assert.equal(await applyRestReceived(db, order(), NOW), true);
    assert.deepEqual([rows[0].status, rows[0].completed_date], ['Done', NOW]);
  });

  it('ghi nhận lần hai: không đổi gì, trả false (không báo khách lần nữa)', async () => {
    const first = new Date('2027-01-07T00:00:00Z');
    const { db, rows } = fakeDb([payRow('Done', first)]);
    assert.equal(await applyRestReceived(db, order(), NOW), false);
    assert.equal(rows[0].completed_date, first);
  });

  it('thiếu việc PAY (đơn cũ): tự tạo giống lúc cọc, đã Done, hạn = max(E+7, hạn lớn nhất)', async () => {
    const other: Row = { id: 'x', order_id: ORDER, task_code: 'ATTIRE_FIT_FIRST', status: 'Todo', completed_date: null, scheduled_date: new Date('2027-01-20T00:00:00Z') };
    const { db, rows, created } = fakeDb([other]);
    assert.equal(await applyRestReceived(db, order(), NOW), true);
    assert.equal(rows.length, 2);
    const c = created[0];
    assert.equal(c.task_code, payCode(ORDER));
    assert.equal(c.status, 'Done');
    assert.equal(c.completed_date, NOW);
    assert.equal(c.order_id, ORDER);
    assert.equal(c.task_type, 'Detail');
    assert.equal(c.title, 'Thanh toán phần còn lại cho White Rose Bridal');
    assert.equal((c.scheduled_date as Date).toISOString().slice(0, 10), '2027-01-20'); // việc cuối 20/01 > E+7 = 13/01
    // không có việc nào khác: hạn = E + 7
    const bare = fakeDb([]);
    await applyRestReceived(bare.db, order(), NOW);
    assert.equal((bare.created[0].scheduled_date as Date).toISOString().slice(0, 10), '2027-01-13');
  });

  it('đơn không có đám cưới thì không tạo được việc', async () => {
    const { db, created } = fakeDb([]);
    assert.equal(await applyRestReceived(db, order({ wedding_id: null }), NOW), false);
    assert.equal(created.length, 0);
  });

  it('bỏ ghi nhận: Done về Waiting, xóa ngày nhận; chưa ghi nhận thì không làm gì', async () => {
    const { db, rows } = fakeDb([payRow('Done', NOW)]);
    assert.equal(await clearRestReceived(db, ORDER), true);
    assert.deepEqual([rows[0].status, rows[0].completed_date], ['Waiting', null]);
    assert.equal(await clearRestReceived(db, ORDER), false);
  });

  it('ghi nhận rồi bỏ rồi ghi nhận lại: lại là Received', async () => {
    const { db, rows } = fakeDb([payRow('Waiting')]);
    await applyRestReceived(db, order(), NOW);
    await clearRestReceived(db, ORDER);
    assert.equal(await applyRestReceived(db, order(), NOW), true);
    assert.equal(rows[0].status, 'Done');
  });
});

describe('kéo việc PAY sang Done = ghi nhận', () => {
  it('chỉ việc PAY:<orderId> sang Done mới là ghi nhận; việc khác hay trạng thái khác thì không', () => {
    assert.equal(recordsRestPayment(payCode(ORDER), 'Done'), true);
    assert.equal(recordsRestPayment(payCode(ORDER), 'Waiting'), false);
    assert.equal(recordsRestPayment(payCode(ORDER), 'Todo'), false);
    assert.equal(recordsRestPayment('PKG:abc:316cdbcb', 'Done'), false);
    assert.equal(recordsRestPayment('ATTIRE_PAY', 'Done'), false);
    assert.equal(recordsRestPayment(null, 'Done'), false);
    assert.equal(isRestPayCode(payCode(ORDER)), true);
  });
});

describe('Hoàn tất đơn', () => {
  const rest = (status: RestPayment['status']): RestPayment => ({ amount: 6_700_000, status, receivedDate: status === 'Received' ? NOW.toISOString() : null });

  it('đã Received: hoàn tất bình thường, không cần restReceived', () => {
    assert.equal(completeGate(rest('Received'), undefined), 'ok');
    assert.equal(completeGate(rest('Received'), false), 'ok');
  });

  it('chưa Received và không gửi restReceived: 409 REST_PAYMENT_NOT_RECORDED kèm số tiền', () => {
    for (const body of [undefined, false, 'true', 1, null]) {
      const g = completeGate(rest('Pending'), body);
      assert.ok(typeof g === 'object' && g.status === 409 && g.code === 'REST_PAYMENT_NOT_RECORDED', String(body));
      assert.equal((g as { details?: { amount: number } }).details?.amount, 6_700_000);
    }
  });

  it('chưa Received mà restReceived = true (đúng boolean): ghi nhận rồi hoàn tất', () => {
    assert.equal(completeGate(rest('Pending'), true), 'record');
  });

  it('hoàn thành đơn (và tự hoàn thành sau E+7) KHÔNG đóng việc PAY; vẫn đóng việc chưa Done khác kể cả Waiting', () => {
    const w = closableDetailTasksWhere(ORDER) as { order_id: string; task_type: string; status: { not: string }; OR: unknown[] };
    assert.equal(w.order_id, ORDER);
    assert.equal(w.task_type, 'Detail');
    assert.deepEqual(w.status, { not: 'Done' });
    assert.deepEqual(w.OR, [{ task_code: null }, { NOT: { task_code: { startsWith: 'PAY:' } } }]);
  });
});

describe('Hóa đơn cuối', () => {
  it('chặn khi chưa ghi nhận (Pending hoặc không áp dụng): 409 REST_PAYMENT_NOT_RECORDED', () => {
    for (const status of ['Pending', 'NotApplicable'] as const) {
      const g = finalInvoiceGate({ amount: 6_700_000, status, receivedDate: null });
      assert.ok(g && g.status === 409 && g.code === 'REST_PAYMENT_NOT_RECORDED', status);
    }
  });

  it('cho khi đã Received', () => {
    assert.equal(finalInvoiceGate({ amount: 6_700_000, status: 'Received', receivedDate: NOW.toISOString() }), null);
  });
});

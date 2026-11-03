/*
 * Việc RIÊNG của từng đơn đã cọc: thêm ('ORD:'), sửa, bỏ việc khỏi đơn (src/modules/orders/order-task-rules.ts, weddings/timeline-rows.ts, task-owner.ts),
 * chạy bằng: npm test. Hàm thuần, không đụng CSDL (phần truy vấn của OrderTasksService xem docs/TIMELINE.md, mục "Việc riêng của đơn").
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkVendorTaskEdit, editOrderTaskIssue, parseNewOrderTask, parseOrderTaskPatch, removeOrderTaskIssue } from '../src/modules/orders/order-task-rules.ts';
import { ownerOf } from '../src/modules/weddings/task-owner.ts';
import { calendarItems } from '../src/modules/weddings/calendar-items.ts';
import { isCustomOrderTaskCode, orderTaskRows, ordCode, ordCodeWithOwner, ordOwnerOf, payCode, pkgCode, replanOrderTasks, type PackageTaskRef } from '../src/modules/weddings/timeline-rows.ts';

const isErr = (x: unknown): x is { code: string; status: number } => typeof x === 'object' && x !== null && 'code' in x;
const CTX = { today: '2027-01-10', event: '2027-03-20' };
const ORDER_X = '11111111-aaaa-bbbb-cccc-000000000001';
const ORDER_Y = '22222222-aaaa-bbbb-cccc-000000000002';

describe("mã việc riêng 'ORD:'", () => {
  it('dạng ORD:<chủ>:<8 ngẫu nhiên>:<8 đầu order_id>, ≤ 50 ký tự, nhận ra được', () => {
    const code = ordCode('CUSTOMER', ORDER_X, 'a1b2c3d4');
    assert.equal(code, 'ORD:C:a1b2c3d4:11111111');
    assert.ok(code.length <= 50);
    assert.equal(isCustomOrderTaskCode(code), true);
    assert.equal(isCustomOrderTaskCode(pkgCode('p1', ORDER_X)), false);
    assert.equal(isCustomOrderTaskCode(payCode(ORDER_X)), false);
    assert.equal(isCustomOrderTaskCode('ORD:X:aaaaaaaa:bbbbbbbb'), false);
    assert.equal(isCustomOrderTaskCode(null), false);
  });

  it('ownerOf đọc chủ từ chính mã; đổi chủ giữ phần còn lại của mã', () => {
    assert.equal(ownerOf(ordCode('CUSTOMER', ORDER_X, 'aaaaaaaa')), 'CUSTOMER');
    assert.equal(ownerOf(ordCode('VENDOR', ORDER_X, 'aaaaaaaa')), 'VENDOR');
    assert.equal(ownerOf(ordCode('BOTH', ORDER_X, 'aaaaaaaa')), 'BOTH');
    assert.equal(ordOwnerOf('PKG:abc'), null);
    assert.equal(ordCodeWithOwner('ORD:C:a1b2c3d4:11111111', 'VENDOR'), 'ORD:V:a1b2c3d4:11111111');
  });

  it('hai lần thêm cùng đơn cho hai mã khác nhau (ngẫu nhiên)', () => {
    assert.notEqual(ordCode('BOTH', ORDER_X, 'aaaaaaaa'), ordCode('BOTH', ORDER_X, 'bbbbbbbb'));
  });
});

describe('parseNewOrderTask (POST /vendors/me/orders/:id/tasks)', () => {
  const ok = { title: ' Gửi mẫu thiệp ', note: ' bản in thử ', owner: 'VENDOR', date: '2027-02-01' };

  it('hợp lệ: cắt khoảng trắng, addToPackage mặc định false', () => {
    const r = parseNewOrderTask(ok, CTX);
    assert.ok(!isErr(r));
    assert.deepEqual(r, { title: 'Gửi mẫu thiệp', note: 'bản in thử', owner: 'VENDOR', date: '2027-02-01', addToPackage: false });
    assert.equal((parseNewOrderTask({ ...ok, addToPackage: true }, CTX) as { addToPackage: boolean }).addToPackage, true);
  });

  it('tên trống, owner sai, ghi chú quá dài, addToPackage sai kiểu: 400', () => {
    for (const bad of [{ ...ok, title: '  ' }, { ...ok, title: undefined }, { ...ok, owner: 'ADMIN' }, { ...ok, note: 'x'.repeat(501) }, { ...ok, addToPackage: 'yes' }]) {
      const r = parseNewOrderTask(bad, CTX);
      assert.ok(isErr(r) && r.status === 400);
    }
  });

  it('ngày: không trước hôm nay, không quá E + 120 (đúng E + 120 thì được)', () => {
    assert.ok(isErr(parseNewOrderTask({ ...ok, date: '2027-01-09' }, CTX)));
    assert.ok(!isErr(parseNewOrderTask({ ...ok, date: '2027-01-10' }, CTX)));
    assert.ok(!isErr(parseNewOrderTask({ ...ok, date: '2027-07-18' }, CTX)));
    assert.ok(isErr(parseNewOrderTask({ ...ok, date: '2027-07-19' }, CTX)));
    assert.ok(isErr(parseNewOrderTask({ ...ok, date: '01/02/2027' }, CTX)));
  });
});

describe('sửa việc riêng', () => {
  it('chỉ sửa được việc ORD: chưa xong', () => {
    assert.equal(editOrderTaskIssue({ task_code: ordCode('BOTH', ORDER_X, 'aaaaaaaa'), status: 'Todo' }), null);
    assert.equal(editOrderTaskIssue({ task_code: pkgCode('p1', ORDER_X), status: 'Todo' })?.code, 'TASK_NOT_EDITABLE');
    assert.equal(editOrderTaskIssue({ task_code: payCode(ORDER_X), status: 'Waiting' })?.code, 'TASK_NOT_EDITABLE');
    assert.equal(editOrderTaskIssue({ task_code: ordCode('BOTH', ORDER_X, 'aaaaaaaa'), status: 'Done' })?.code, 'TASK_ALREADY_DONE');
  });

  it('parseOrderTaskPatch: ít nhất một trường; owner phải hợp lệ; ghi chú trống = xóa ghi chú', () => {
    assert.deepEqual(parseOrderTaskPatch({ title: ' Mới ' }), { title: 'Mới' });
    assert.deepEqual(parseOrderTaskPatch({ note: '' }), { note: null });
    assert.deepEqual(parseOrderTaskPatch({ owner: 'CUSTOMER' }), { owner: 'CUSTOMER' });
    assert.ok(isErr(parseOrderTaskPatch({})));
    assert.ok(isErr(parseOrderTaskPatch({ owner: 'X' })));
    assert.ok(isErr(parseOrderTaskPatch({ title: '' })));
  });
});

describe('bỏ việc khỏi đơn', () => {
  it("cho việc 'PKG:' và 'ORD:' chưa xong", () => {
    assert.equal(removeOrderTaskIssue({ task_code: pkgCode('p1', ORDER_Y), status: 'Todo' }), null);
    assert.equal(removeOrderTaskIssue({ task_code: pkgCode('p1', ORDER_Y), status: 'Waiting' }), null);
    assert.equal(removeOrderTaskIssue({ task_code: ordCode('VENDOR', ORDER_Y, 'aaaaaaaa'), status: 'Todo' }), null);
  });

  it("KHÔNG bỏ việc thanh toán 'PAY:' (kể cả chưa xong), việc đã Done, việc chi tiết cũ", () => {
    assert.equal(removeOrderTaskIssue({ task_code: payCode(ORDER_Y), status: 'Waiting' })?.code, 'TASK_NOT_REMOVABLE');
    assert.equal(removeOrderTaskIssue({ task_code: pkgCode('p1', ORDER_Y), status: 'Done' })?.code, 'TASK_ALREADY_DONE');
    assert.equal(removeOrderTaskIssue({ task_code: ordCode('BOTH', ORDER_Y, 'aaaaaaaa'), status: 'Done' })?.code, 'TASK_ALREADY_DONE');
    assert.equal(removeOrderTaskIssue({ task_code: 'DECOR_FINAL', status: 'Todo' })?.code, 'TASK_NOT_REMOVABLE');
    assert.equal(removeOrderTaskIssue({ task_code: null, status: 'Todo' })?.code, 'TASK_NOT_REMOVABLE');
  });

  it('quyền: chỉ đơn Deposited (đơn chưa cọc / đã hủy / hoàn thành bị 409); việc không thuộc đơn bị 404', () => {
    for (const s of ['Pending', 'Cancelled', 'Completed', null]) assert.equal(checkVendorTaskEdit({ orderStatus: s, taskOfOrder: true })?.status, 409);
    assert.equal(checkVendorTaskEdit({ orderStatus: 'Deposited', taskOfOrder: false })?.status, 404);
    assert.equal(checkVendorTaskEdit({ orderStatus: 'Deposited', taskOfOrder: true }), null);
  });
});

describe('đơn đã tùy chỉnh: sinh bù không làm việc đã bỏ hiện lại', () => {
  const tasks: PackageTaskRef[] = [
    { id: 't-a', title: 'Gửi mẫu', note: null, owner: 'VENDOR', offsetDays: -14 },
    { id: 't-b', title: 'Duyệt mẫu', note: null, owner: 'CUSTOMER', offsetDays: -7 },
    { id: 't-c', title: 'Giao hàng', note: null, owner: 'BOTH', offsetDays: 0 },
  ];
  const gen = (orderId: string, existing?: Set<string>) =>
    orderTaskRows({ weddingId: 'w1', orderId, categoryId: 'cat', vendorName: 'NCC', ctx: { ...{ today: '2027-01-10', event: '2027-03-20', deposit: '2027-01-10' } }, tasks, existingCodes: existing });

  it('hai đơn cùng gói: bỏ 1 việc PKG của đơn Y không đụng đơn X, repair không sinh lại việc đã bỏ của Y', () => {
    const x = gen(ORDER_X).rows;
    const y = gen(ORDER_Y).rows;
    assert.equal(x.length, 4);
    // Y bỏ việc t-b
    const yAfter = y.filter((r) => r.task_code !== pkgCode('t-b', ORDER_Y));
    const yRepair = gen(ORDER_Y, new Set(yAfter.map((r) => r.task_code)));
    assert.deepEqual(yRepair.rows, []);
    assert.equal(yRepair.vendorProcessMissing, false);
    // X vẫn đủ, mã của X không đổi
    const xRepair = gen(ORDER_X, new Set(x.map((r) => r.task_code)));
    assert.deepEqual(xRepair.rows, []);
    assert.ok(x.some((r) => r.task_code === pkgCode('t-b', ORDER_X)));
  });

  it("đơn chỉ còn việc 'ORD:' + 'PAY:' (bỏ hết việc gói rồi thêm việc riêng) cũng không sinh lại việc gói", () => {
    const have = new Set([ordCode('BOTH', ORDER_Y, 'aaaaaaaa'), payCode(ORDER_Y)]);
    const r = gen(ORDER_Y, have);
    assert.deepEqual(r.rows, []);
    assert.equal(r.vendorProcessMissing, false);
  });

  it('đơn chưa có việc gói nào (mới cọc) vẫn sinh đủ', () => {
    const r = gen(ORDER_Y, new Set());
    assert.equal(r.rows.length, 4);
  });

  it("NCC đổi ngày thực hiện: việc 'ORD:' giữ nguyên ngày (replan chỉ động tới PKG / PAY)", () => {
    const plan = replanOrderTasks({
      ctx: { today: '2027-01-10', event: '2027-04-20', deposit: '2027-01-10' },
      tasks: [
        { id: 'k1', code: pkgCode('t-a', ORDER_X), status: 'Todo', confirmed: false, date: '2027-03-06' },
        { id: 'k2', code: ordCode('BOTH', ORDER_X, 'aaaaaaaa'), status: 'Todo', confirmed: false, date: '2027-02-01' },
      ],
      offsets: new Map([['t-a', -14]]),
    });
    assert.deepEqual(plan.updates.map((u) => u.id), ['k1']);
  });
});

describe('addToPackage: offset = ngày - E', () => {
  it('ngày việc riêng so với E cho đúng offset_days của việc thêm vào gói', () => {
    const offset = (date: string, event: string) => Math.round((Date.parse(date) - Date.parse(event)) / 86_400_000);
    assert.equal(offset('2027-03-06', '2027-03-20'), -14);
    assert.equal(offset('2027-03-20', '2027-03-20'), 0);
    assert.equal(offset('2027-03-27', '2027-03-20'), 7);
  });
});

describe('lịch NCC: việc riêng', () => {
  it('việc ORD: hiện trong lịch kèm cờ isCustomOrderTask, chủ lấy từ mã', () => {
    const order = { id: ORDER_X, code: 'DH1', status: 'Deposited', eventDate: '2027-03-20', customerName: 'A & B' };
    const items = calendarItems({
      orders: [],
      tasks: [{ id: 'k2', code: ordCode('CUSTOMER', ORDER_X, 'aaaaaaaa'), title: 'Gửi ảnh', due: '2027-02-01', done: false, status: 'Waiting', confirmed: true, owner: ownerOf(ordCode('CUSTOMER', ORDER_X, 'aaaaaaaa')), order }],
      from: '2027-02-01',
      to: '2027-02-28',
      today: '2027-01-10',
    });
    assert.equal(items.length, 1);
    const t = items[0];
    assert.ok(t.kind === 'TASK' && t.isCustomOrderTask && !t.isPackageTask && t.owner === 'CUSTOMER');
  });
});

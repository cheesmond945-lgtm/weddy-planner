/*
 * Việc chi tiết của đơn: chủ việc, quyền NCC / khách, chốt ngày, nhắc hạn, tiến độ (src/modules/orders/order-task-rules.ts,
 * src/modules/weddings/task-owner.ts, calendar-items.ts), chạy bằng: npm test. Hàm thuần, không đụng CSDL.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarItems } from '../src/modules/weddings/calendar-items.ts';
import { LEGACY_OWNER, orderProgress, ownerOf, reminderStage, remindersFor, type TaskOwner } from '../src/modules/weddings/task-owner.ts';
import { checkVendorTaskEdit, customerReadonlyIssue, dateStatusOf, parseStatusBody, scheduleDateIssue } from '../src/modules/orders/order-task-rules.ts';

const isErr = (x: unknown): x is { code: string; status: number } => typeof x === 'object' && x !== null && 'code' in x;

describe('ownerOf', () => {
  const owners = new Map<string, TaskOwner>([['abc', 'CUSTOMER'], ['def', 'VENDOR'], ['ghi', 'BOTH']]);

  it("'PKG:<id>' lấy owner trong package_tasks; thiếu thì hai bên", () => {
    assert.equal(ownerOf('PKG:abc', owners), 'CUSTOMER');
    assert.equal(ownerOf('PKG:def', owners), 'VENDOR');
    assert.equal(ownerOf('PKG:ghi', owners), 'BOTH');
    assert.equal(ownerOf('PKG:missing', owners), 'BOTH');
    assert.equal(ownerOf('PKG:abc'), 'BOTH');
  });

  it("'PAY:' là khách; mã khung, mã lạ, việc khách tự thêm là hai bên", () => {
    assert.equal(ownerOf('PAY:order-1'), 'CUSTOMER');
    assert.equal(ownerOf('SELF_RINGS'), 'BOTH');
    assert.equal(ownerOf('VENUE_BOOK'), 'BOTH');
    assert.equal(ownerOf('MA_LA'), 'BOTH');
    assert.equal(ownerOf(null), 'BOTH');
    assert.equal(ownerOf(undefined), 'BOTH');
  });

  it('34 mã chi tiết cũ giữ đúng chủ như trước đợt 2', () => {
    assert.equal(Object.keys(LEGACY_OWNER).length, 34);
    const by = (o: TaskOwner) => Object.entries(LEGACY_OWNER).filter(([, v]) => v === o).map(([k]) => k).sort();
    assert.deepEqual(by('CUSTOMER'), ['ATTIRE_PAY', 'ATTIRE_RETURN', 'DECOR_BRIEF', 'DECOR_PAY', 'FLOWER_PAY', 'FLOWER_PICK_STYLE', 'MAKEUP_PAY', 'PHOTO_PAY', 'PHOTO_PICK_EDIT', 'PHOTO_REVIEW', 'VENUE_PAY']);
    assert.deepEqual(by('VENDOR'), ['DECOR_EVENT', 'MAKEUP_EVENT', 'PHOTO_ALBUM_SHOOT', 'PHOTO_EVENT', 'VENUE_EVENT']);
    assert.equal(by('BOTH').length, 18);
    assert.ok(by('BOTH').includes('FLOWER_EVENT') && by('BOTH').includes('ATTIRE_FIT_FIRST'));
    assert.equal(ownerOf('ATTIRE_RETURN'), 'CUSTOMER');
    assert.equal(ownerOf('PHOTO_ALBUM_SHOOT'), 'VENDOR');
    assert.equal(ownerOf('FLOWER_EVENT'), 'BOTH');
  });
});

describe('NCC đổi trạng thái (setStatus)', () => {
  it('nhận Todo | Waiting | Done cho việc của mọi chủ việc (khách, thanh toán, việc cũ)', () => {
    for (const owner of ['CUSTOMER', 'VENDOR', 'BOTH'] as const) for (const status of ['Todo', 'Waiting', 'Done']) assert.equal(parseStatusBody({ status }, owner), status);
  });

  it('status lạ: 400; thiếu cả status và isDone: 400', () => {
    for (const body of [{ status: 'Doing' }, { status: '' }, { status: null }, {}, null, undefined, { isDone: 'true' }]) {
      const r = parseStatusBody(body as never, 'VENDOR');
      assert.ok(isErr(r) && r.status === 400 && r.code === 'VALIDATION_ERROR', JSON.stringify(body));
    }
  });

  it('tương thích FE cũ: isDone true là Done; false là trạng thái mặc định theo chủ việc', () => {
    assert.equal(parseStatusBody({ isDone: true }, 'CUSTOMER'), 'Done');
    assert.equal(parseStatusBody({ isDone: false }, 'CUSTOMER'), 'Waiting');
    assert.equal(parseStatusBody({ isDone: false }, 'VENDOR'), 'Todo');
    assert.equal(parseStatusBody({ isDone: false }, 'BOTH'), 'Todo');
    assert.equal(parseStatusBody({ status: 'Todo', isDone: true }, 'VENDOR'), 'Todo'); // status thắng
  });

  it('đơn không Deposited: 409 ORDER_NOT_ACTIVE; việc không thuộc đơn: 404; hợp lệ: null', () => {
    for (const orderStatus of ['Draft', 'Pending', 'NeedRevision', 'Completed', 'Cancelled', 'Expired', null]) {
      assert.deepEqual(checkVendorTaskEdit({ orderStatus, taskOfOrder: true }), { code: 'ORDER_NOT_ACTIVE', message: 'Chỉ cập nhật tiến độ khi đơn đang ở trạng thái Đã đặt cọc.', status: 409 });
    }
    assert.deepEqual(checkVendorTaskEdit({ orderStatus: 'Deposited', taskOfOrder: false })?.status, 404);
    assert.equal(checkVendorTaskEdit({ orderStatus: 'Deposited', taskOfOrder: true }), null);
    // thứ tự: đơn không còn hiệu lực được báo trước
    assert.equal(checkVendorTaskEdit({ orderStatus: 'Completed', taskOfOrder: false })?.status, 409);
  });
});

describe('khách chỉ xem việc gắn đơn', () => {
  it('mọi việc có order_id: 403 TIMELINE_ITEM_READONLY (tick, đổi hạn, đổi tên, xóa)', () => {
    const r = customerReadonlyIssue({ order_id: 'o1' });
    assert.equal(r?.status, 403);
    assert.equal(r?.code, 'TIMELINE_ITEM_READONLY');
  });

  it('việc khung và việc khách tự thêm (không có order_id) giữ nguyên quyền', () => {
    assert.equal(customerReadonlyIssue({ order_id: null }), null);
  });
});

describe('chốt / đổi ngày', () => {
  const ctx = { today: '2026-12-10', event: '2027-03-20' };

  it('hợp lệ: từ hôm nay đến E + 120', () => {
    for (const d of ['2026-12-10', '2027-03-20', '2027-07-18']) assert.equal(scheduleDateIssue(d, ctx), null, d);
  });

  it('trước hôm nay hoặc quá E + 120: lỗi', () => {
    assert.equal(scheduleDateIssue('2026-12-09', ctx)?.code, 'DUE_DATE_OUT_OF_RANGE');
    assert.equal(scheduleDateIssue('2027-07-19', ctx)?.code, 'DUE_DATE_OUT_OF_RANGE');
  });

  it('việc phải xong trước ngày thực hiện (beforeEvent): không trùng hoặc sau E, vẫn tính từ hôm nay', () => {
    const before = { ...ctx, beforeEvent: true };
    for (const d of ['2026-12-10', '2027-03-19']) assert.equal(scheduleDateIssue(d, before), null, d);
    for (const d of ['2027-03-20', '2027-03-21', '2026-12-09']) assert.equal(scheduleDateIssue(d, before)?.code, 'DUE_DATE_OUT_OF_RANGE', d);
    // việc khác (không beforeEvent) vẫn chọn được đúng ngày thực hiện
    assert.equal(scheduleDateIssue('2027-03-20', ctx), null);
  });

  it('sai định dạng: 400', () => {
    for (const d of ['', '20/03/2027', '2027-13-45', null, undefined, 5]) assert.equal(scheduleDateIssue(d, ctx)?.status, 400, String(d));
  });

  it('dateStatus: chốt rồi là CONFIRMED kèm confirmedAt; chưa chốt là PLANNED', () => {
    const at = new Date('2026-12-05T01:00:00Z');
    assert.deepEqual(dateStatusOf(new Date('2027-03-01T00:00:00Z'), at, { due: '2027-03-01', event: '2027-03-20', isPackageBefore: true }), { dateStatus: 'CONFIRMED', confirmedAt: at.toISOString(), needsRecheck: false });
    assert.deepEqual(dateStatusOf(null, null, { due: '2027-03-01', event: '2027-03-20' }), { dateStatus: 'PLANNED', confirmedAt: null, needsRecheck: false });
  });

  it('needsRecheck: đã chốt, việc trước E, ngày chốt sau E hiện tại', () => {
    const c = new Date('2027-03-25T00:00:00Z');
    assert.equal(dateStatusOf(c, c, { due: '2027-03-25', event: '2027-03-20', isPackageBefore: true }).needsRecheck, true);
    assert.equal(dateStatusOf(c, c, { due: '2027-03-25', event: '2027-03-20', isPackageBefore: false }).needsRecheck, false);
    assert.equal(dateStatusOf(null, null, { due: '2027-03-25', event: '2027-03-20', isPackageBefore: true }).needsRecheck, false);
  });
});

describe("'Waiting' được tính là chưa xong (không chỉ 'Todo')", () => {
  const today = '2027-03-10';
  const t = (status: string, due: string, owner: TaskOwner = 'VENDOR') => ({ due, done: status === 'Done', owner, title: 'x', status });

  it('orderProgress: việc thanh toán đợt 2 (restPayment) quá hạn KHÔNG tính trễ, vẫn là việc mở', () => {
    const p = orderProgress([{ due: '2027-03-05', done: false, owner: 'CUSTOMER', status: 'Waiting', restPayment: true }], '2027-03-20');
    assert.equal(p.open, 1);
    assert.equal(p.overdueCustomer, 0);
    assert.equal(p.overdueVendor, 0);
  });

  it('orderProgress: việc Waiting là việc mở; quá hạn Waiting tính phía khách, quá hạn Todo tính phía NCC', () => {
    const p = orderProgress([t('Done', '2027-03-01'), t('Todo', '2027-03-05'), t('Waiting', '2027-03-05', 'CUSTOMER'), t('Waiting', '2027-03-20', 'CUSTOMER'), t('Todo', '2027-03-11')], today);
    assert.equal(p.total, 5);
    assert.equal(p.done, 1);
    assert.equal(p.open, 4);
    assert.equal(p.overdueVendor, 1);
    assert.equal(p.overdueCustomer, 1);
    assert.equal(p.dueSoonVendor, 1);
    assert.deepEqual(p.next, { due: '2027-03-05', title: 'x' }); // Waiting không phải việc tiếp theo của NCC
  });

  it('dữ liệu cũ không có status: suy theo chủ việc như trước', () => {
    const p = orderProgress([{ due: '2027-03-05', done: false, owner: 'CUSTOMER' }, { due: '2027-03-05', done: false, owner: 'BOTH' }], today);
    assert.equal(p.overdueCustomer, 1);
    assert.equal(p.overdueVendor, 1);
  });

  const base = { title: 'Gửi ảnh', orderCode: 'DH001', vendorName: 'Studio A', due: '2027-03-11', owner: 'CUSTOMER' as const };

  it('nhắc khách: việc Waiting sắp đến hạn "Bạn cần làm"; không nhắc NCC', () => {
    const r = remindersFor({ ...base, status: 'Waiting' }, 'DUE_SOON');
    assert.deepEqual(r.map((x) => x.to), ['COUPLE']);
    assert.match(r[0].content, /Bạn cần làm: "Gửi ảnh".*Studio A/);
  });

  it('nhắc NCC: việc Todo sắp đến hạn; không nhắc khách', () => {
    const r = remindersFor({ ...base, owner: 'VENDOR', status: 'Todo' }, 'DUE_SOON');
    assert.deepEqual(r.map((x) => x.to), ['VENDOR']);
  });

  it('quá hạn: NCC nhận cho mọi việc chưa Done; khách nhận khi việc chờ khách, hoặc việc NCC (VENDOR) trễ', () => {
    assert.deepEqual(remindersFor({ ...base, status: 'Waiting' }, 'OVERDUE').map((x) => x.to).sort(), ['COUPLE', 'VENDOR']);
    assert.deepEqual(remindersFor({ ...base, owner: 'VENDOR', status: 'Todo' }, 'OVERDUE').map((x) => x.to).sort(), ['COUPLE', 'VENDOR']);
    assert.deepEqual(remindersFor({ ...base, owner: 'BOTH', status: 'Todo' }, 'OVERDUE').map((x) => x.to), ['VENDOR']);
  });

  it('reminderStage không phụ thuộc trạng thái: sắp đến hạn 0–2 ngày, quá hạn 1–14 ngày', () => {
    assert.equal(reminderStage('2027-03-12', today), 'DUE_SOON');
    assert.equal(reminderStage('2027-03-09', today), 'OVERDUE');
    assert.equal(reminderStage('2027-03-20', today), null);
  });
});

describe('lịch làm việc của NCC', () => {
  const order = { id: 'o1', code: 'DH001', status: 'Deposited', eventDate: '2027-03-20', customerName: 'A' };
  const items = (tasks: Parameters<typeof calendarItems>[0]['tasks']) => calendarItems({ orders: [order], tasks, from: '2027-03-01', to: '2027-03-31', today: '2027-03-10' });

  it('việc đúng ngày thực hiện KHÔNG còn bị ẩn (không còn nhánh lọc theo mẫu EVENT)', () => {
    const r = items([{ id: 't1', code: 'PKG:abc', title: 'Thực hiện', due: '2027-03-20', done: false, status: 'Todo', owner: 'VENDOR', order }]);
    assert.equal(r.filter((i) => i.kind === 'TASK').length, 1);
    assert.equal(r.filter((i) => i.kind === 'ORDER').length, 1);
  });

  it('việc Waiting hiện với owner, status; NCC đổi được mọi việc (canTick luôn true)', () => {
    const r = items([{ id: 't1', code: 'PKG:abc', title: 'Gửi ảnh', due: '2027-03-05', done: false, status: 'Waiting', owner: 'CUSTOMER', order }]);
    const task = r.find((i) => i.kind === 'TASK')!;
    assert.equal(task.kind === 'TASK' && task.status, 'Waiting');
    assert.equal(task.kind === 'TASK' && task.canTick, true);
    assert.equal(task.kind === 'TASK' && task.overdue, true);
  });

  it('việc chi tiết cũ không có owner truyền vào: suy theo LEGACY_OWNER', () => {
    const r = items([{ id: 't1', code: 'ATTIRE_RETURN', title: 'Trả đồ', due: '2027-03-22', done: false, order }]);
    const task = r.find((i) => i.kind === 'TASK')!;
    assert.equal(task.kind === 'TASK' && task.owner, 'CUSTOMER');
  });
});

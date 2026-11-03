/*
 * Việc chi tiết của đơn lấy từ package_tasks của gói (src/modules/weddings/timeline-rows.ts, order-package-sync.ts), chạy bằng: npm test
 * Dùng hàm thuần và CSDL giả trong bộ nhớ, không ghi CSDL thật.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { syncOrderPackageTasks, type SyncDb } from '../src/modules/weddings/order-package-sync.ts';
import { packagesOfOrder } from '../src/modules/weddings/package-task-meta.ts';
import { cancelPlan, frameRows, initialStatus, orderTaskRows, payDate, payCode, pkgCode, pkgTaskIdOf, replanOrderTasks, taskTitle, type OrderTaskState, type PackageTaskRef, type TaskRow } from '../src/modules/weddings/timeline-rows.ts';
import { TIMELINE_TEMPLATES } from '../src/modules/weddings/timeline-templates.ts';

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const ORDER = 'order-1';
const E = '2027-03-20';
const task = (id: string, offsetDays: number, extra: Partial<PackageTaskRef> = {}): PackageTaskRef => ({ id, title: `Việc ${id}`, note: null, owner: 'VENDOR', offsetDays, ...extra });
const rowsOf = (tasks: PackageTaskRef[], ctx = { today: '2026-12-01', event: E, deposit: '2026-12-01' }, existingCodes?: Set<string>) =>
  orderTaskRows({ weddingId: 'w1', orderId: ORDER, categoryId: 'cat', vendorName: 'Studio A', ctx, tasks, existingCodes });

describe('frameRows', () => {
  it('31 dòng khung, task_type Frame, không gắn đơn, status Todo', () => {
    const rows = frameRows(TIMELINE_TEMPLATES, { weddingId: 'w1', wedding: E, today: '2026-12-19', services: [{ key: 'decor', categoryId: 'c-decor' }] });
    assert.ok(rows.length > 0 && rows.length <= 31);
    assert.ok(rows.every((r) => r.task_type === 'Frame' && r.order_id === null && r.status === 'Todo'));
  });
});

describe('orderTaskRows: việc chi tiết của đơn từ gói', () => {
  it('trạng thái ban đầu: việc của khách Waiting, NCC / hai bên Todo; việc thanh toán Waiting', () => {
    const { rows } = rowsOf([task('a', -7, { owner: 'CUSTOMER' }), task('b', -3, { owner: 'VENDOR' }), task('c', 0, { owner: 'BOTH' })]);
    const st = new Map(rows.map((r) => [r.task_code, r.status]));
    assert.equal(st.get(pkgCode('a', ORDER)), 'Waiting');
    assert.equal(st.get(pkgCode('b', ORDER)), 'Todo');
    assert.equal(st.get(pkgCode('c', ORDER)), 'Todo');
    assert.equal(st.get(payCode(ORDER)), 'Waiting');
    assert.equal(initialStatus('CUSTOMER'), 'Waiting');
  });

  it('1 gói: mỗi việc một dòng PKG:<id>, thêm đúng một dòng PAY:<orderId>; gắn đơn, loại Detail, display_order theo thứ tự', () => {
    const { rows, vendorProcessMissing } = rowsOf([task('a', -14), task('b', 0)]);
    assert.equal(vendorProcessMissing, false);
    assert.deepEqual(rows.map((r) => r.task_code), [pkgCode('a', ORDER), pkgCode('b', ORDER), payCode(ORDER)]);
    assert.ok(rows.every((r) => r.order_id === ORDER && r.category_id === 'cat' && r.task_type === 'Detail' && r.wedding_id === 'w1'));
    assert.ok(rows[0].display_order < rows[1].display_order && rows[1].display_order < rows[2].display_order);
  });

  it('2 gói: việc của cả hai gói gộp, giữ thứ tự đưa vào, mã không trùng', () => {
    const { rows } = rowsOf([task('p1-a', -10), task('p1-b', -5), task('p2-a', -10), task('p2-b', 2)]);
    assert.deepEqual(rows.filter((r) => r.task_code.startsWith('PKG:')).map((r) => r.task_code), [pkgCode('p1-a', ORDER), pkgCode('p1-b', ORDER), pkgCode('p2-a', ORDER), pkgCode('p2-b', ORDER)]);
    assert.equal(new Set(rows.map((r) => r.task_code)).size, rows.length);
    assert.equal(rows.filter((r) => r.task_code.startsWith('PAY:')).length, 1);
  });

  it('gói không có việc / đơn không gắn gói: chỉ sinh việc thanh toán, vendorProcessMissing = true', () => {
    const { rows, vendorProcessMissing } = rowsOf([]);
    assert.equal(vendorProcessMissing, true);
    assert.deepEqual(rows.map((r) => r.task_code), [payCode(ORDER)]);
    assert.equal(ymd(rows[0].scheduled_date), '2027-03-27'); // E + 7
    assert.equal(rows[0].title, 'Thanh toán phần còn lại cho Studio A');
  });

  it('hạn thanh toán = max(E+7, hạn lớn nhất của việc gói)', () => {
    assert.equal(ymd(rowsOf([task('a', -5)]).rows.at(-1)!.scheduled_date), '2027-03-27');
    assert.equal(ymd(rowsOf([task('a', 20)]).rows.at(-1)!.scheduled_date), '2027-04-09'); // E + 20 > E + 7
    assert.equal(payDate(E, '2027-03-01'), '2027-03-27');
    assert.equal(payDate(E, '2027-05-01'), '2027-05-01');
  });

  it('cọc muộn: không việc gói nào trước D+2, thứ tự giữ nguyên', () => {
    const ctx = { today: '2027-03-10', event: E, deposit: '2027-03-10' };
    const { rows } = rowsOf([task('a', -30), task('b', -14), task('c', -3), task('d', 0)], ctx);
    const gói = rows.filter((r) => r.task_code.startsWith('PKG:')).map((r) => ymd(r.scheduled_date));
    for (const d of gói) assert.ok(d >= '2027-03-12', d);
    assert.deepEqual([...gói].sort(), gói);
  });

  it('title ghép ghi chú và cắt ≤ 255 ký tự', () => {
    assert.equal(taskTitle('Gửi ảnh', 'JPG hoặc PNG'), 'Gửi ảnh — JPG hoặc PNG');
    assert.equal(taskTitle('Gửi ảnh', null), 'Gửi ảnh');
    assert.equal(taskTitle('Gửi ảnh', '  '), 'Gửi ảnh');
    const long = taskTitle('x'.repeat(250), 'y'.repeat(200));
    assert.equal(long.length, 255);
    assert.ok(long.endsWith('…'));
  });

  it('bỏ qua mã đã có: chạy lại không sinh trùng', () => {
    const first = rowsOf([task('a', -7), task('b', 0)]).rows;
    const again = rowsOf([task('a', -7), task('b', 0)], undefined, new Set(first.map((r) => r.task_code)));
    assert.equal(again.rows.length, 0);
    // Đã có bất kỳ việc nào gắn đơn: không sinh thêm gì (việc 'b' có thể do NCC đã bỏ)
    const partial = rowsOf([task('a', -7), task('b', 0)], undefined, new Set([pkgCode('a', ORDER)]));
    assert.deepEqual(partial.rows, []);
    // Chỉ còn việc thanh toán (NCC đã bỏ hết việc gói): cũng không sinh lại
    const payOnly = rowsOf([task('a', -7), task('b', 0)], undefined, new Set([payCode(ORDER)]));
    assert.deepEqual(payOnly.rows, []);
    assert.equal(payOnly.vendorProcessMissing, false);
    assert.equal(partial.vendorProcessMissing, false);
  });
});

describe('packagesOfOrder', () => {
  it('sảnh của đơn hợp gói của các dòng, bỏ null, bỏ trùng', () => {
    assert.deepEqual(packagesOfOrder({ package_id: 'h1', order_items: [{ package_id: 'p1' }, { package_id: null }, { package_id: 'h1' }, { package_id: 'p2' }] }), ['h1', 'p1', 'p2']);
    assert.deepEqual(packagesOfOrder({ package_id: null, order_items: [{ package_id: null }] }), []);
    assert.deepEqual(packagesOfOrder({}), []);
  });
});

/** CSDL giả cho syncOrderPackageTasks: ghi lại các dòng đã tạo, không có CSDL thật. */
function fakeDb(opts: { order?: Partial<Awaited<ReturnType<SyncDb['orders']['findUnique']>>> | null; pkgTasks?: { id: string; package_id: string; title: string; note: string | null; owner: string; offset_days: number }[]; existing?: string[] }) {
  const created: TaskRow[] = [];
  const order = opts.order === null ? null : { id: ORDER, wedding_id: 'w1', event_date: new Date(`${E}T00:00:00Z`), package_id: null, order_items: [], vendor_profiles: { category_id: 'cat', business_name: 'Studio A' }, payments: { paid_date: new Date('2026-12-01T03:00:00Z') }, ...opts.order };
  const db: SyncDb = {
    orders: { findUnique: async () => order as never },
    package_tasks: { findMany: async (args) => (opts.pkgTasks ?? []).filter((t) => ((args as { where: { package_id: { in: string[] } } }).where.package_id.in).includes(t.package_id)) },
    timeline_tasks: {
      findMany: async () => (opts.existing ?? []).map((task_code) => ({ task_code })),
      createMany: async ({ data }) => void created.push(...(data as TaskRow[])),
    },
  };
  return { db, created };
}
const pt = (id: string, package_id: string, offset_days: number, owner = 'VENDOR') => ({ id, package_id, title: `Việc ${id}`, note: null, owner, offset_days });

describe('syncOrderPackageTasks (CSDL giả)', () => {
  const NOW = new Date('2026-12-01T05:00:00Z');

  it('1 gói: sinh việc của gói + PAY, status theo owner', async () => {
    const { db, created } = fakeDb({ order: { order_items: [{ package_id: 'P1' }] }, pkgTasks: [pt('a', 'P1', -14, 'CUSTOMER'), pt('b', 'P1', -3), pt('x', 'OTHER', -3)] });
    const r = await syncOrderPackageTasks(db, ORDER, NOW);
    assert.deepEqual(r, { created: 3, vendorProcessMissing: false });
    assert.deepEqual(created.map((c) => [c.task_code, c.status]), [[pkgCode('a', ORDER), 'Waiting'], [pkgCode('b', ORDER), 'Todo'], [payCode(ORDER), 'Waiting']]);
  });

  it('2 gói (một là sảnh của đơn, một ở dòng hạng mục): gộp việc của cả hai', async () => {
    const { db, created } = fakeDb({ order: { package_id: 'HALL', order_items: [{ package_id: 'P2' }] }, pkgTasks: [pt('h1', 'HALL', -10), pt('p1', 'P2', -5)] });
    const r = await syncOrderPackageTasks(db, ORDER, NOW);
    assert.equal(r.created, 3);
    assert.deepEqual(created.map((c) => c.task_code), [pkgCode('h1', ORDER), pkgCode('p1', ORDER), payCode(ORDER)]);
  });

  it('gói không có việc: chỉ PAY, vendorProcessMissing', async () => {
    const { db, created } = fakeDb({ order: { order_items: [{ package_id: 'P1' }] }, pkgTasks: [] });
    assert.deepEqual(await syncOrderPackageTasks(db, ORDER, NOW), { created: 1, vendorProcessMissing: true });
    assert.deepEqual(created.map((c) => c.task_code), [payCode(ORDER)]);
  });

  it('đơn không gắn gói: chỉ PAY, vendorProcessMissing', async () => {
    const { db, created } = fakeDb({ pkgTasks: [pt('a', 'P1', -3)] });
    assert.deepEqual(await syncOrderPackageTasks(db, ORDER, NOW), { created: 1, vendorProcessMissing: true });
    assert.equal(created[0].task_code, payCode(ORDER));
  });

  it('chạy lại: không sinh trùng', async () => {
    const { db, created } = fakeDb({ order: { order_items: [{ package_id: 'P1' }] }, pkgTasks: [pt('a', 'P1', -3)], existing: [pkgCode('a', ORDER), payCode(ORDER)] });
    assert.equal((await syncOrderPackageTasks(db, ORDER, NOW)).created, 0);
    assert.equal(created.length, 0);
  });

  it('D theo ngày cọc giờ VN: cọc 01/12 lúc 03:00 UTC là 01/12 (10:00 VN)', async () => {
    const { db, created } = fakeDb({ order: { order_items: [{ package_id: 'P1' }] }, pkgTasks: [pt('a', 'P1', -100)] });
    await syncOrderPackageTasks(db, ORDER, NOW);
    assert.ok(ymd(created[0].scheduled_date) >= '2026-12-03'); // ≥ D + 2
  });

  it('đơn không tồn tại hoặc thiếu ngày thực hiện: không sinh gì', async () => {
    assert.deepEqual(await syncOrderPackageTasks(fakeDb({ order: null }).db, ORDER, NOW), { created: 0, vendorProcessMissing: false });
    assert.deepEqual(await syncOrderPackageTasks(fakeDb({ order: { event_date: null } }).db, ORDER, NOW), { created: 0, vendorProcessMissing: false });
  });
});

describe('replanOrderTasks: NCC sửa ngày thực hiện', () => {
  const offsets = new Map([['a', -30], ['b', -7], ['c', 0], ['d', 3]]);
  const state = (id: string, code: string, date: string, extra: Partial<OrderTaskState> = {}): OrderTaskState => ({ id, code, status: 'Todo', confirmed: false, date, ...extra });
  const base = [state('ta', pkgCode('a', ORDER), '2027-02-18'), state('tb', pkgCode('b', ORDER), '2027-03-13'), state('tc', pkgCode('c', ORDER), '2027-03-20'), state('td', pkgCode('d', ORDER), '2027-03-23'), state('tp', payCode(ORDER), '2027-03-27')];
  const ctx = { today: '2026-12-01', event: '2027-04-20', deposit: '2026-12-01' };

  it('dời E: tính lại việc chưa xong, chưa chốt (kể cả việc đã xóa mềm khỏi gói nhờ offsets) và PAY', () => {
    const r = replanOrderTasks({ ctx, tasks: base, offsets });
    const m = new Map(r.updates.map((u) => [u.id, u.date]));
    assert.equal(m.get('ta'), '2027-03-21'); // E − 30
    assert.equal(m.get('tb'), '2027-04-13');
    assert.equal(m.get('tc'), '2027-04-20');
    assert.equal(m.get('td'), '2027-04-23');
    assert.equal(m.get('tp'), '2027-04-27'); // max(E + 7, hạn cuối)
    assert.deepEqual(r.needsRecheck, []);
  });

  it('việc đã chốt và việc đã Done giữ ngày', () => {
    const tasks = [state('ta', pkgCode('a', ORDER), '2027-02-18', { confirmed: true }), state('tb', pkgCode('b', ORDER), '2027-03-13', { status: 'Done' }), ...base.slice(2)];
    const r = replanOrderTasks({ ctx, tasks, offsets });
    const ids = new Set(r.updates.map((u) => u.id));
    assert.equal(ids.has('ta'), false);
    assert.equal(ids.has('tb'), false);
    assert.equal(ids.has('tc'), true);
  });

  it('việc chốt trước E mà ngày chốt sau E mới: needsRecheck; việc sau E thì không', () => {
    const tasks = [state('tb', pkgCode('b', ORDER), '2027-03-13', { confirmed: true }), state('td', pkgCode('d', ORDER), '2027-03-23', { confirmed: true })];
    const r = replanOrderTasks({ ctx: { ...ctx, event: '2027-03-01' }, tasks, offsets });
    assert.deepEqual(r.needsRecheck, ['tb']);
    assert.deepEqual(r.updates, []);
  });

  it('không đụng việc chi tiết cũ (mã mẫu) và việc gói không còn trong offsets', () => {
    const tasks = [state('x', 'ATTIRE_FIT_FIRST', '2027-02-07'), state('y', pkgCode('zzz', ORDER), '2027-02-07')];
    assert.deepEqual(replanOrderTasks({ ctx, tasks, offsets }), { updates: [], needsRecheck: [] });
  });

  it('E không đổi: không có gì cần cập nhật', () => {
    const r = replanOrderTasks({ ctx: { today: '2026-12-01', event: E, deposit: '2026-12-01' }, tasks: base, offsets });
    assert.deepEqual(r.updates, []);
  });
});

describe('cancelPlan: NCC hủy đơn', () => {
  it('xóa việc chưa xong (Todo, Waiting), GIỮ việc đã xong', () => {
    const p = cancelPlan({ details: [{ id: '1', status: 'Todo' }, { id: '2', status: 'Waiting' }, { id: '3', status: 'Done' }], others: [] });
    assert.deepEqual(p.deleteIds, ['1', '2']);
  });

  it('Mốc chốt mở lại khi không còn đơn Deposited / Completed cùng hạng mục; còn thì giữ', () => {
    assert.equal(cancelPlan({ details: [], others: [] }).reopenBook, true);
    assert.equal(cancelPlan({ details: [], others: [{ id: 'o2', status: 'Deposited' }] }).reopenBook, false);
    assert.equal(cancelPlan({ details: [], others: [{ id: 'o2', status: 'Completed' }] }).reopenBook, false);
  });

  it('không còn luồng nhường việc cho đơn khác theo mã mẫu', () => {
    assert.equal('handOverTo' in cancelPlan({ details: [], others: [{ id: 'o2', status: 'Deposited' }] }), false);
  });
});

describe('mã việc gói không trùng giữa các đơn', () => {
  const UUID = '123e4567-e89b-12d3-a456-426614174000';
  const ORDER2 = 'abcdef12-0000-4000-8000-000000000002';

  it("'PKG:<id>:<8 ký tự đầu của order_id>' ≤ 50 ký tự; tách lại đúng id việc của gói (và dạng cũ 'PKG:<id>')", () => {
    const code = pkgCode(UUID, ORDER2);
    assert.equal(code, `PKG:${UUID}:abcdef12`);
    assert.ok(code.length <= 50, String(code.length));
    assert.equal(pkgTaskIdOf(code), UUID);
    assert.equal(pkgTaskIdOf(`PKG:${UUID}`), UUID);
    assert.equal(pkgTaskIdOf('PAY:x'), null);
    assert.equal(pkgTaskIdOf(null), null);
  });

  it('cùng việc của gói ở hai đơn: hai mã khác nhau', () => {
    assert.notEqual(pkgCode(UUID, ORDER), pkgCode(UUID, ORDER2));
  });

  it('hủy đơn có việc Done rồi đặt lại cùng gói ở đơn mới: đơn mới nhận đủ việc (không bị mã cũ của đơn cũ chặn)', async () => {
    const tasks = [pt('a', 'P1', -14), pt('b', 'P1', -3)];
    // đơn cũ đã hủy: việc Done còn giữ mã của nó trong cùng đám cưới
    const oldCodes = [pkgCode('a', ORDER), pkgCode('b', ORDER), payCode(ORDER)];
    const fresh = fakeDb({ order: { id: ORDER2, order_items: [{ package_id: 'P1' }] }, pkgTasks: tasks, existing: [] });
    const r = await syncOrderPackageTasks(fresh.db, ORDER2, new Date('2026-12-01T05:00:00Z'));
    assert.equal(r.created, 3);
    const newCodes = fresh.created.map((c) => c.task_code);
    assert.equal(newCodes.filter((c) => oldCodes.includes(c)).length, 0, 'không trùng mã đơn cũ');
    assert.equal(new Set([...oldCodes, ...newCodes]).size, 6);
  });
});

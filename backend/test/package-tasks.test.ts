/*
 * Việc NCC khai theo gói (src/modules/vendors/package-tasks.ts), chạy bằng: npm test
 * Dùng CSDL giả trong bộ nhớ, không ghi CSDL thật.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_TASKS_PER_PACKAGE, parseTasks, syncPackageTasks, type PackageTasksTx } from '../src/modules/vendors/package-tasks.ts';

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const ok = (over: Record<string, unknown> = {}) => ({ title: 'Gửi phối cảnh', note: null, owner: 'VENDOR', offsetDays: -21, ...over });

interface Row {
  id: string;
  package_id: string;
  title: string;
  note: string | null;
  owner: string;
  offset_days: number;
  sort_order: number;
  deleted_at: Date | null;
  updated_date?: Date;
}

/** Bảng package_tasks giả: findMany lọc theo package_id và deleted_at = null như service thật. */
function fakeDb(rows: Row[]) {
  let seq = 100;
  const tx: PackageTasksTx = {
    package_tasks: {
      async findMany(args) {
        const w = (args as { where: { package_id: string } }).where;
        return rows.filter((r) => r.package_id === w.package_id && r.deleted_at === null).map((r) => ({ id: r.id }));
      },
      async create({ data }) {
        rows.push({ id: ID(seq++), deleted_at: null, ...(data as Omit<Row, 'id' | 'deleted_at'>) });
      },
      async update({ where, data }) {
        Object.assign(rows.find((r) => r.id === where.id)!, data);
      },
      async updateMany({ where, data }) {
        const ids = (where.id as { in: string[] }).in;
        for (const r of rows) if (ids.includes(r.id) && r.package_id === where.package_id) Object.assign(r, data);
      },
    },
  };
  return { tx, rows };
}

const row = (n: number, pkg: string, over: Partial<Row> = {}): Row => ({ id: ID(n), package_id: pkg, title: `Việc ${n}`, note: null, owner: 'VENDOR', offset_days: -n, sort_order: n, deleted_at: null, ...over });

describe('parseTasks', () => {
  it('chuẩn hóa: cắt khoảng trắng, ghi chú rỗng thành null', () => {
    const { tasks, errors } = parseTasks([ok({ title: '  Thử váy lần 1  ', note: '   ' }), ok({ note: ' gửi ảnh rõ nét ', offsetDays: 0 })]);
    assert.deepEqual(errors, []);
    assert.equal(tasks[0].title, 'Thử váy lần 1');
    assert.equal(tasks[0].note, null);
    assert.equal(tasks[1].note, 'gửi ảnh rõ nét');
  });

  it('tên: bắt buộc, 1–255 ký tự', () => {
    assert.equal(parseTasks([ok({ title: '   ' })]).errors[0].field, 'title');
    assert.equal(parseTasks([ok({ title: 'x'.repeat(256) })]).errors[0].field, 'title');
    assert.deepEqual(parseTasks([ok({ title: 'x'.repeat(255) })]).errors, []);
  });

  it('ghi chú ≤ 500', () => {
    assert.equal(parseTasks([ok({ note: 'x'.repeat(501) })]).errors[0].field, 'note');
    assert.deepEqual(parseTasks([ok({ note: 'x'.repeat(500) })]).errors, []);
  });

  it('owner chỉ CUSTOMER | VENDOR | BOTH', () => {
    for (const owner of ['CUSTOMER', 'VENDOR', 'BOTH']) assert.deepEqual(parseTasks([ok({ owner })]).errors, []);
    for (const owner of ['ADMIN', 'vendor', '', null, 1]) assert.equal(parseTasks([ok({ owner })]).errors[0].field, 'owner');
  });

  it('offsetDays nguyên trong [-365, 120]', () => {
    for (const offsetDays of [-365, -1, 0, 1, 120]) assert.deepEqual(parseTasks([ok({ offsetDays })]).errors, [], String(offsetDays));
    for (const offsetDays of [-366, 121, 1.5, '3', null, NaN]) assert.equal(parseTasks([ok({ offsetDays })]).errors[0].field, 'offsetDays', String(offsetDays));
  });

  it('tối đa 40 việc mỗi gói', () => {
    assert.deepEqual(parseTasks(Array.from({ length: MAX_TASKS_PER_PACKAGE }, () => ok())).errors, []);
    const over = parseTasks(Array.from({ length: MAX_TASKS_PER_PACKAGE + 1 }, () => ok()));
    assert.equal(over.errors[0].index, -1);
  });

  it('lỗi kèm chỉ số dòng, báo đủ mọi dòng lỗi', () => {
    const { errors } = parseTasks([ok(), ok({ title: '' }), ok(), ok({ owner: 'X', offsetDays: 999 })]);
    assert.deepEqual(errors.map((e) => `${e.index}:${e.field}`), ['1:title', '3:owner', '3:offsetDays']);
  });

  it('id sai định dạng hoặc trùng; không phải mảng', () => {
    assert.equal(parseTasks([ok({ id: 'abc' })]).errors[0].field, 'id');
    assert.equal(parseTasks([ok({ id: ID(1) }), ok({ id: ID(1) })]).errors[0].index, 1);
    assert.equal(parseTasks({}).errors[0].index, -1);
    assert.equal(parseTasks(undefined).errors[0].index, -1);
  });
});

describe('syncPackageTasks', () => {
  const NOW = new Date('2026-11-01T00:00:00Z');
  const run = async (db: ReturnType<typeof fakeDb>, pkg: string, input: unknown[]) => {
    const { tasks, errors } = parseTasks(input);
    assert.deepEqual(errors, []);
    return syncPackageTasks(db.tx, pkg, tasks, NOW);
  };
  const alive = (db: ReturnType<typeof fakeDb>, pkg: string) => db.rows.filter((r) => r.package_id === pkg && r.deleted_at === null).sort((a, b) => a.sort_order - b.sort_order);

  it('thêm: không id → dòng mới, sort_order = vị trí trong mảng', async () => {
    const db = fakeDb([]);
    const r = await run(db, 'P1', [ok({ title: 'A', offsetDays: -3 }), ok({ title: 'B', offsetDays: 0 }), ok({ title: 'C', offsetDays: 2, owner: 'BOTH' })]);
    assert.deepEqual(r.foreign, []);
    assert.deepEqual(alive(db, 'P1').map((x) => [x.title, x.sort_order, x.offset_days, x.owner]), [['A', 0, -3, 'VENDOR'], ['B', 1, 0, 'VENDOR'], ['C', 2, 2, 'BOTH']]);
  });

  it('sửa: có id → cập nhật tại chỗ (giữ id), cập nhật updated_date', async () => {
    const db = fakeDb([row(1, 'P1'), row(2, 'P1')]);
    await run(db, 'P1', [{ ...ok({ title: 'Đã sửa', offsetDays: -10, owner: 'CUSTOMER', note: 'ghi chú' }), id: ID(1) }, { ...ok({ title: 'Việc 2' }), id: ID(2) }]);
    const a = db.rows.find((x) => x.id === ID(1))!;
    assert.deepEqual([a.title, a.offset_days, a.owner, a.note, a.updated_date], ['Đã sửa', -10, 'CUSTOMER', 'ghi chú', NOW]);
    assert.equal(db.rows.length, 2);
  });

  it('xóa mềm: id vắng mặt → set deleted_at, KHÔNG xóa cứng, dòng vẫn còn trong bảng', async () => {
    const db = fakeDb([row(1, 'P1'), row(2, 'P1'), row(3, 'P1')]);
    await run(db, 'P1', [{ ...ok({ title: 'Việc 1' }), id: ID(1) }]);
    assert.equal(db.rows.length, 3);
    assert.deepEqual(db.rows.filter((r) => r.deleted_at).map((r) => r.id).sort(), [ID(2), ID(3)]);
    assert.ok(db.rows.filter((r) => r.deleted_at).every((r) => r.deleted_at!.getTime() === NOW.getTime()));
    assert.deepEqual(alive(db, 'P1').map((r) => r.id), [ID(1)]);
  });

  it('danh sách rỗng: xóa mềm toàn bộ', async () => {
    const db = fakeDb([row(1, 'P1'), row(2, 'P1')]);
    await run(db, 'P1', []);
    assert.equal(alive(db, 'P1').length, 0);
    assert.equal(db.rows.length, 2);
  });

  it('đổi thứ tự: sort_order theo vị trí mới', async () => {
    const db = fakeDb([row(1, 'P1', { offset_days: -5, sort_order: 0 }), row(2, 'P1', { offset_days: -5, sort_order: 1 })]);
    await run(db, 'P1', [{ ...ok({ offsetDays: -5 }), id: ID(2) }, { ...ok({ offsetDays: -5 }), id: ID(1) }]);
    assert.deepEqual(alive(db, 'P1').map((r) => r.id), [ID(2), ID(1)]);
  });

  it('id của gói khác (NCC khác): không ghi gì, trả chỉ số dòng sai', async () => {
    const db = fakeDb([row(1, 'P1'), row(2, 'OTHER')]);
    const before = JSON.stringify(db.rows);
    const r = await run(db, 'P1', [{ ...ok(), id: ID(1) }, { ...ok({ title: 'Cướp việc' }), id: ID(2) }]);
    assert.deepEqual(r.foreign, [1]);
    assert.equal(JSON.stringify(db.rows), before);
  });

  it('id đã xóa mềm không được dùng lại; việc của gói khác không bị đụng khi xóa mềm', async () => {
    const db = fakeDb([row(1, 'P1', { deleted_at: new Date('2026-10-01') }), row(2, 'P1'), row(3, 'OTHER')]);
    assert.deepEqual((await run(db, 'P1', [{ ...ok(), id: ID(1) }])).foreign, [0]);
    await run(db, 'P1', []);
    assert.equal(db.rows.find((r) => r.id === ID(3))!.deleted_at, null);
  });
});

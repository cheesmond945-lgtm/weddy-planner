/*
 * Test việc chi tiết khi đặt cọc (src/modules/weddings/timeline-rows.ts), chạy bằng: npm test
 * Tái hiện lỗi: khách đã có đơn Trang trí đang giữ các việc chi tiết (mỗi mã chỉ một dòng trong một đám cưới), cọc thêm đơn
 * Trang trí mới thì đơn mới KHÔNG có việc chi tiết nào vì mọi mã đã tồn tại.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cancelPlan, depositDetailPlan, detailRows, type ExistingDetail } from '../src/modules/weddings/timeline-rows.ts';
import { TIMELINE_TEMPLATES, type ServiceKey } from '../src/modules/weddings/timeline-templates.ts';

const T = TIMELINE_TEMPLATES;
const WEDDING = 'w1';
const W = '2027-04-18';
const OLD = 'order-old';
const NEW = 'order-new';
const decor = { key: 'decor' as ServiceKey, categoryId: 'cat-decor' };
const detailCodes = (key: ServiceKey) => T.filter((t) => t.service === key && !['SELF', 'CHOOSE', 'BOOK'].includes(t.kind)).map((t) => t.code);

/** Timeline của chi.bui12 trước khi cọc đơn mới: khung Decor, việc chi tiết của đơn cũ (một việc đã xong), việc của dịch vụ khác. */
function before(): ExistingDetail[] {
  const rows: ExistingDetail[] = [];
  let n = 0;
  const add = (code: string, status: string, orderId: string | null) => rows.push({ id: `t${n++}`, code, status, orderId });
  for (const c of ['DECOR_SHORTLIST', 'DECOR_VISIT', 'DECOR_BOOK']) add(c, c === 'DECOR_BOOK' ? 'Done' : 'Todo', null);
  for (const c of detailCodes('decor')) add(c, c === 'DECOR_BRIEF' ? 'Done' : 'Todo', OLD);
  for (const c of detailCodes('trang-phuc')) add(c, 'Todo', 'order-attire');
  return rows;
}
const ctx = { today: '2026-10-29', wedding: W, event: '2026-12-11', deposit: '2026-10-29' };
const plan = (existing: ExistingDetail[], orderId = NEW) => depositDetailPlan(T, { weddingId: WEDDING, orderId, service: decor, ctx, existing });

describe('đặt cọc đơn thứ hai của cùng hạng mục (lỗi: đơn mới không có việc chi tiết)', () => {
  it('cách cũ (chỉ chèn mã chưa có) không sinh được việc nào cho đơn mới: đúng lỗi đã gặp', () => {
    const codes = new Set(before().map((t) => t.code));
    assert.equal(detailRows(T, { weddingId: WEDDING, orderId: NEW, service: decor, ctx, existing: codes }).length, 0);
  });

  it('đơn mới nhận việc chi tiết: thay việc chưa xong của đơn cũ, giữ việc đã xong', () => {
    const existing = before();
    const p = plan(existing);
    const codes = detailCodes('decor').filter((c) => c !== 'DECOR_BRIEF'); // DECOR_BRIEF đã xong: giữ, không sinh lại
    assert.deepEqual(p.rows.map((r) => r.task_code).sort(), [...codes].sort());
    assert.ok(p.rows.every((r) => r.order_id === NEW && r.category_id === 'cat-decor' && r.status === 'Todo' && r.task_type === 'Detail'));
    // xóa đúng các việc Decor chưa xong của đơn cũ, không đụng việc đã xong, việc khung, việc của dịch vụ khác
    const deleted = new Map(existing.map((t) => [t.id, t]));
    assert.deepEqual(p.deleteIds.map((id) => deleted.get(id)!.code).sort(), [...codes].sort());
    assert.ok(p.deleteIds.every((id) => deleted.get(id)!.orderId === OLD && deleted.get(id)!.status === 'Todo'));
  });

  it('hạn của việc mới tính từ D, E của đơn mới', () => {
    const rows = new Map(plan(before()).rows.map((r) => [r.task_code, r]));
    assert.equal(rows.get('DECOR_EVENT')!.scheduled_date.toISOString().slice(0, 10), '2026-12-11'); // E của đơn mới
    assert.equal(rows.get('DECOR_PAY')!.scheduled_date.toISOString().slice(0, 10), '2026-12-18'); // E + 7
    assert.ok(rows.get('DECOR_REVIEW_MOCKUP')!.scheduled_date.toISOString().slice(0, 10) <= '2026-12-10');
  });

  it('chạy lại cho cùng đơn: không còn gì để xóa hay tạo', () => {
    const existing = before();
    const first = plan(existing);
    const gone = new Set(first.deleteIds);
    const after: ExistingDetail[] = [...existing.filter((t) => !gone.has(t.id)), ...first.rows.map((r, i) => ({ id: `n${i}`, code: r.task_code, status: r.status, orderId: r.order_id }))];
    const again = plan(after);
    assert.deepEqual(again, { deleteIds: [], rows: [] });
  });

  it('đơn đầu tiên của hạng mục: chỉ chèn, không xóa gì', () => {
    const none = before().filter((t) => t.orderId !== OLD);
    const p = plan(none, NEW);
    assert.equal(p.deleteIds.length, 0);
    assert.equal(p.rows.length, detailCodes('decor').length);
  });

  it('không đụng việc chi tiết của hạng mục khác', () => {
    const p = plan(before());
    const attire = new Set(detailCodes('trang-phuc'));
    assert.ok(p.rows.every((r) => !attire.has(r.task_code)));
    assert.ok(p.deleteIds.every((id) => !before().find((t) => t.id === id && attire.has(t.code))));
  });
});

describe('hủy đơn đã cọc', () => {
  const attire = { key: 'trang-phuc' as ServiceKey, categoryId: 'cat-attire' };
  const D1 = '2026-10-29';
  /** Khung + việc chi tiết của hai dịch vụ đã cọc: Trang trí (đơn D-1, có một việc đã xong) và Trang phục (đơn A-1). */
  function deposited() {
    const rows: ExistingDetail[] = [];
    let n = 0;
    const add = (code: string, status: string, orderId: string | null) => rows.push({ id: `t${n++}`, code, status, orderId });
    for (const c of ['DECOR_SHORTLIST', 'DECOR_VISIT']) add(c, 'Todo', null);
    add('DECOR_BOOK', 'Done', null);
    const d1 = depositDetailPlan(T, { weddingId: WEDDING, orderId: 'D-1', service: decor, ctx: { today: D1, wedding: W, event: '2027-01-10', deposit: D1 }, existing: rows });
    for (const r of d1.rows) add(r.task_code, r.task_code === 'DECOR_BRIEF' ? 'Done' : 'Todo', 'D-1'); // một việc đã xong
    const a1 = depositDetailPlan(T, { weddingId: WEDDING, orderId: 'A-1', service: attire, ctx: { today: D1, wedding: W, event: '2027-01-10', deposit: D1, albumDate: '2026-11-21' }, existing: rows });
    for (const r of a1.rows) add(r.task_code, 'Todo', 'A-1');
    return rows;
  }

  it('hủy đơn: gỡ mọi việc chi tiết của đơn (kể cả việc đã xong), Mốc chốt về Todo, dịch vụ khác không đổi', () => {
    const rows = deposited();
    const mine = rows.filter((t) => t.orderId === 'D-1');
    assert.ok(mine.some((t) => t.status === 'Done') && mine.length === detailCodes('decor').length);
    const plan = cancelPlan({ orderId: 'D-1', details: mine, others: [] });
    assert.deepEqual([...plan.deleteIds].sort(), mine.map((t) => t.id).sort());
    assert.equal(plan.reopenBook, true);
    assert.equal(plan.handOverTo, null);
    const left = rows.filter((t) => !plan.deleteIds.includes(t.id));
    assert.equal(left.filter((t) => detailCodes('decor').includes(t.code)).length, 0);
    assert.equal(left.filter((t) => t.orderId === 'A-1').length, detailCodes('trang-phuc').length); // dịch vụ khác nguyên vẹn
  });

  it('còn đơn Deposited khác cùng hạng mục: Mốc chốt vẫn xong, đơn cọc mới nhất nhận lại việc; chỉ còn đơn Completed thì không sinh lại', () => {
    const mine = deposited().filter((t) => t.orderId === 'D-1');
    const two = cancelPlan({ orderId: 'D-1', details: mine, others: [{ id: 'D-2', status: 'Deposited', paidAt: 5 }, { id: 'D-3', status: 'Deposited', paidAt: 9 }, { id: 'D-0', status: 'Completed', paidAt: 99 }] });
    assert.equal(two.reopenBook, false);
    assert.equal(two.handOverTo, 'D-3');
    const completed = cancelPlan({ orderId: 'D-1', details: mine, others: [{ id: 'D-0', status: 'Completed', paidAt: 1 }] });
    assert.deepEqual({ reopen: completed.reopenBook, to: completed.handOverTo }, { reopen: false, to: null });
  });

  it('cọc lại đơn mới sau khi hủy: việc chi tiết sinh mới theo D, E mới', () => {
    const rows = deposited();
    const mine = rows.filter((t) => t.orderId === 'D-1');
    const gone = new Set(cancelPlan({ orderId: 'D-1', details: mine, others: [] }).deleteIds);
    const after = rows.filter((t) => !gone.has(t.id));
    const fresh = depositDetailPlan(T, { weddingId: WEDDING, orderId: 'D-2', service: decor, ctx: { today: '2026-11-05', wedding: W, event: '2027-02-20', deposit: '2026-11-05' }, existing: after });
    assert.equal(fresh.deleteIds.length, 0);
    assert.deepEqual(fresh.rows.map((r) => r.task_code).sort(), [...detailCodes('decor')].sort()); // sinh lại đủ, kể cả mã từng xong của đơn cũ
    assert.ok(fresh.rows.every((r) => r.order_id === 'D-2'));
    const byCode = new Map(fresh.rows.map((r) => [r.task_code, r.scheduled_date.toISOString().slice(0, 10)]));
    assert.equal(byCode.get('DECOR_EVENT'), '2027-02-20'); // E mới
    assert.equal(byCode.get('DECOR_PAY'), '2027-02-27'); // E + 7
    assert.equal(byCode.get('DECOR_BRIEF'), '2026-12-07'); // E mới − 75 (còn ≥ D mới + 2)
  });
});

describe('cọc đủ 6 dịch vụ ở 6 thời điểm khác nhau', () => {
  const WEDDING_DAY = '2027-04-18';
  const SERVICES_IN_ORDER: [ServiceKey, string][] = [
    ['nha-hang', '2026-11-02'],
    ['trang-phuc', '2026-11-20'],
    ['decor', '2026-12-05'],
    ['chup-anh', '2026-12-18'],
    ['makeup', '2027-01-10'],
    ['hoa-cuoi', '2027-02-01'],
  ];

  /** Mô phỏng đúng hook: mỗi lần cọc lấy việc đã có làm `existing`, albumDate = ngày chụp album nếu đã có. */
  function simulate() {
    type Row = { id: string; code: string; status: string; orderId: string; date: string; service: ServiceKey };
    const rows: Row[] = [];
    const steps: { service: ServiceKey; created: Row[]; deleted: number; datesBefore: Map<string, string> }[] = [];
    for (const [service, deposit] of SERVICES_IN_ORDER) {
      const datesBefore = new Map(rows.map((r) => [r.id, r.date]));
      const album = rows.find((r) => r.code === 'PHOTO_ALBUM_SHOOT')?.date;
      const plan = depositDetailPlan(T, {
        weddingId: WEDDING,
        orderId: `order-${service}`,
        service: { key: service, categoryId: `cat-${service}` },
        ctx: { today: deposit, wedding: WEDDING_DAY, event: WEDDING_DAY, deposit, albumDate: album },
        existing: rows.map((r) => ({ id: r.id, code: r.code, status: r.status, orderId: r.orderId })),
      });
      assert.equal(plan.deleteIds.length, 0, `${service}: cọc dịch vụ mới không được xóa / thay việc của dịch vụ khác`);
      const created = plan.rows.map((r, i) => ({ id: `${service}-${i}`, code: r.task_code, status: 'Todo', orderId: `order-${service}`, date: r.scheduled_date.toISOString().slice(0, 10), service }));
      rows.push(...created);
      steps.push({ service, created, deleted: plan.deleteIds.length, datesBefore });
      // sau mỗi lần cọc, mọi việc đã sinh trước đó vẫn đúng ngày cũ
      for (const r of rows) if (datesBefore.has(r.id)) assert.equal(r.date, datesBefore.get(r.id), `${r.code} đổi ngày sau khi cọc ${service}`);
    }
    return { rows, steps };
  }

  it('mỗi lần cọc chỉ thêm việc của dịch vụ đó; ngày mọi việc đã sinh trước đó không đổi', () => {
    const { rows, steps } = simulate();
    assert.equal(steps.length, 6);
    for (const st of steps) {
      assert.ok(st.created.length > 0, st.service);
      assert.ok(st.created.every((r) => T.find((t) => t.code === r.code)!.service === st.service));
    }
    assert.equal(new Set(rows.map((r) => r.code)).size, rows.length); // không trùng mã
    assert.equal(rows.length, T.filter((t) => !['SELF', 'CHOOSE', 'BOOK'].includes(t.kind) && t.service).length);
  });

  it('ngày việc của một dịch vụ không phụ thuộc thứ tự cọc các dịch vụ khác (trừ việc theo ngày chụp album)', () => {
    const { rows } = simulate();
    for (const [service, deposit] of SERVICES_IN_ORDER) {
      const album = service === 'chup-anh' ? undefined : rows.find((r) => r.code === 'PHOTO_ALBUM_SHOOT')?.date;
      const alone = depositDetailPlan(T, {
        weddingId: WEDDING,
        orderId: 'x',
        service: { key: service, categoryId: 'c' },
        ctx: { today: deposit, wedding: WEDDING_DAY, event: WEDDING_DAY, deposit, albumDate: service === 'trang-phuc' ? undefined : album },
        existing: [],
      }).rows;
      for (const r of alone) {
        if (r.task_code === 'ATTIRE_ALBUM_PICKUP') continue; // neo S−1: tính theo thời điểm cọc trang phục, không dời khi chụp ảnh cọc sau
        assert.equal(rows.find((x) => x.code === r.task_code)!.date, r.scheduled_date.toISOString().slice(0, 10), r.task_code);
      }
    }
  });

  it('danh sách theo thời gian có việc của nhiều dịch vụ đan xen, và các dịch vụ được trùng ngày (không tự dàn lại)', () => {
    const { rows } = simulate();
    const merged = [...rows].sort((a, b) => a.date.localeCompare(b.date));
    let switches = 0;
    for (let i = 1; i < merged.length; i++) if (merged[i].service !== merged[i - 1].service) switches++;
    assert.ok(switches >= 15, `chỉ ${switches} lần đổi dịch vụ giữa các việc liền kề`);
    const byDate = new Map<string, Set<ServiceKey>>();
    for (const r of rows) byDate.set(r.date, (byDate.get(r.date) ?? new Set()).add(r.service));
    assert.ok([...byDate.values()].some((s) => s.size >= 3), 'phải có ngày chung của ≥ 3 dịch vụ (ngày thực hiện)');
    assert.deepEqual([...byDate.get(WEDDING_DAY)!].sort(), ['chup-anh', 'decor', 'hoa-cuoi', 'makeup', 'nha-hang']); // 5 dịch vụ có ngày thực hiện trùng ngày cưới (trang phục không có việc ngày thực hiện)
  });
});

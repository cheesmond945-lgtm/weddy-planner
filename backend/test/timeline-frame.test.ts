/*
 * Test timeline khung đầy đủ (planTimeline trong src/modules/weddings/timeline-schedule.ts): Bước 0 gộp việc theo mật độ,
 * Bước 1–6 giữ nguyên (planFrame), Bước 7 nhãn ưu tiên / giao hạn việc gộp theo ưu tiên / chặn W − 1. Hàm thuần, không đụng CSDL.
 * Hôm nay cố định I = 15/11/2026.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { TIMELINE_TEMPLATES, type BudgetPresetKey, type ServiceKey } from '../src/modules/weddings/timeline-templates.ts';
import {
  dayOf,
  frameUrgentCodes,
  mergeChains,
  mergedHint,
  mergedServicesOf,
  planFrame,
  planTimeline,
  priorityLabels,
  priorityOrder,
  replanFrame,
  replanOnWeddingDateChange,
  ymd,
  type ServiceWeights,
  type TimelinePlan,
} from '../src/modules/weddings/timeline-schedule.ts';
import { budgetPriorityOf, frameRows, frameViewOf } from '../src/modules/weddings/timeline-rows.ts';

const T = TIMELINE_TEMPLATES;
const I = '2026-11-15';
const ALL: ServiceKey[] = ['nha-hang', 'chup-anh', 'trang-phuc', 'decor', 'makeup', 'hoa-cuoi'];
const TWO: ServiceKey[] = ['nha-hang', 'chup-anh'];
const ONE: ServiceKey[] = ['nha-hang'];
const addDays = (s: string, n: number) => ymd(dayOf(s) + n);
/** Tùy chỉnh: trang trí cao nhất; chụp ảnh, trang phục, hoa bằng nhau (theo thứ tự Cân bằng); trang điểm thấp nhất */
const CUSTOM_W: ServiceWeights = { 'chup-anh': 20, 'trang-phuc': 20, decor: 30, makeup: 10, 'hoa-cuoi': 20 };

interface Scenario {
  L: number;
  services: ServiceKey[];
  preset: BudgetPresetKey | null;
  weights?: ServiceWeights;
  /** Kỳ vọng gộp */
  merge: boolean;
}

const SCENARIOS: Scenario[] = [
  { L: 400, services: ALL, preset: 'BALANCED', merge: false },
  { L: 181, services: ALL, preset: 'VISUAL', merge: false },
  { L: 90, services: ALL, preset: 'SPACE', merge: false },
  { L: 60, services: ALL, preset: 'CUSTOM', weights: CUSTOM_W, merge: false },
  { L: 30, services: ALL, preset: 'VISUAL', merge: true },
  { L: 21, services: ALL, preset: 'SPACE', merge: true },
  { L: 21, services: TWO, preset: 'BALANCED', merge: false },
  { L: 20, services: TWO, preset: 'CUSTOM', weights: CUSTOM_W, merge: false },
  { L: 10, services: ONE, preset: null, merge: true },
  { L: 10, services: ALL, preset: 'CUSTOM', weights: CUSTOM_W, merge: true },
  { L: 5, services: ALL, preset: 'BALANCED', merge: true },
  { L: 3, services: ALL, preset: 'VISUAL', merge: true },
  { L: 2, services: ALL, preset: 'SPACE', merge: true },
];

const run = (s: Scenario): TimelinePlan => planTimeline(T, { wedding: addDays(I, s.L), today: I, services: s.services, preset: s.preset, weights: s.weights });
const chainOf = (s: ServiceKey) => T.filter((t) => t.service === s && (t.kind === 'CHOOSE' || t.kind === 'BOOK')).sort((a, b) => a.order - b.order);

describe('Bước 7.1: thứ tự ưu tiên theo mức chia ngân sách', () => {
  it('Ưu tiên hình ảnh: tiệc → chụp ảnh → trang phục → trang điểm → trang trí → hoa', () => {
    assert.deepEqual(priorityOrder(ALL, 'VISUAL'), ['nha-hang', 'chup-anh', 'trang-phuc', 'makeup', 'decor', 'hoa-cuoi']);
  });
  it('Ưu tiên không gian: tiệc → trang trí → hoa → chụp ảnh → trang phục → trang điểm', () => {
    assert.deepEqual(priorityOrder(ALL, 'SPACE'), ['nha-hang', 'decor', 'hoa-cuoi', 'chup-anh', 'trang-phuc', 'makeup']);
  });
  it('Cân bằng: tiệc → chụp ảnh → trang phục → trang trí → trang điểm → hoa', () => {
    assert.deepEqual(priorityOrder(ALL, 'BALANCED'), ['nha-hang', 'chup-anh', 'trang-phuc', 'decor', 'makeup', 'hoa-cuoi']);
  });
  it('Tùy chỉnh: % cao trước, bằng nhau theo thứ tự Cân bằng', () => {
    assert.deepEqual(priorityOrder(ALL, 'CUSTOM', CUSTOM_W), ['nha-hang', 'decor', 'chup-anh', 'trang-phuc', 'hoa-cuoi', 'makeup']);
  });
  it('không có dữ liệu ngân sách, hoặc Tùy chỉnh chưa có tỷ lệ: dùng Cân bằng', () => {
    assert.deepEqual(priorityOrder(ALL, null), priorityOrder(ALL, 'BALANCED'));
    assert.deepEqual(priorityOrder(ALL, undefined), priorityOrder(ALL, 'BALANCED'));
    assert.deepEqual(priorityOrder(ALL, 'CUSTOM', null), priorityOrder(ALL, 'BALANCED'));
  });
  it('chỉ đánh số dịch vụ khách chọn, liên tục 1, 2, 3…; tiệc luôn 1', () => {
    const p = planTimeline(T, { wedding: addDays(I, 60), today: I, services: ['hoa-cuoi', 'nha-hang', 'makeup'], preset: 'VISUAL' });
    assert.deepEqual(p.priority, { 'nha-hang': 1, makeup: 2, 'hoa-cuoi': 3 });
    const noVenue = planTimeline(T, { wedding: addDays(I, 60), today: I, services: ['hoa-cuoi', 'decor'], preset: 'SPACE' });
    assert.deepEqual(noVenue.priority, { decor: 1, 'hoa-cuoi': 2 });
  });
  it('nhãn chỉ khi L ≤ 80; mọi việc của dịch vụ mang nhãn, việc chung thì không', () => {
    assert.equal(planTimeline(T, { wedding: addDays(I, 81), today: I, services: ALL }).priority, null);
    const p = planTimeline(T, { wedding: addDays(I, 80), today: I, services: ALL, preset: 'BALANCED' });
    assert.ok(p.priority);
    for (const t of p.tasks) assert.equal(t.priority, t.service ? p.priority![t.service] : null, t.code);
  });
});

describe('Bước 0: gộp việc theo mật độ', () => {
  it('gộp ⇔ mật độ > 1: 21 ngày/6 dv gộp; 21 ngày/2 dv không; 60 ngày/6 dv không', () => {
    const a = planTimeline(T, { wedding: addDays(I, 21), today: I, services: ALL });
    assert.equal(a.n, 30);
    assert.equal(a.density, 30 / 20);
    assert.deepEqual(a.merged, ALL);
    const b = planTimeline(T, { wedding: addDays(I, 21), today: I, services: TWO });
    assert.equal(b.n, 16);
    assert.equal(b.density, 16 / 20);
    assert.deepEqual(b.merged, []);
    const c = planTimeline(T, { wedding: addDays(I, 60), today: I, services: ALL });
    assert.equal(c.density, 30 / 59);
    assert.deepEqual(c.merged, []);
  });

  it('mật độ đúng 1 thì không gộp (n = L − 1)', () => {
    // 6 dịch vụ: n = 30, L = 31
    const p = planTimeline(T, { wedding: addDays(I, 31), today: I, services: ALL });
    assert.equal(p.density, 1);
    assert.deepEqual(p.merged, []);
  });

  it('n không tính "Cảm ơn khách" (việc sau cưới)', () => {
    const p = planTimeline(T, { wedding: addDays(I, 100), today: I, services: [] });
    assert.equal(p.n, T.filter((t) => t.service === null && t.offset < 0).length);
    assert.ok(p.tasks.some((t) => t.code === 'SELF_THANKS'));
  });

  it('việc gộp: tên, mã *_BOOK, d của Mốc chốt, không cuối tuần, không noShrink; không còn việc Chọn NCC', () => {
    const merged = mergeChains(T, ['nha-hang', 'hoa-cuoi']);
    const venue = merged.find((t) => t.code === 'VENUE_BOOK')!;
    assert.equal(venue.title, 'Chọn và chốt trung tâm tiệc cưới');
    assert.equal(venue.offset, -180);
    assert.equal(venue.kind, 'BOOK');
    assert.ok(!venue.weekendPreferred && !venue.noShrink);
    assert.equal(merged.find((t) => t.code === 'FLOWER_BOOK')!.title, 'Chọn và chốt hoa cưới');
    for (const code of ['VENUE_SHORTLIST', 'VENUE_TOUR', 'VENUE_TASTE', 'FLOWER_SHORTLIST', 'FLOWER_PICK']) assert.ok(!merged.some((t) => t.code === code), code);
    // dịch vụ khác và việc tự làm giữ nguyên
    for (const code of ['PHOTO_SHORTLIST', 'PHOTO_BOOK', 'SELF_RINGS']) assert.deepEqual(merged.find((t) => t.code === code), T.find((t) => t.code === code));
  });

  it('tên việc gộp đủ 6 dịch vụ', () => {
    const titles = Object.fromEntries(mergeChains(T, ALL).filter((t) => t.kind === 'BOOK').map((t) => [t.service, t.title]));
    assert.deepEqual(titles, {
      'nha-hang': 'Chọn và chốt trung tâm tiệc cưới',
      'chup-anh': 'Chọn và chốt chụp ảnh',
      'trang-phuc': 'Chọn và chốt trang phục',
      decor: 'Chọn và chốt trang trí',
      makeup: 'Chọn và chốt trang điểm',
      'hoa-cuoi': 'Chọn và chốt hoa cưới',
    });
  });

  it('gợi ý từ bộ mẫu: "Gợi ý: bước 1 → … → Chốt", đúng số bước con của chuỗi', () => {
    for (const s of ALL) {
      const hint = mergedHint(T, s);
      assert.ok(hint.startsWith('Gợi ý: '), hint);
      assert.ok(hint.endsWith(' → Chốt'), hint);
      assert.equal(hint.split(' → ').length, chainOf(s).length, s);
    }
    assert.equal(mergedHint(T, 'nha-hang'), 'Gợi ý: Lọc và hỏi giá 3–5 nhà hàng → Đi xem sảnh → Thử món, xin báo giá chính thức → Chốt');
  });

  it('frameRows ghi tên việc gộp, KHÔNG ghi cột note (để khách tự ghi chú)', () => {
    const rows = frameRows(T, { weddingId: 'w', wedding: addDays(I, 10), today: I, services: [{ key: 'nha-hang', categoryId: 'c1' }] });
    const venue = rows.find((r) => r.task_code === 'VENUE_BOOK')!;
    assert.equal(venue.title, 'Chọn và chốt trung tâm tiệc cưới');
    assert.equal(venue.task_type, 'Frame');
    assert.equal(venue.category_id, 'c1');
    assert.ok(rows.every((r) => !('note' in r)));
    assert.ok(!rows.some((r) => r.task_code === 'VENUE_SHORTLIST'));
  });
});

describe('mergedServicesOf: nhận ra dịch vụ đã gộp trong timeline có sẵn', () => {
  it('có Mốc chốt, không còn mã Chọn NCC nào thì là gộp; timeline cũ đầy đủ thì không', () => {
    assert.deepEqual(mergedServicesOf(T, ['VENUE_BOOK', 'PHOTO_SHORTLIST', 'PHOTO_BOOK', 'SELF_RINGS']), ['nha-hang']);
    assert.deepEqual(mergedServicesOf(T, T.map((t) => t.code)), []);
    assert.deepEqual(mergedServicesOf(T, []), []);
  });
});

describe('budgetPriorityOf: đọc mức chia và tỷ lệ Tùy chỉnh', () => {
  const key = (id: string) => ({ c1: 'decor', c2: 'chup-anh' })[id] as ServiceKey | undefined;
  it('dạng 2: tỷ lệ theo dịch vụ; dạng khác hoặc thiếu cột: không tỷ lệ', () => {
    assert.deepEqual(budgetPriorityOf({ budget_preset: 'CUSTOM', custom_weights: { format: 2, version: 1, items: [{ categoryId: 'c1', ratio: 40 }, { categoryId: 'c2', ratio: 10 }, { categoryId: 'x', ratio: 50 }] } }, key), {
      preset: 'CUSTOM',
      weights: { decor: 40, 'chup-anh': 10 },
    });
    assert.deepEqual(budgetPriorityOf({ budget_preset: 'VISUAL', custom_weights: { decor: 40 } }, key), { preset: 'VISUAL', weights: null });
    assert.deepEqual(budgetPriorityOf(null, key), { preset: null, weights: null });
    assert.deepEqual(budgetPriorityOf({ budget_preset: 'ABC' }, key), { preset: null, weights: null });
  });
});

describe('L > 80: không nhãn ưu tiên, kết quả bước 1–6 giống hệt planFrame cũ', () => {
  for (const L of [400, 271, 181, 120, 90, 81]) {
    for (const services of [ALL, TWO, ONE]) {
      it(`L = ${L}, ${services.length} dịch vụ`, () => {
        const wedding = addDays(I, L);
        const now = planTimeline(T, { wedding, today: I, services, preset: 'VISUAL' });
        const old = planFrame(T, { wedding, today: I, services });
        assert.equal(now.priority, null);
        assert.deepEqual(now.merged, []);
        assert.deepEqual(
          now.tasks.map((t) => ({ code: t.code, date: t.date, urgent: t.urgent, shortened: t.shortened, rules: t.rules })),
          old.tasks.map((t) => ({ code: t.code, date: t.date, urgent: t.urgent, shortened: t.shortened, rules: t.rules })),
        );
        assert.ok(now.tasks.every((t) => t.priority === null && !t.merged && t.hint === null));
      });
    }
  }
});

describe('kịch bản (I = 15/11/2026)', () => {
  for (const s of SCENARIOS) {
    const W = addDays(I, s.L);
    const p = run(s);
    const first = addDays(I, 1);
    const last = addDays(W, -1);
    const before = p.tasks.filter((t) => t.offset < 0);

    describe(`L = ${s.L}, ${s.services.length} dịch vụ, ${s.preset ?? 'không có ngân sách'}`, () => {
      it(`gộp: ${s.merge ? 'có' : 'không'} (mật độ ${p.density === Infinity ? '∞' : p.density.toFixed(2)})`, () => {
        assert.equal(p.merged.length > 0, s.merge);
        assert.equal(p.density > 1, s.merge);
        if (s.merge) assert.deepEqual([...p.merged].sort(), [...s.services].sort());
      });

      it('mọi hạn trước cưới trong [I + 1; W − 1]', () => {
        assert.equal(p.capSkipped, false);
        for (const t of before) assert.ok(t.date >= first && t.date <= last, `${t.code} ${t.date} ngoài [${first}; ${last}]`);
      });

      it('"Rà soát cuối" là việc trước cưới muộn nhất', () => {
        const fc = before.find((t) => t.code === 'SELF_FINAL_CHECK')!;
        for (const t of before) assert.ok(t.date <= fc.date, `${t.code} ${t.date} > Rà soát cuối ${fc.date}`);
      });

      it('việc sau cưới không đổi (W + 7)', () => {
        assert.equal(p.tasks.find((t) => t.code === 'SELF_THANKS')!.date, addDays(W, 7));
      });

      if (!s.merge) {
        it('chuỗi chưa gộp: Chọn NCC trước Mốc chốt', () => {
          const m = new Map(p.tasks.map((t) => [t.code, t.date]));
          for (const svc of s.services) {
            const chain = chainOf(svc);
            const book = m.get(chain.at(-1)!.code)!;
            for (const c of chain.slice(0, -1)) assert.ok(m.get(c.code)! < book, `${svc}: ${c.code} ${m.get(c.code)} ≥ ${book}`);
          }
        });
      } else {
        it('đã gộp: mỗi dịch vụ đúng một việc "Chọn và chốt …", không còn Chọn NCC, có ghi chú gợi ý', () => {
          for (const svc of s.services) {
            const mine = p.tasks.filter((t) => t.service === svc);
            assert.equal(mine.length, 1, svc);
            assert.ok(mine[0].merged && mine[0].code.endsWith('_BOOK') && mine[0].title.startsWith('Chọn và chốt '), svc);
            assert.equal(mine[0].hint, mergedHint(T, svc));
          }
          assert.ok(!p.tasks.some((t) => t.kind === 'CHOOSE'));
        });

        it('Bước 7.2: hạn việc gộp tăng dần theo thứ tự ưu tiên', () => {
          const dates = p.order.map((svc) => p.tasks.find((t) => t.service === svc)!.date);
          for (let i = 1; i < dates.length; i++) assert.ok(dates[i] >= dates[i - 1], `${p.order[i]} ${dates[i]} < ${p.order[i - 1]} ${dates[i - 1]}`);
          // trùng ngày chỉ khi đã chạm W − 1
          for (let i = 1; i < dates.length; i++) if (dates[i] === dates[i - 1]) assert.equal(dates[i], last, `trùng ${dates[i]} trước W − 1`);
        });
      }

      it(s.L <= 80 ? 'có nhãn ưu tiên 1..k liên tục, tiệc là 1' : 'không có nhãn ưu tiên', () => {
        if (s.L > 80) return assert.equal(p.priority, null);
        assert.deepEqual(Object.values(p.priority!).sort((a, b) => a! - b!), s.services.map((_, i) => i + 1));
        if (s.services.includes('nha-hang')) assert.equal(p.priority!['nha-hang'], 1);
      });
    });
  }
});

describe('nhãn ưu tiên tính theo HÔM NAY (L = W − hôm nay)', () => {
  const W = '2027-03-01';
  it('cùng đám cưới: hôm nay còn 81 ngày thì chưa có nhãn, còn 80 ngày thì có', () => {
    assert.equal(priorityLabels(ALL, dayOf(W) - dayOf(addDays(W, -81)), 'VISUAL'), null);
    assert.deepEqual(priorityLabels(ALL, dayOf(W) - dayOf(addDays(W, -80)), 'VISUAL'), { 'nha-hang': 1, 'chup-anh': 2, 'trang-phuc': 3, makeup: 4, decor: 5, 'hoa-cuoi': 6 });
  });
  it('không phụ thuộc ngày tạo: tạo khi còn 200 ngày, hôm nay còn 30 ngày vẫn có nhãn', () => {
    const atCreate = planTimeline(T, { wedding: W, today: addDays(W, -200), services: ALL, preset: 'SPACE' });
    assert.equal(atCreate.priority, null);
    assert.deepEqual(priorityLabels(ALL, 30, 'SPACE'), { 'nha-hang': 1, decor: 2, 'hoa-cuoi': 3, 'chup-anh': 4, 'trang-phuc': 5, makeup: 6 });
  });
  it('ngày cưới hôm nay hoặc đã qua: không nhãn', () => {
    assert.equal(priorityLabels(ALL, 0, 'BALANCED'), null);
    assert.equal(priorityLabels(ALL, -3, 'BALANCED'), null);
  });
  it('frameViewOf: Chọn NCC / Mốc chốt mang nhãn của dịch vụ; việc chung, việc đã xong không có', () => {
    const priority = priorityLabels(['nha-hang', 'decor'], 20, 'SPACE');
    const ctx = { merged: [] as ServiceKey[], priority };
    assert.equal(frameViewOf(T, { task_code: 'DECOR_SHORTLIST', status: 'Todo' }, ctx).priority, 2);
    assert.equal(frameViewOf(T, { task_code: 'VENUE_BOOK', status: 'Todo' }, ctx).priority, 1);
    assert.equal(frameViewOf(T, { task_code: 'VENUE_BOOK', status: 'Done' }, ctx).priority, null);
    assert.equal(frameViewOf(T, { task_code: 'SELF_RINGS', status: 'Todo' }, ctx).priority, null);
    assert.equal(frameViewOf(T, { task_code: null, status: 'Todo' }, ctx).priority, null);
    assert.equal(frameViewOf(T, { task_code: 'DECOR_SHORTLIST', status: 'Todo' }, { merged: [], priority: null }).priority, null);
  });
});

describe('việc gộp: nhận ra bằng mã, gợi ý lấy từ bộ mẫu lúc hiển thị', () => {
  const merged = mergedServicesOf(T, ['VENUE_BOOK', 'PHOTO_SHORTLIST', 'PHOTO_CONSULT', 'PHOTO_BOOK', 'SELF_RINGS']);
  const ctx = { merged, priority: null };
  it('Mốc chốt của dịch vụ gộp: mergedFrame, gợi ý từ bộ mẫu, giữ nút Gợi ý khi chưa chốt', () => {
    assert.deepEqual(frameViewOf(T, { task_code: 'VENUE_BOOK', status: 'Todo' }, ctx), {
      priority: null,
      mergedFrame: true,
      mergedHint: mergedHint(T, 'nha-hang'),
      suggestMerged: true,
    });
  });
  it('đã chốt (Done): vẫn là việc gộp nhưng ẩn gợi ý và nút Gợi ý', () => {
    assert.deepEqual(frameViewOf(T, { task_code: 'VENUE_BOOK', status: 'Done' }, ctx), { priority: null, mergedFrame: true, mergedHint: null, suggestMerged: false });
  });
  it('dịch vụ không gộp: Mốc chốt bình thường, không gợi ý', () => {
    const v = frameViewOf(T, { task_code: 'PHOTO_BOOK', status: 'Todo' }, ctx);
    assert.equal(v.mergedFrame, false);
    assert.equal(v.mergedHint, null);
    assert.equal(v.suggestMerged, false);
  });
  it('ghi chú của khách không ảnh hưởng gợi ý (gợi ý không đọc cột note, khách đổi tên việc cũng không sao)', () => {
    const base = frameViewOf(T, { task_code: 'VENUE_BOOK', status: 'Todo' }, ctx);
    for (const note of [null, '', 'Mẹ muốn tiệc ở quận 1', 'Gợi ý: cái khác hẳn']) {
      const row = { task_code: 'VENUE_BOOK', status: 'Todo', note, title: 'Tên khách tự đổi' };
      assert.deepEqual(frameViewOf(T, row, ctx), base, String(note));
    }
  });
});

describe('cờ Gấp tính với I = created_date của từng dòng (dữ liệu giả, không đụng CSDL)', () => {
  /** Dòng giả của timeline: mã, hạn, ngày hệ thống tính hạn (created_date giờ VN), đã xong chưa */
  type Row = { code: string; date: string; planned: string; done: boolean };
  /** Mô phỏng onWeddingCategories: sinh việc chưa có với I = hôm nay, created_date = hôm nay */
  const generate = (rows: Row[], wedding: string, today: string, services: ServiceKey[]): Row[] => {
    const have = new Set(rows.map((r) => r.code));
    const merged = new Set(mergedServicesOf(T, have));
    const fresh = planTimeline(T, { wedding, today, services })
      .tasks.filter((t) => !have.has(t.code) && !(t.kind === 'CHOOSE' && t.service && merged.has(t.service)))
      .map((t) => ({ code: t.code, date: t.date, planned: today, done: false }));
    return [...rows, ...fresh];
  };
  /** Mô phỏng đổi ngày cưới + applyWeddingDateChange: dòng tính lại thì hạn mới và created_date = hôm nay */
  const changeDate = (rows: Row[], wedding: string, today: string, services: ServiceKey[]): Row[] => {
    const { changes, recomputed } = replanFrame(T, { wedding, today, tasks: rows.map((r) => ({ code: r.code, date: r.date, done: r.done })), services });
    const to = new Map(changes.map((c) => [c.code, c.to]));
    const re = new Set(recomputed);
    return rows.map((r) => (re.has(r.code) ? { ...r, date: to.get(r.code) ?? r.date, planned: today } : r));
  };
  const urgentOf = (rows: Row[], wedding: string, services: ServiceKey[]) =>
    frameUrgentCodes(T, { wedding, services, merged: mergedServicesOf(T, rows.map((r) => r.code)), rows });
  /** Cách cũ: mọi dòng tính với I = ngày tạo đám cưới */
  const urgentOld = (rows: Row[], wedding: string, created: string, services: ServiceKey[]) =>
    new Set(planTimeline(T, { wedding, today: created, services, merged: mergedServicesOf(T, rows.map((r) => r.code)) }).tasks.filter((t) => t.urgent).map((t) => t.code));

  const W = '2027-06-03';
  const C = addDays(W, -200);
  const FLOWER = ['FLOWER_SHORTLIST', 'FLOWER_PICK', 'FLOWER_BOOK'];

  it('tạo khi còn 200 ngày, còn 30 ngày thêm hoa: 3 việc hoa Gấp (cách cũ thì không)', () => {
    const base: ServiceKey[] = ['nha-hang', 'chup-anh'];
    const all: ServiceKey[] = [...base, 'hoa-cuoi'];
    let rows = generate([], W, C, base);
    const X = addDays(W, -30);
    rows = generate(rows, W, X, all);
    assert.deepEqual(rows.filter((r) => FLOWER.includes(r.code)).map((r) => r.planned), [X, X, X]);
    const urgent = urgentOf(rows, W, all);
    for (const code of FLOWER) assert.ok(urgent.has(code), `${code} phải Gấp`);
    // đúng bằng cờ Gấp của planTimeline với I = ngày thêm
    const atAdd = planTimeline(T, { wedding: W, today: X, services: all });
    for (const code of FLOWER) assert.equal(urgent.has(code), atAdd.tasks.find((t) => t.code === code)!.urgent);
    // việc cũ của tiệc, chụp ảnh không bị ảnh hưởng (I = ngày tạo, L = 200: không Gấp)
    for (const r of rows.filter((x) => x.planned === C)) assert.equal(urgent.has(r.code), false, r.code);
    // cách cũ (I = ngày tạo đám cưới) bỏ sót
    for (const code of FLOWER) assert.equal(urgentOld(rows, W, C, all).has(code), false);
  });

  it('tạo khi còn 200 ngày, dời ngày cưới còn 40 ngày: việc được tính lại mang Gấp đúng', () => {
    const S: ServiceKey[] = ['nha-hang', 'chup-anh', 'trang-phuc'];
    let rows = generate([], W, C, S);
    rows = rows.map((r) => (r.code === 'SELF_FAMILY_ALIGN' ? { ...r, done: true } : r)); // một việc đã xong: không tính lại
    const D = addDays(C, 100);
    const W2 = addDays(D, 40);
    rows = changeDate(rows, W2, D, S);
    const expected = planTimeline(T, { wedding: W2, today: D, services: S });
    const urgent = urgentOf(rows, W2, S);
    for (const r of rows.filter((x) => !x.done)) {
      const t = expected.tasks.find((x) => x.code === r.code)!;
      assert.equal(r.date, t.date, r.code);
      assert.equal(urgent.has(r.code), t.urgent, `${r.code}: Gấp phải là ${t.urgent}`);
    }
    assert.ok(urgent.size > 0, 'có việc Gấp sau khi dời');
    // việc đã xong giữ created_date cũ
    assert.equal(rows.find((r) => r.code === 'SELF_FAMILY_ALIGN')!.planned, C);
    // cách cũ (I = ngày tạo, W mới, L = 140): không việc nào Gấp
    assert.equal(urgentOld(rows, W2, C, S).size, 0);
  });

  it('dòng tính lại ra đúng hạn cũ vẫn được đặt lại created_date (recomputed ⊇ changes)', () => {
    const S: ServiceKey[] = ['nha-hang'];
    const rows = generate([], W, C, S);
    const { changes, recomputed } = replanFrame(T, { wedding: addDays(W, 1), today: addDays(C, 1), tasks: rows.map((r) => ({ code: r.code, date: r.date, done: false })), services: S });
    for (const c of changes) assert.ok(recomputed.includes(c.code), c.code);
    assert.equal(recomputed.length, rows.length);
  });

  it('không thêm dịch vụ, không đổi ngày: cờ Gấp y như cách cũ (mọi L)', () => {
    for (const L of [400, 200, 90, 60, 30, 21, 10, 5, 2, 1]) {
      for (const S of [ALL, TWO, ONE]) {
        const wedding = addDays(I, L);
        const rows = generate([], wedding, I, S);
        assert.deepEqual([...urgentOf(rows, wedding, S)].sort(), [...urgentOld(rows, wedding, I, S)].sort(), `L = ${L}, ${S.length} dịch vụ`);
      }
    }
  });

  it('nhóm có ngày cưới không sau ngày tính hạn: không cờ Gấp, không lỗi', () => {
    assert.deepEqual([...frameUrgentCodes(T, { wedding: I, services: ALL, merged: [], rows: [{ code: 'VENUE_BOOK', planned: I }] })], []);
  });
});

describe('Bước 7.2: cờ Gấp đi theo hạn', () => {
  it('L = 30, 6 dịch vụ: tập (hạn, Gấp) của việc gộp trước và sau khi giao theo ưu tiên là một (khi không phải lùi)', () => {
    const wedding = addDays(I, 30);
    const raw = planFrame(mergeChains(T, ALL), { wedding, today: I, services: ALL });
    const p = planTimeline(T, { wedding, today: I, services: ALL, preset: 'VISUAL' });
    const books = new Set(T.filter((t) => t.kind === 'BOOK').map((t) => t.code));
    const pairs = (xs: { code: string; date: string; urgent: boolean }[]) => xs.filter((t) => books.has(t.code)).map((t) => `${t.date}|${t.urgent}`).sort();
    const rawDates = raw.tasks.filter((t) => books.has(t.code)).map((t) => t.date);
    if (new Set(rawDates).size === rawDates.length) assert.deepEqual(pairs(p.tasks), pairs(raw.tasks));
    // hạn sớm nhất cho dịch vụ ưu tiên cao nhất
    assert.equal(p.tasks.find((t) => t.service === p.order[0])!.date, [...rawDates].sort()[0]);
  });
});

describe('L ≤ 1 (cưới ngày mai): W − 1 < I + 1, giữ hành vi hiện tại', () => {
  it('không chặn W − 1; hạn trước cưới như planFrame trên danh sách đã gộp (dồn về I + 1 = W, Gấp)', () => {
    const wedding = addDays(I, 1);
    const p = planTimeline(T, { wedding, today: I, services: ALL, preset: 'BALANCED' });
    assert.equal(p.capSkipped, true);
    assert.equal(p.density, Infinity);
    const raw = planFrame(mergeChains(T, ALL), { wedding, today: I, services: ALL });
    assert.deepEqual(
      p.tasks.map((t) => [t.code, t.date, t.urgent]),
      raw.tasks.map((t) => [t.code, t.date, t.urgent]),
    );
    for (const t of p.tasks.filter((x) => x.offset < 0)) assert.equal(t.date, wedding, t.code);
  });

  it('cưới hôm nay hoặc đã qua: chặn như cũ (RangeError)', () => {
    assert.throws(() => planTimeline(T, { wedding: I, today: I, services: ALL }), RangeError);
  });
});

describe('đổi ngày cưới: giữ trạng thái gộp như lúc sinh', () => {
  it('timeline đã gộp (L = 10) đổi sang L = 200: không sinh lại việc Chọn NCC, việc gộp đổi hạn theo pipeline', () => {
    const p = planTimeline(T, { wedding: addDays(I, 10), today: I, services: ALL });
    const tasks = p.tasks.map((t) => ({ code: t.code, date: t.date, done: false }));
    const changes = replanOnWeddingDateChange(T, { wedding: addDays(I, 200), today: I, tasks, services: ALL });
    assert.ok(changes.length > 0);
    assert.ok(!changes.some((c) => T.find((t) => t.code === c.code)!.kind === 'CHOOSE'));
    const expected = new Map(planTimeline(T, { wedding: addDays(I, 200), today: I, services: ALL, merged: ALL }).tasks.map((t) => [t.code, t.date]));
    for (const c of changes) assert.equal(c.to, expected.get(c.code), c.code);
  });

  it('timeline chưa gộp đổi sang ngày rất gần: vẫn không gộp (không đổi mã), hạn trong [I + 1; W − 1]', () => {
    const p = planTimeline(T, { wedding: addDays(I, 120), today: I, services: ALL });
    const tasks = p.tasks.map((t) => ({ code: t.code, date: t.date, done: false }));
    const W = addDays(I, 12);
    const after = new Map(tasks.map((t) => [t.code, t.date]));
    for (const c of replanOnWeddingDateChange(T, { wedding: W, today: I, tasks, services: ALL })) after.set(c.code, c.to);
    for (const t of p.tasks.filter((x) => x.offset < 0)) assert.ok(after.get(t.code)! <= addDays(W, -1) && after.get(t.code)! >= addDays(I, 1), `${t.code} ${after.get(t.code)}`);
  });
});

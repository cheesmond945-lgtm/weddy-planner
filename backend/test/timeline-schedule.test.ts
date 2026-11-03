/*
 * Test bộ tính ngày timeline (src/modules/weddings/timeline-schedule.ts), chạy bằng test runner có sẵn của Node:
 *   npm test
 * Đợt 2: mẫu trong code chỉ còn việc KHUNG (31 việc); việc chi tiết của đơn lấy từ package_tasks của gói (planPackageTasks).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SUGGEST_LABEL, TIMELINE_TEMPLATES, isFrameKind, suggestOf, templateOf, type ServiceKey } from '../src/modules/weddings/timeline-templates.ts';
import { MIN_AFTER_DEPOSIT, dayOf, keepThreshold, levelOf, planFrame, planPackageTasks, replanOnWeddingDateChange, ymd, type DateChange, type ExistingTask } from '../src/modules/weddings/timeline-schedule.ts';

const T = TIMELINE_TEMPLATES;
const W = '2027-03-20';
const SERVICES: ServiceKey[] = ['nha-hang', 'chup-anh', 'trang-phuc', 'decor', 'makeup', 'hoa-cuoi'];
const addDays = (s: string, n: number) => ymd(dayOf(s) + n);
const byCode = (tasks: { code: string; date: string }[]) => new Map(tasks.map((t) => [t.code, t]));
const dateOf = (m: Map<string, { date: string }>, code: string) => m.get(code)!.date;
const weekday = (s: string) => new Date(`${s}T00:00:00Z`).getUTCDay();

/** Ngày của 31 việc khung với W = 20/03/2027, nhập 19/12/2026 (L = 91): do planFrame tính, đã rà tay theo luật. */
const SHEET: [string, string][] = [
  ['SELF_FAMILY_ALIGN', '2026-12-20'],
  ['SELF_GUEST_DRAFT', '2026-12-23'],
  ['VENUE_SHORTLIST', '2026-12-25'],
  ['VENUE_TOUR', '2026-12-27'],
  ['PHOTO_SHORTLIST', '2026-12-30'],
  ['VENUE_TASTE', '2026-12-31'],
  ['PHOTO_CONSULT', '2027-01-01'],
  ['VENUE_BOOK', '2027-01-02'],
  ['PHOTO_BOOK', '2027-01-03'],
  ['ATTIRE_SHORTLIST', '2027-01-05'],
  ['DECOR_SHORTLIST', '2027-01-06'],
  ['ATTIRE_TRY_STORE', '2027-01-07'],
  ['ATTIRE_PICK', '2027-01-08'],
  ['ATTIRE_BOOK', '2027-01-09'],
  ['DECOR_VISIT', '2027-01-09'],
  ['DECOR_SCOPE', '2027-01-10'],
  ['MAKEUP_SHORTLIST', '2027-01-10'],
  ['DECOR_BOOK', '2027-01-11'],
  ['MAKEUP_ASSESS', '2027-01-13'],
  ['MAKEUP_BOOK', '2027-01-14'],
  ['SELF_RINGS', '2027-01-15'],
  ['FLOWER_SHORTLIST', '2027-01-18'],
  ['SELF_INVITE_PRINT', '2027-01-19'],
  ['FLOWER_PICK', '2027-01-24'],
  ['FLOWER_BOOK', '2027-02-03'],
  ['SELF_REGISTER', '2027-02-08'],
  ['SELF_INVITE_SEND', '2027-02-18'],
  ['SELF_CARS', '2027-02-23'],
  ['SELF_SCRIPT', '2027-02-27'],
  ['SELF_FINAL_CHECK', '2027-03-17'],
  ['SELF_THANKS', '2027-03-27'],
];

/** 34 mã việc chi tiết sinh từ mẫu cũ (đợt 1): còn trong CSDL của các đơn đã cọc nhưng không còn trong mẫu. */
const OLD_DETAIL_CODES = [
  'VENUE_HALL_CONFIRM', 'VENUE_TASTING', 'VENUE_MENU_FINAL', 'VENUE_EVENT_FINAL', 'VENUE_EVENT', 'VENUE_PAY',
  'PHOTO_CONCEPT', 'PHOTO_ALBUM_SHOOT', 'PHOTO_PICK_EDIT', 'PHOTO_REVIEW', 'PHOTO_DELIVERY_PREP', 'PHOTO_EVENT', 'PHOTO_PAY', 'PHOTO_FILES',
  'ATTIRE_MEASURE', 'ATTIRE_ALBUM_PICKUP', 'ATTIRE_FIT_FIRST', 'ATTIRE_FIT_LAST', 'ATTIRE_RECEIVE', 'ATTIRE_PAY', 'ATTIRE_RETURN',
  'DECOR_BRIEF', 'DECOR_REVIEW_MOCKUP', 'DECOR_FINAL', 'DECOR_EVENT', 'DECOR_PAY',
  'MAKEUP_TRIAL', 'MAKEUP_FINAL', 'MAKEUP_EVENT', 'MAKEUP_PAY',
  'FLOWER_PICK_STYLE', 'FLOWER_FINAL', 'FLOWER_EVENT', 'FLOWER_PAY',
];

describe('mẫu timeline', () => {
  it('31 việc khung, mã duy nhất, đủ 6 hạng mục + việc chung, không còn việc chi tiết', () => {
    assert.equal(T.length, 31);
    assert.ok(T.every((t) => isFrameKind(t.kind)));
    assert.equal(new Set(T.map((t) => t.code)).size, 31);
    assert.deepEqual([...new Set(T.map((t) => t.service))].map(String).sort(), ['chup-anh', 'decor', 'hoa-cuoi', 'makeup', 'nha-hang', 'null', 'trang-phuc']);
  });

  it('mã Mốc chốt kết thúc _BOOK, mỗi hạng mục đúng một', () => {
    for (const s of SERVICES) assert.equal(T.filter((t) => t.service === s && t.kind === 'BOOK').length, 1);
    assert.ok(T.filter((t) => t.kind === 'BOOK').every((t) => t.code.endsWith('_BOOK')));
    assert.ok(T.filter((t) => t.kind !== 'BOOK').every((t) => !t.code.endsWith('_BOOK')));
  });

  it('34 mã việc chi tiết cũ không còn trong mẫu (templateOf trả undefined, không crash)', () => {
    assert.equal(OLD_DETAIL_CODES.length, 34);
    for (const c of OLD_DETAIL_CODES) assert.equal(templateOf(c), undefined, c);
    for (const c of ['PKG:abc', 'PAY:abc', 'SELF_ENGAGEMENT', 'DECOR_CONCEPT', '']) assert.equal(templateOf(c), undefined, c);
    assert.equal(templateOf(null), undefined);
  });

  it('bốn mã khung mới không trùng mã chi tiết cũ', () => {
    for (const c of ['VENUE_TASTE', 'ATTIRE_PICK', 'DECOR_SCOPE', 'FLOWER_PICK']) {
      assert.equal(templateOf(c)!.kind, 'CHOOSE', c);
      assert.ok(!OLD_DETAIL_CODES.includes(c), c);
    }
  });
});

describe('nút "Gợi ý {dịch vụ}"', () => {
  it('cờ showSuggest chỉ ở việc Chọn NCC ĐẦU TIÊN của mỗi dịch vụ (theo thứ tự mẫu), không suy theo tên', () => {
    const flagged = T.filter((t) => t.showSuggest);
    assert.deepEqual(flagged.map((t) => t.code).sort(), ['ATTIRE_SHORTLIST', 'DECOR_SHORTLIST', 'FLOWER_SHORTLIST', 'MAKEUP_SHORTLIST', 'PHOTO_SHORTLIST', 'VENUE_SHORTLIST']);
    for (const s of SERVICES) {
      const choose = T.filter((t) => t.service === s && t.kind === 'CHOOSE').sort((a, b) => a.order - b.order);
      assert.equal(choose.filter((t) => t.showSuggest).length, 1, s);
      assert.equal(choose[0].showSuggest, true, `${s}: việc Chọn NCC đầu tiên`);
    }
    assert.ok(flagged.every((t) => t.kind === 'CHOOSE'));
  });

  it('việc Chọn NCC đầu tiên có nút (cả khi đã tick xong); các việc Chọn NCC sau thì không', () => {
    const first = templateOf('VENUE_SHORTLIST');
    assert.equal(suggestOf(first, { done: false, hasCancelledOrder: false }), true);
    assert.equal(suggestOf(first, { done: true, hasCancelledOrder: false }), true);
    for (const code of ['VENUE_TOUR', 'PHOTO_CONSULT', 'ATTIRE_TRY_STORE', 'DECOR_VISIT', 'MAKEUP_ASSESS']) {
      assert.equal(suggestOf(templateOf(code), { done: false, hasCancelledOrder: false }), false, code);
    }
  });

  it('Mốc chốt: không có nút, trừ khi đang Todo và có dòng "đơn đã hủy"', () => {
    const book = templateOf('DECOR_BOOK');
    assert.equal(suggestOf(book, { done: false, hasCancelledOrder: false }), false);
    assert.equal(suggestOf(book, { done: false, hasCancelledOrder: true }), true);
    assert.equal(suggestOf(book, { done: true, hasCancelledOrder: true }), false);
  });

  it('việc tự làm, việc khách tự thêm hoặc mã cũ: không có nút', () => {
    for (const t of T.filter((x) => x.kind === 'SELF')) assert.equal(suggestOf(t, { done: false, hasCancelledOrder: true }), false, t.code);
    assert.equal(suggestOf(undefined, { done: false, hasCancelledOrder: true }), false);
  });

  it('SUGGEST_LABEL đủ 6 dịch vụ, đúng chữ; mọi việc có nút đều tra được nhãn', () => {
    assert.deepEqual(SUGGEST_LABEL, {
      'nha-hang': 'Gợi ý trung tâm tiệc cưới',
      'chup-anh': 'Gợi ý studio chụp ảnh & quay phim',
      'trang-phuc': 'Gợi ý cửa hàng trang phục cưới',
      decor: 'Gợi ý đơn vị trang trí',
      makeup: 'Gợi ý chuyên viên trang điểm',
      'hoa-cuoi': 'Gợi ý tiệm hoa cưới',
    });
    for (const t of T) if (suggestOf(t, { done: false, hasCancelledOrder: true })) assert.ok(t.service && SUGGEST_LABEL[t.service], t.code);
  });
});

describe('mức độ và ngưỡng K', () => {
  it('levelOf theo L', () => {
    assert.equal(levelOf(400), 'FAR');
    assert.equal(levelOf(271), 'FAR');
    assert.equal(levelOf(270), 'NORMAL');
    assert.equal(levelOf(91), 'NORMAL');
    assert.equal(levelOf(81), 'NORMAL');
    assert.equal(levelOf(80), 'SOON');
    assert.equal(levelOf(21), 'SOON');
    assert.equal(levelOf(20), 'VERY_SOON');
    assert.equal(levelOf(1), 'VERY_SOON');
  });

  it('ngày cưới ≤ hôm nay: chặn', () => {
    assert.throws(() => levelOf(0), RangeError);
    assert.throws(() => planFrame(T, { wedding: '2026-12-19', today: '2026-12-19', services: SERVICES }), RangeError);
    assert.throws(() => planFrame(T, { wedding: '2026-12-01', today: '2026-12-19', services: SERVICES }), RangeError);
  });

  it('K = min(60, max(floor(L1/2), L1 − 20)); L1 ≥ 270 không ép', () => {
    assert.equal(keepThreshold(399), null);
    assert.equal(keepThreshold(270), null);
    assert.equal(keepThreshold(269), 60);
    assert.equal(keepThreshold(179), 60);
    assert.equal(keepThreshold(90), 60);
    assert.equal(keepThreshold(80), 60);
    assert.equal(keepThreshold(44), 24);
    assert.equal(keepThreshold(19), 9);
    assert.equal(keepThreshold(6), 3);
  });
});

describe('khung 31 việc (cưới 20/03/2027, nhập 19/12/2026, L = 91)', () => {
  const frame = planFrame(T, { wedding: W, today: '2026-12-19', services: SERVICES });
  const m = byCode(frame.tasks);

  it('L = 91, K = 60, mức Bình thường', () => {
    assert.equal(frame.L, 91);
    assert.equal(frame.K, 60);
    assert.equal(frame.level, 'NORMAL');
  });

  for (const [code, date] of SHEET) it(`${code}: ${date}`, () => assert.equal(dateOf(m, code), date));

  it('đúng 31 dòng, không dòng nào trước I+1', () => {
    assert.equal(frame.tasks.length, 31);
    assert.ok(frame.tasks.every((t) => t.date >= '2026-12-20'));
  });

  it('dời cuối tuần chỉ áp dụng khi lùi được', () => {
    assert.deepEqual(frame.tasks.filter((t) => t.rules.includes('dời cuối tuần')).map((t) => t.code), ['VENUE_TOUR']);
  });
});

describe('khung theo từng L (cưới 20/03/2027)', () => {
  for (const L of [400, 270, 180, 150, 91, 60, 45, 20, 7]) {
    const today = addDays(W, -L);
    const first = addDays(today, 1);
    const frame = planFrame(T, { wedding: W, today, services: SERVICES });
    const m = byCode(frame.tasks);

    describe(`L = ${L} (${frame.level}, K = ${frame.K})`, () => {
      it('không ngày nào trước I+1', () => {
        for (const t of frame.tasks) assert.ok(t.date >= first, `${t.code} ${t.date} < ${first}`);
      });

      it('Chọn NCC < Mốc chốt trong từng dịch vụ, Chọn NCC cách nhau ≥ 1 ngày', () => {
        for (const s of SERVICES) {
          const chain = T.filter((t) => t.service === s && (t.kind === 'CHOOSE' || t.kind === 'BOOK')).sort((a, b) => a.order - b.order);
          for (let i = 1; i < chain.length; i++) assert.ok(dateOf(m, chain[i].code) > dateOf(m, chain[i - 1].code), `${s}: ${chain[i - 1].code} → ${chain[i].code}`);
        }
      });

      it('việc Tự làm có d ≤ K giữ nguyên (trừ khi bị kẹp về I+1)', () => {
        const K = frame.K ?? Infinity;
        for (const t of T.filter((x) => x.kind === 'SELF' && x.offset <= 0 && -x.offset <= K)) {
          assert.equal(dateOf(m, t.code), ymd(Math.max(dayOf(W) + t.offset, dayOf(first))), t.code);
        }
      });

      it('W−3, W+7 không bao giờ bị ép', () => {
        assert.equal(dateOf(m, 'SELF_FINAL_CHECK'), ymd(Math.max(dayOf(W) - 3, dayOf(first))));
        assert.equal(dateOf(m, 'SELF_THANKS'), addDays(W, 7));
      });

      it('việc cuối tuần đã dời thì rơi T7/CN; không dời thì lùi bị chặn', () => {
        for (const t of frame.tasks) if (t.rules.includes('dời cuối tuần')) assert.ok([0, 6].includes(weekday(t.date)), `${t.code} ${t.date}`);
        for (const s of SERVICES) {
          const chain = T.filter((t) => t.service === s && (t.kind === 'CHOOSE' || t.kind === 'BOOK')).sort((a, b) => a.order - b.order);
          chain.forEach((t, i) => {
            if (!t.weekendPreferred) return;
            const d = dateOf(m, t.code);
            if ([0, 6].includes(weekday(d))) return;
            const back = addDays(d, -weekday(d));
            const lo = i === 0 ? first : addDays(dateOf(m, chain[i - 1].code), 1);
            assert.ok(back < lo, `${t.code} ${d}: còn chỗ lùi tới ${back} (≥ ${lo}) nhưng không dời`);
          });
        }
        if (L >= 270) for (const t of T.filter((x) => x.weekendPreferred)) assert.ok([0, 6].includes(weekday(dateOf(m, t.code))), t.code);
      });

      it('cờ Gấp: mức Bình thường trở lên không có việc nào Gấp (trừ bị kẹp về I+1)', () => {
        const urgent = frame.tasks.filter((t) => t.urgent).length;
        if (frame.level === 'FAR' || frame.level === 'NORMAL') assert.equal(urgent, 0);
        else assert.ok(urgent > 0);
        for (const t of frame.tasks) if (t.rules.includes('kẹp I+1')) assert.equal(t.urgent, true, t.code);
      });
    });
  }
});

describe('planPackageTasks (việc NCC khai theo gói)', () => {
  const E = W;
  const offs = (...n: number[]) => n.map((offsetDays, i) => ({ id: `t${i}`, offsetDays }));
  const dates = (r: ReturnType<typeof planPackageTasks>) => r.tasks.map((t) => t.date);

  it('MIN_AFTER_DEPOSIT = 2', () => assert.equal(MIN_AFTER_DEPOSIT, 2));

  it('đủ thời gian (cọc sớm): ngày = E + offset, không co, không việc nào gấp', () => {
    const r = planPackageTasks({ D: addDays(E, -200), E, I: addDays(E, -200), tasks: offs(-30, -14, -7, 0, 3) });
    assert.equal(r.scale, 1);
    assert.deepEqual(dates(r), [addDays(E, -30), addDays(E, -14), addDays(E, -7), E, addDays(E, 3)]);
    assert.ok(r.tasks.every((t) => !t.urgent && !t.shortened));
  });

  it('việc trước E không rơi vào đúng ngày E; việc từ E trở đi giữ nguyên offset', () => {
    const r = planPackageTasks({ D: addDays(E, -100), E, I: addDays(E, -100), tasks: offs(-1, 0, 120) });
    assert.deepEqual(dates(r), [addDays(E, -1), E, addDays(E, 120)]);
  });

  it('cọc muộn (D = E−10): co theo hệ số, trong [D+2, E−1], thứ tự giữ nguyên, không việc nào trước D+2', () => {
    const D = addDays(E, -10);
    const r = planPackageTasks({ D, E, I: D, tasks: offs(-30, -21, -14, -7, -3, -1) });
    assert.equal(r.space, 8);
    assert.ok(r.scale < 1);
    const ds = dates(r);
    for (const d of ds) assert.ok(d >= addDays(D, 2) && d <= addDays(E, -1), d);
    assert.deepEqual([...ds].sort(), ds, 'thứ tự');
    assert.equal(ds[0], addDays(D, 2)); // việc xa nhất sát D+2
    assert.ok(r.tasks.every((t) => !t.urgent));
  });

  it('không bao giờ có việc trước D+2 dù hệ số co và làm tròn thế nào (quét nhiều D)', () => {
    for (let gap = 3; gap <= 120; gap += 7) {
      const D = addDays(E, -gap);
      const r = planPackageTasks({ D, E, I: D, tasks: offs(-90, -60, -45, -30, -14, -7, -2) });
      for (const t of r.tasks) assert.ok(t.date >= addDays(D, 2) && t.date <= addDays(E, -1), `gap ${gap}: ${t.date}`);
      assert.deepEqual(dates(r), [...dates(r)].sort(), `gap ${gap} thứ tự`);
    }
  });

  it('E − (D+2) ≤ 0: dồn việc trước E về max(I+1, D+1), cờ gấp; việc từ E trở đi vẫn E + offset', () => {
    const D = addDays(E, -1); // lo = E + 1
    const r = planPackageTasks({ D, E, I: D, tasks: offs(-30, -7, 0, 5) });
    assert.ok(r.space <= 0);
    assert.deepEqual(dates(r), [E, E, E, addDays(E, 5)]);
    assert.deepEqual(r.tasks.map((t) => t.urgent), [true, true, false, false]);
    // hôm nay muộn hơn ngày cọc
    const late = planPackageTasks({ D, E, I: addDays(D, 1), tasks: offs(-5) });
    assert.equal(late.tasks[0].date, addDays(D, 2));
  });

  it('danh sách rỗng: không có việc', () => {
    assert.deepEqual(planPackageTasks({ D: addDays(E, -50), E, I: E, tasks: [] }).tasks, []);
  });
});

describe('đổi ngày cưới (chỉ việc khung)', () => {
  const W0 = '2027-03-20';
  const I0 = '2026-12-19';
  const NOW = '2026-12-29';
  const isFrameCode = (code: string) => !!templateOf(code);

  function current(doneCodes: string[] = []) {
    const tasks: ExistingTask[] = planFrame(T, { wedding: W0, today: I0, services: SERVICES }).tasks.map((t) => ({ code: t.code, date: t.date, done: doneCodes.includes(t.code) }));
    // việc gắn đơn và việc cũ: không có mẫu nên không bị đụng
    tasks.push({ code: 'PKG:abc', date: '2027-03-01', done: false }, { code: 'PAY:abc', date: '2027-03-27', done: false }, { code: 'ATTIRE_FIT_FIRST', date: '2027-02-07', done: false });
    return tasks;
  }
  const run = (tasks: ExistingTask[], wedding: string): DateChange[] => replanOnWeddingDateChange(T, { wedding, today: NOW, tasks, services: SERVICES });

  for (const [label, newW] of [['dời sớm 60 ngày', addDays(W0, -60)], ['dời muộn 90 ngày', addDays(W0, 90)]] as const) {
    it(`${label}: chỉ việc khung chưa xong đổi, theo planFrame với W mới và I = hôm nay`, () => {
      const tasks = current(['VENUE_SHORTLIST']);
      const changes = run(tasks, newW);
      const expected = byCode(planFrame(T, { wedding: newW, today: NOW, services: SERVICES }).tasks);
      assert.ok(changes.length > 0);
      for (const c of changes) {
        assert.ok(isFrameCode(c.code), c.code);
        assert.equal(c.to, expected.get(c.code)!.date, c.code);
        assert.ok(c.to > NOW, `${c.code} ${c.to} không sau hôm nay`);
        assert.notEqual(c.from, c.to);
      }
      const changed = new Set(changes.map((c) => c.code));
      for (const code of ['VENUE_SHORTLIST', 'PKG:abc', 'PAY:abc', 'ATTIRE_FIT_FIRST']) assert.equal(changed.has(code), false, code);
    });

    it(`${label}: Chọn NCC < Mốc chốt trong từng dịch vụ sau khi tính lại`, () => {
      const tasks = current();
      const after = new Map(tasks.map((t) => [t.code, t.date]));
      for (const c of run(tasks, newW)) after.set(c.code, c.to);
      for (const s of SERVICES) {
        const choose = T.filter((t) => t.service === s && t.kind === 'CHOOSE').map((t) => after.get(t.code)!);
        const book = after.get(T.find((t) => t.service === s && t.kind === 'BOOK')!.code)!;
        for (const c of choose) assert.ok(c < book, `${s} ${c} >= ${book}`);
      }
    });
  }

  it('ngày cưới mới không sau hôm nay: chặn', () => {
    assert.throws(() => run(current(), NOW), RangeError);
    assert.throws(() => run(current(), '2026-12-01'), RangeError);
  });
});

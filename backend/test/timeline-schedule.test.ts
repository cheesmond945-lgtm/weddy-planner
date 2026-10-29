/*
 * Test bộ tính ngày timeline (src/modules/weddings/timeline-schedule.ts), chạy bằng test runner có sẵn của Node:
 *   npm test
 * Nguồn chuẩn: sheet "Ví dụ 90 ngày" của docs/timeline/WebPlan_Timeline_ban_gon (2).xlsx (cưới 20/03/2027, nhập 19/12/2026).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MIN_AFTER_DEPOSIT, TIMELINE_TEMPLATES, suggestOf, templateOf, type ServiceKey } from '../src/modules/weddings/timeline-templates.ts';
import {
  dayOf,
  defaultAlbumDate,
  keepThreshold,
  levelOf,
  newDetailTasks,
  planDetails,
  planFrame,
  replanAlbumTasks,
  replanOnWeddingDateChange,
  ymd,
  type DateChange,
  type ExistingTask,
  type ScheduledTask,
} from '../src/modules/weddings/timeline-schedule.ts';

const T = TIMELINE_TEMPLATES;
const W = '2027-03-20';
const SERVICES: ServiceKey[] = ['nha-hang', 'chup-anh', 'trang-phuc', 'decor', 'makeup', 'hoa-cuoi'];
const addDays = (s: string, n: number) => ymd(dayOf(s) + n);
const byCode = (tasks: ScheduledTask[]) => new Map(tasks.map((t) => [t.code, t]));
const dateOf = (m: Map<string, ScheduledTask>, code: string) => m.get(code)!.date;

/** Ngày trong file xlsx, theo task_code (62 dòng). */
const SHEET: [string, string][] = [
  ['SELF_FAMILY_ALIGN', '2026-12-20'],
  ['SELF_GUEST_DRAFT', '2026-12-23'],
  ['VENUE_SHORTLIST', '2026-12-25'],
  ['VENUE_TOUR', '2026-12-27'],
  ['PHOTO_SHORTLIST', '2026-12-30'],
  ['PHOTO_CONSULT', '2027-01-02'],
  ['VENUE_BOOK', '2027-01-02'],
  ['PHOTO_BOOK', '2027-01-03'],
  ['VENUE_HALL_CONFIRM', '2027-01-04'],
  ['ATTIRE_SHORTLIST', '2027-01-05'],
  ['PHOTO_CONCEPT', '2027-01-05'],
  ['DECOR_SHORTLIST', '2027-01-06'],
  ['ATTIRE_TRY_STORE', '2027-01-09'],
  ['DECOR_VISIT', '2027-01-09'],
  ['ATTIRE_BOOK', '2027-01-10'],
  ['MAKEUP_SHORTLIST', '2027-01-10'],
  ['DECOR_BOOK', '2027-01-11'],
  ['DECOR_BRIEF', '2027-01-13'],
  ['SELF_RINGS', '2027-01-15'],
  ['MAKEUP_ASSESS', '2027-01-16'],
  ['ATTIRE_MEASURE', '2027-01-16'],
  ['MAKEUP_BOOK', '2027-01-17'],
  ['FLOWER_SHORTLIST', '2027-01-18'],
  ['SELF_INVITE_PRINT', '2027-01-19'],
  ['ATTIRE_ALBUM_PICKUP', '2027-01-25'],
  ['PHOTO_ALBUM_SHOOT', '2027-01-26'],
  ['SELF_ENGAGEMENT', '2027-01-29'],
  ['VENUE_TASTING', '2027-01-31'],
  ['PHOTO_PICK_EDIT', '2027-02-02'],
  ['FLOWER_BOOK', '2027-02-03'],
  ['ATTIRE_FIT_FIRST', '2027-02-07'],
  ['SELF_REGISTER', '2027-02-08'],
  ['SELF_INVITE_SEND', '2027-02-18'],
  ['VENUE_MENU_FINAL', '2027-02-18'],
  ['MAKEUP_TRIAL', '2027-02-20'],
  ['DECOR_REVIEW_MOCKUP', '2027-02-22'],
  ['SELF_CARS', '2027-02-23'],
  ['PHOTO_REVIEW', '2027-02-23'],
  ['FLOWER_PICK_STYLE', '2027-02-23'],
  ['SELF_SCRIPT', '2027-03-06'],
  ['FLOWER_FINAL', '2027-03-06'],
  ['DECOR_FINAL', '2027-03-11'],
  ['VENUE_EVENT_FINAL', '2027-03-13'],
  ['PHOTO_DELIVERY_PREP', '2027-03-13'],
  ['ATTIRE_FIT_LAST', '2027-03-13'],
  ['MAKEUP_FINAL', '2027-03-13'],
  ['SELF_FINAL_CHECK', '2027-03-17'],
  ['ATTIRE_RECEIVE', '2027-03-18'],
  ['DECOR_EVENT', '2027-03-20'],
  ['MAKEUP_EVENT', '2027-03-20'],
  ['FLOWER_EVENT', '2027-03-20'],
  ['PHOTO_EVENT', '2027-03-20'],
  ['VENUE_EVENT', '2027-03-20'],
  ['VENUE_PAY', '2027-03-20'],
  ['PHOTO_PAY', '2027-03-20'],
  ['ATTIRE_PAY', '2027-03-20'],
  ['DECOR_PAY', '2027-03-20'],
  ['MAKEUP_PAY', '2027-03-20'],
  ['FLOWER_PAY', '2027-03-20'],
  ['ATTIRE_RETURN', '2027-03-22'],
  ['SELF_THANKS', '2027-03-27'],
  ['PHOTO_FILES', '2027-04-19'],
];

/**
 * Các dòng mà luật đã chốt cho kết quả KHÁC file:
 * - Dời cuối tuần chỉ lùi, bị chặn (trước I+1, trước D+k, trước/trùng việc trước cùng dịch vụ) thì giữ ngày thường:
 *   file dời tới (hoặc lùi sát) T7/CN theo cả hai chiều. Kéo theo Mốc chốt không còn bị "đẩy theo thứ tự" và hạn đặt cọc D đổi
 *   (Chốt trang phục 10/01 → 09/01, Chốt makeup 17/01 → 14/01), nên các việc chi tiết tính từ D cũng đổi.
 * - Dòng 39 Hoa cưới: file gõ nhầm 23/02, đúng là E−30 = 18/02.
 * - Thanh toán: Hạn = E + 7 (file ghi E).
 */
const RULE_CHANGES: Record<string, string> = {
  PHOTO_CONSULT: '2027-01-01', // 6: file 02/01 (dời tiến tới T7); nay lùi bị chặn bởi việc trước (30/12) nên giữ T6 01/01
  ATTIRE_TRY_STORE: '2027-01-07', // 13: file 09/01 (tiến); lùi tới 03/01 bị chặn bởi việc trước (05/01) nên giữ T5 07/01
  ATTIRE_BOOK: '2027-01-09', // 15: file 10/01 (đẩy theo thứ tự); Chọn NCC cuối nay 07/01 nên không phải đẩy
  MAKEUP_ASSESS: '2027-01-13', // 20: file 16/01 (tiến); lùi tới 10/01 trùng việc trước nên giữ T4 13/01
  ATTIRE_MEASURE: '2027-01-12', // 21: file 16/01; D = 09/01 nên D+3 = 12/01, lùi về CN 10/01 bị chặn bởi D+3
  MAKEUP_BOOK: '2027-01-14', // 22: file 17/01 (đẩy theo thứ tự); nay 14/01
  MAKEUP_TRIAL: '2027-02-14', // 35: file 20/02 (tiến); nay lùi về CN 14/02
  FLOWER_PICK_STYLE: '2027-02-18', // 39: file gõ nhầm 23/02
  ATTIRE_FIT_LAST: '2027-03-07', // 45: file 13/03 (tiến); nay hệ số co 67/75 → 11/03 rồi lùi về CN 07/03
  VENUE_PAY: '2027-03-27',
  PHOTO_PAY: '2027-03-27',
  ATTIRE_PAY: '2027-03-27',
  DECOR_PAY: '2027-03-27',
  MAKEUP_PAY: '2027-03-27',
  FLOWER_PAY: '2027-03-27',
};

/** Toàn bộ timeline của một đám cưới: khung rồi chi tiết, đặt cọc đúng ngày Mốc chốt, E = W. */
function fullTimeline(wedding: string, today: string) {
  const frame = planFrame(T, { wedding, today, services: SERVICES });
  const fm = byCode(frame.tasks);
  const all: ScheduledTask[] = [...frame.tasks];
  const deposits: Record<string, string> = {};
  const bookOf = (s: ServiceKey) => T.find((t) => t.service === s && t.kind === 'BOOK')!.code;
  for (const s of SERVICES) deposits[s] = dateOf(fm, bookOf(s));
  const albumDate = defaultAlbumDate(deposits['chup-anh'], wedding);
  for (const s of SERVICES) all.push(...planDetails(T, s, { today: deposits[s], wedding, event: wedding, deposit: deposits[s], albumDate }).tasks);
  return { frame, all, deposits, albumDate };
}

describe('mẫu timeline', () => {
  it('62 việc, mã duy nhất, đủ 6 hạng mục + việc chung', () => {
    assert.equal(T.length, 62);
    assert.equal(new Set(T.map((t) => t.code)).size, 62);
    assert.deepEqual([...new Set(T.map((t) => t.service))].map(String).sort(), ['chup-anh', 'decor', 'hoa-cuoi', 'makeup', 'nha-hang', 'null', 'trang-phuc']);
  });

  it('mã Mốc chốt kết thúc _BOOK, mỗi hạng mục đúng một', () => {
    for (const s of SERVICES) assert.equal(T.filter((t) => t.service === s && t.kind === 'BOOK').length, 1);
    assert.ok(T.filter((t) => t.kind === 'BOOK').every((t) => t.code.endsWith('_BOOK')));
    assert.ok(T.filter((t) => t.kind !== 'BOOK').every((t) => !t.code.endsWith('_BOOK')));
  });

  it('không trùng mã Detail / Frame của timeline cũ trong CSDL (trừ *_BOOK giữ nguyên)', () => {
    const legacy = [
      'PHOTO_PLAN', 'PHOTO_SHOOT', 'PHOTO_SELECT', 'PHOTO_PORTFOLIO', 'FLOWER_CONFIRM', 'FLOWER_PICKUP', 'FLOWER_CHOOSE', 'MAKEUP_STYLE', 'MAKEUP_SCHEDULE',
      'ATTIRE_FIT', 'ATTIRE_FINAL', 'ATTIRE_PICKUP', 'ATTIRE_TRY', 'DECOR_MOCKUP', 'DECOR_COLOR', 'DECOR_SETUP', 'DECOR_CONCEPT', 'VENUE_MENU_ADJUST', 'VENUE_TABLE_PLAN',
      'VENUE_FINAL_COUNT', 'VENUE_VISIT',
    ];
    for (const c of legacy) assert.equal(templateOf(c), undefined, c);
  });

  it('chỉ 8 việc chi tiết có nút Hẹn với NCC, đều là DETAIL (không phải Nhận, Ngày thực hiện, Thanh toán)', () => {
    const meet = T.filter((t) => t.needsMeeting);
    assert.deepEqual(
      meet.map((t) => t.code).sort(),
      ['ATTIRE_FIT_FIRST', 'ATTIRE_FIT_LAST', 'ATTIRE_MEASURE', 'DECOR_REVIEW_MOCKUP', 'MAKEUP_TRIAL', 'PHOTO_CONCEPT', 'VENUE_HALL_CONFIRM', 'VENUE_TASTING'].sort(),
    );
    assert.ok(meet.every((t) => t.kind === 'DETAIL' && !t.title.startsWith('Nhận')));
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
    assert.equal(suggestOf(first, { done: true, hasCancelledOrder: false }), true); // vẫn ở trên thẻ đó trong tab Đã xong
    for (const code of ['VENUE_TOUR', 'PHOTO_CONSULT', 'ATTIRE_TRY_STORE', 'DECOR_VISIT', 'MAKEUP_ASSESS']) {
      assert.equal(suggestOf(templateOf(code), { done: false, hasCancelledOrder: false }), false, code);
    }
  });

  it('Mốc chốt: không có nút, trừ khi đang Todo và có dòng "đơn đã hủy"', () => {
    const book = templateOf('DECOR_BOOK');
    assert.equal(suggestOf(book, { done: false, hasCancelledOrder: false }), false);
    assert.equal(suggestOf(book, { done: false, hasCancelledOrder: true }), true);
    assert.equal(suggestOf(book, { done: true, hasCancelledOrder: true }), false); // đã cọc đơn mới thì mất
  });

  it('việc tự làm, chi tiết, ngày thực hiện, thanh toán, việc khách tự thêm hoặc mã cũ: không có nút', () => {
    for (const t of T.filter((x) => x.kind !== 'CHOOSE' && x.kind !== 'BOOK')) assert.equal(suggestOf(t, { done: false, hasCancelledOrder: true }), false, t.code);
    assert.equal(suggestOf(undefined, { done: false, hasCancelledOrder: true }), false);
  });

  it('nút "Hẹn với NCC" giữ nguyên ở đúng 8 việc chi tiết', () => {
    assert.deepEqual(
      T.filter((t) => t.needsMeeting).map((t) => t.code).sort(),
      ['ATTIRE_FIT_FIRST', 'ATTIRE_FIT_LAST', 'ATTIRE_MEASURE', 'DECOR_REVIEW_MOCKUP', 'MAKEUP_TRIAL', 'PHOTO_CONCEPT', 'VENUE_HALL_CONFIRM', 'VENUE_TASTING'],
    );
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
    assert.equal(keepThreshold(90), 60); // L = 91
    assert.equal(keepThreshold(80), 60);
    assert.equal(keepThreshold(44), 24); // L = 45
    assert.equal(keepThreshold(19), 9); // L = 20
    assert.equal(keepThreshold(6), 3); // L = 7
  });
});

describe('sheet "Ví dụ 90 ngày" (cưới 20/03/2027, nhập 19/12/2026, L = 91)', () => {
  const { all, frame } = fullTimeline(W, '2026-12-19');
  const m = byCode(all);

  it('L = 91, K = 60, mức Bình thường', () => {
    assert.equal(frame.L, 91);
    assert.equal(frame.K, 60);
    assert.equal(frame.level, 'NORMAL');
  });

  for (const [code, fileDate] of SHEET) {
    const expected = RULE_CHANGES[code] ?? fileDate;
    it(`${code}: ${expected}${RULE_CHANGES[code] ? ` (file ${fileDate})` : ''}`, () => {
      assert.equal(dateOf(m, code), expected);
    });
  }

  it('đúng 62 dòng, không dòng nào trước I+1', () => {
    assert.equal(all.length, 62);
    assert.ok(all.every((t) => t.date >= '2026-12-20'));
  });

  it('dời cuối tuần chỉ áp dụng khi lùi được', () => {
    const shifted = all.filter((t) => t.rules.includes('dời cuối tuần')).map((t) => t.code).sort();
    assert.deepEqual(shifted, ['ATTIRE_FIT_FIRST', 'ATTIRE_FIT_LAST', 'MAKEUP_TRIAL', 'VENUE_TASTING', 'VENUE_TOUR']);
  });
});

describe('theo từng L (cưới 20/03/2027)', () => {
  for (const L of [400, 180, 91, 45, 20, 7]) {
    const today = addDays(W, -L);
    const first = addDays(today, 1);
    const { frame, all } = fullTimeline(W, today);
    const m = byCode(all);

    describe(`L = ${L} (${frame.level}, K = ${frame.K})`, () => {
      it('không ngày nào trước I+1', () => {
        for (const t of all) assert.ok(t.date >= first, `${t.code} ${t.date} < ${first}`);
      });

      it('Chọn NCC < Mốc chốt trong từng dịch vụ, Chọn NCC cách nhau ≥ 1 ngày', () => {
        for (const s of SERVICES) {
          const choose = T.filter((t) => t.service === s && t.kind === 'CHOOSE').map((t) => dateOf(m, t.code));
          const book = dateOf(m, T.find((t) => t.service === s && t.kind === 'BOOK')!.code);
          for (let i = 1; i < choose.length; i++) assert.ok(choose[i] > choose[i - 1], `${s} Chọn NCC ${choose.join(',')}`);
          for (const c of choose) assert.ok(c < book, `${s}: ${c} >= chốt ${book}`);
        }
      });

      it('việc Tự làm có d ≤ K giữ nguyên (trừ khi bị kẹp về I+1)', () => {
        const K = frame.K ?? Infinity;
        for (const t of T.filter((x) => x.kind === 'SELF' && x.offset <= 0 && -x.offset <= K)) {
          assert.equal(dateOf(m, t.code), ymd(Math.max(dayOf(W) + t.offset, dayOf(first))), t.code);
        }
      });

      it('W−3, W+7, W+30 không bao giờ bị ép', () => {
        assert.equal(dateOf(m, 'SELF_FINAL_CHECK'), ymd(Math.max(dayOf(W) - 3, dayOf(first))));
        assert.equal(dateOf(m, 'SELF_THANKS'), addDays(W, 7));
        assert.equal(dateOf(m, 'PHOTO_FILES'), addDays(W, 30));
      });

      it('cờ Gấp: mức Bình thường trở lên không có việc nào Gấp (trừ bị kẹp về I+1); Gấp / Rất gấp có việc bị ép > 50%', () => {
        const urgent = frame.tasks.filter((t) => t.urgent).length;
        if (frame.level === 'FAR' || frame.level === 'NORMAL') assert.equal(urgent, 0);
        else assert.ok(urgent > 0);
        for (const t of frame.tasks) if (t.rules.includes('kẹp I+1')) assert.equal(t.urgent, true, t.code);
      });
    });
  }
});

describe('việc chi tiết theo ngày đặt cọc', () => {
  const E = W;
  const run = (service: ServiceKey, D: string, today = D) => planDetails(T, service, { today, wedding: W, event: E, deposit: D, albumDate: '2027-01-26' });
  const pre = (service: ServiceKey) => T.filter((t) => t.service === service && t.kind === 'DETAIL' && t.offset <= 0 && t.anchor === 'E');

  it('cọc sớm (D = W−200): không co, ngày = E − x', () => {
    const p = run('nha-hang', addDays(W, -200));
    const m = byCode(p.tasks);
    assert.equal(p.scale, 1);
    assert.equal(dateOf(m, 'VENUE_MENU_FINAL'), addDays(E, -30));
    assert.equal(dateOf(m, 'VENUE_EVENT_FINAL'), addDays(E, -7));
    assert.equal(dateOf(m, 'VENUE_HALL_CONFIRM'), addDays(W, -198)); // D + 2
    assert.equal(dateOf(m, 'VENUE_EVENT'), E);
    assert.equal(dateOf(m, 'VENUE_PAY'), addDays(E, 7));
    assert.ok(p.tasks.every((t) => !t.urgent));
  });

  it('cọc đúng mốc (D = 02/01/2027): khớp sheet', () => {
    const m = byCode(run('nha-hang', '2027-01-02').tasks);
    assert.equal(dateOf(m, 'VENUE_HALL_CONFIRM'), '2027-01-04');
    assert.equal(dateOf(m, 'VENUE_TASTING'), '2027-01-31');
    assert.equal(dateOf(m, 'VENUE_MENU_FINAL'), '2027-02-18');
    assert.equal(dateOf(m, 'VENUE_EVENT_FINAL'), '2027-03-13');
  });

  it('cọc muộn (D = E−20): co theo hệ số, trong [D+k, E−1], thứ tự giữ nguyên', () => {
    for (const s of SERVICES) {
      const D = addDays(E, -20);
      const k = MIN_AFTER_DEPOSIT[s];
      const p = run(s, D);
      const m = byCode(p.tasks);
      assert.ok(p.scale <= 1 && p.space === 20 - k, s);
      const dates = pre(s).map((t) => dateOf(m, t.code));
      for (const d of dates) assert.ok(d >= addDays(D, k) && d <= addDays(E, -1), `${s}: ${d}`);
      assert.deepEqual([...dates].sort(), dates, `${s} thứ tự`);
      assert.ok(p.tasks.every((t) => !t.urgent), s);
    }
  });

  it('cọc sát (D = E−1): dồn vào max(I+1, D+1), cờ Cần làm gấp', () => {
    for (const s of SERVICES) {
      const D = addDays(E, -1);
      const p = run(s, D);
      const m = byCode(p.tasks);
      for (const t of T.filter((x) => x.service === s && x.kind === 'DETAIL' && !(x.offset > 0 && x.anchor !== 'S'))) {
        assert.equal(dateOf(m, t.code), E, `${s} ${t.code}`); // D+1 = E: không còn chỗ trước E−1
        assert.equal(m.get(t.code)!.urgent, true);
      }
    }
  });

  it('E − (D+k) = 0 với hôm nay muộn hơn D: dùng max(I+1, D+1)', () => {
    const D = addDays(E, -3);
    const p = run('trang-phuc', D, addDays(D, 1)); // k = 3 → space = 0
    assert.equal(p.space, 0);
    assert.equal(dateOf(byCode(p.tasks), 'ATTIRE_MEASURE'), addDays(D, 2)); // max(I+1 = D+2, D+1)
  });

  it('Thanh toán: Hạn E+7; Trả trang phục E+2', () => {
    const m = byCode(run('trang-phuc', '2027-01-09').tasks);
    assert.equal(dateOf(m, 'ATTIRE_PAY'), '2027-03-27');
    assert.equal(dateOf(m, 'ATTIRE_RETURN'), '2027-03-22');
  });

  it('S mặc định = D(chụp) + 23, không muộn hơn W − 35, không sớm hơn D + 2', () => {
    assert.equal(defaultAlbumDate('2027-01-03', W), '2027-01-26');
    assert.equal(defaultAlbumDate('2027-02-10', W), '2027-02-13'); // chặn trên W − 35
    assert.equal(defaultAlbumDate('2027-02-20', W), '2027-02-22'); // cọc muộn: W − 35 đã qua, lấy D + 2 để S không ở quá khứ
    const m = byCode(planDetails(T, 'chup-anh', { today: '2027-01-03', wedding: W, event: W, deposit: '2027-01-03' }).tasks);
    assert.equal(dateOf(m, 'PHOTO_ALBUM_SHOOT'), '2027-01-26');
    assert.equal(dateOf(m, 'PHOTO_CONCEPT'), '2027-01-05'); // S−21 = D+2
    assert.equal(dateOf(m, 'PHOTO_PICK_EDIT'), '2027-02-02');
    assert.equal(dateOf(m, 'PHOTO_REVIEW'), '2027-02-23');
  });
});

describe('hai dịch vụ cọc ở hai thời điểm khác nhau', () => {
  it('dịch vụ cọc sau chỉ sinh thêm việc của nó; ngày của dịch vụ cọc trước không đổi', () => {
    const first = newDetailTasks(T, 'nha-hang', { today: '2027-01-02', wedding: W, event: W, deposit: '2027-01-02' }, new Set());
    const snapshot = JSON.stringify(first);
    const have = new Set(first.map((t) => t.code));
    const second = newDetailTasks(T, 'decor', { today: '2027-02-10', wedding: W, event: W, deposit: '2027-02-10' }, have);
    assert.ok(second.length > 0);
    assert.ok(second.every((t) => templateOf(t.code)!.service === 'decor' && !have.has(t.code)));
    assert.equal(JSON.stringify(first), snapshot);
    // đặt cọc nhà hàng lần nữa (mã đã có) không sinh thêm việc nào
    assert.equal(newDetailTasks(T, 'nha-hang', { today: '2027-02-12', wedding: W, event: W, deposit: '2027-02-12' }, have).length, 0);
  });
});

describe('Ngày hẹn chụp album', () => {
  it('chỉ tính lại việc neo S còn Todo của dịch vụ chụp ảnh', () => {
    const ctx = { today: '2027-01-03', wedding: W, event: W, deposit: '2027-01-03', albumDate: '2027-02-06' };
    const todo = new Set(['PHOTO_ALBUM_SHOOT', 'PHOTO_PICK_EDIT', 'PHOTO_REVIEW']); // PHOTO_CONCEPT đã xong
    const r = byCode(replanAlbumTasks(T, ctx, todo));
    assert.deepEqual([...r.keys()].sort(), ['PHOTO_ALBUM_SHOOT', 'PHOTO_PICK_EDIT', 'PHOTO_REVIEW']);
    assert.equal(dateOf(r, 'PHOTO_ALBUM_SHOOT'), '2027-02-06');
    assert.equal(dateOf(r, 'PHOTO_PICK_EDIT'), '2027-02-13');
    assert.equal(dateOf(r, 'PHOTO_REVIEW'), '2027-03-06');
    assert.ok([...r.keys()].every((c) => templateOf(c)!.service === 'chup-anh'));
  });
});

describe('bảng báo cáo', () => {
  it('Chốt nhà hàng và Thử món theo từng L (in ra để xem)', () => {
    const rows = [400, 180, 91, 45, 20, 7].map((L) => {
      const today = addDays(W, -L);
      const f = planFrame(T, { wedding: W, today, services: SERVICES });
      const book = f.tasks.find((t) => t.code === 'VENUE_BOOK')!;
      const d = planDetails(T, 'nha-hang', { today: book.date, wedding: W, event: W, deposit: book.date }).tasks.find((t) => t.code === 'VENUE_TASTING')!;
      return { L, mức: f.level, K: f.K, nhập: today, 'Chốt nhà hàng': book.date, 'gấp?': book.urgent, 'luật khung': book.rules.join(', '), 'Thử món': d.date, 'luật Thử món': d.rules.join(', ') };
    });
    console.table(rows);
    assert.equal(rows.length, 6);
  });
});

describe('đổi ngày cưới', () => {
  const W0 = '2027-03-20';
  const I0 = '2026-12-19'; // ngày tạo
  const NOW = '2026-12-29'; // ngày khách đổi ngày cưới
  const isFrameCode = (code: string) => ['SELF', 'CHOOSE', 'BOOK'].includes(templateOf(code)!.kind);

  /** Timeline đang có: khung sinh lúc tạo; các dịch vụ đã cọc (BOOK xong, có việc chi tiết); thêm các mã đã tick xong. */
  function current(deposits: { service: ServiceKey; deposit: string }[], doneCodes: string[] = []) {
    const tasks: ExistingTask[] = planFrame(T, { wedding: W0, today: I0, services: SERVICES }).tasks.map((t) => ({ code: t.code, date: t.date, done: false }));
    const orders = deposits.map((d) => ({ ...d, event: W0 }));
    const albumDate = defaultAlbumDate(deposits.find((d) => d.service === 'chup-anh')?.deposit ?? NOW, W0);
    for (const d of deposits) {
      for (const t of tasks) if (t.code === T.find((x) => x.service === d.service && x.kind === 'BOOK')!.code) t.done = true;
      tasks.push(...planDetails(T, d.service, { today: d.deposit, wedding: W0, event: W0, deposit: d.deposit, albumDate }).tasks.map((t) => ({ code: t.code, date: t.date, done: false })));
    }
    for (const t of tasks) if (doneCodes.includes(t.code)) t.done = true;
    return { tasks, orders };
  }
  const run = (cur: ReturnType<typeof current>, wedding: string): DateChange[] => replanOnWeddingDateChange(T, { wedding, today: NOW, tasks: cur.tasks, services: SERVICES, orders: cur.orders });
  const detailCodesOf = (service: ServiceKey) => new Set(T.filter((t) => t.service === service && !isFrameCode(t.code)).map((t) => t.code));

  for (const [label, newW] of [['dời sớm 60 ngày', addDays(W0, -60)], ['dời muộn 90 ngày', addDays(W0, 90)]] as const) {
    it(`${label}: chỉ việc khung Todo đổi, theo planFrame với W mới và I = hôm nay`, () => {
      const cur = current([{ service: 'nha-hang', deposit: '2026-12-28' }], ['VENUE_SHORTLIST']);
      const changes = run(cur, newW);
      const expected = byCode(planFrame(T, { wedding: newW, today: NOW, services: SERVICES }).tasks);
      assert.ok(changes.length > 0);
      for (const c of changes) {
        assert.ok(isFrameCode(c.code), c.code);
        assert.equal(c.to, expected.get(c.code)!.date, c.code);
        assert.ok(c.to > NOW, `${c.code} ${c.to} không sau hôm nay`);
        assert.notEqual(c.from, c.to);
      }
      // mọi việc khung Todo chưa cọc có hạn mới đúng bộ tính ngày (dù có đổi hay không)
      const after = new Map(cur.tasks.map((t) => [t.code, t.date]));
      for (const c of changes) after.set(c.code, c.to);
      for (const t of cur.tasks.filter((x) => isFrameCode(x.code) && !x.done)) assert.equal(after.get(t.code), expected.get(t.code)!.date, t.code);
    });

    it(`${label}: việc Done và việc chi tiết của dịch vụ đã cọc không đổi`, () => {
      const cur = current([{ service: 'nha-hang', deposit: '2026-12-28' }], ['VENUE_SHORTLIST', 'SELF_RINGS']);
      const changed = new Set(run(cur, newW).map((c) => c.code));
      for (const code of ['VENUE_SHORTLIST', 'SELF_RINGS', 'VENUE_BOOK']) assert.equal(changed.has(code), false, code);
      for (const code of detailCodesOf('nha-hang')) assert.equal(changed.has(code), false, code);
    });

    it(`${label}: Chọn NCC < Mốc chốt trong từng dịch vụ chưa cọc sau khi tính lại`, () => {
      const cur = current([]);
      const after = new Map(cur.tasks.map((t) => [t.code, t.date]));
      for (const c of run(cur, newW)) after.set(c.code, c.to);
      for (const s of SERVICES) {
        const choose = T.filter((t) => t.service === s && t.kind === 'CHOOSE').map((t) => after.get(t.code)!);
        const book = after.get(T.find((t) => t.service === s && t.kind === 'BOOK')!.code)!;
        for (const c of choose) assert.ok(c < book, `${s} ${c} >= ${book}`);
      }
    });
  }

  it('việc theo S: tính lại khi còn Todo, giữ nguyên khi buổi chụp đã xong', () => {
    const deposits: { service: ServiceKey; deposit: string }[] = [{ service: 'chup-anh', deposit: '2026-12-28' }];
    const early = addDays(W0, -60); // W − 35 = 2026-12-... chặn S về D + 2
    const todo = new Map(run(current(deposits), early).map((c) => [c.code, c]));
    assert.equal(todo.get('PHOTO_ALBUM_SHOOT')?.to, '2026-12-30');
    assert.ok(todo.has('PHOTO_PICK_EDIT') && todo.has('PHOTO_REVIEW'));
    const doneShoot = new Set(run(current(deposits, ['PHOTO_ALBUM_SHOOT']), early).map((c) => c.code));
    assert.equal(doneShoot.has('PHOTO_ALBUM_SHOOT'), false);
    assert.equal(doneShoot.has('PHOTO_PICK_EDIT'), false); // S đã chụp: các việc sau S giữ nguyên
    // dời muộn: S = D + 23 không đổi nên không có việc theo S nào đổi
    const late = new Set(run(current(deposits), addDays(W0, 90)).map((c) => c.code));
    assert.equal(late.has('PHOTO_ALBUM_SHOOT'), false);
  });

  it('ngày cưới mới không sau hôm nay: chặn', () => {
    assert.throws(() => run(current([]), NOW), RangeError);
    assert.throws(() => run(current([]), '2026-12-01'), RangeError);
  });
});

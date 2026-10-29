/*
 * Bộ tính ngày timeline cưới (docs/TIMELINE.md). Hàm thuần: không đụng CSDL, không đọc đồng hồ; "hôm nay" do nơi gọi truyền vào.
 * Ngày là chuỗi "YYYY-MM-DD" (cùng quy ước cột @db.Date), bên trong tính theo số ngày kể từ 1970-01-01 UTC để khỏi lệch múi giờ.
 *
 * Ký hiệu: W ngày cưới, I hôm nay (ngày nhập), L = W − I, L1 = L − 1, d số ngày trước W theo mẫu,
 *          D ngày đặt cọc, E ngày thực hiện của đơn, S ngày chụp album, k = MIN_AFTER_DEPOSIT của hạng mục.
 */
import type { ServiceKey, TaskKind, TimelineTemplate } from './timeline-templates.ts';
import { FRAME_MAX_OFFSET, MIN_AFTER_DEPOSIT } from './timeline-templates.ts';

const MS_DAY = 86_400_000;
export const dayOf = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / MS_DAY);
export const ymd = (n: number) => new Date(n * MS_DAY).toISOString().slice(0, 10);
const weekday = (n: number) => new Date(n * MS_DAY).getUTCDay(); // 0 = CN, 6 = T7
/** Làm tròn nửa lên (Math.round cũng vậy với số dương; viết rõ để không phụ thuộc). */
const roundHalfUp = (x: number) => Math.floor(x + 0.5);

export type PrepLevel = 'FAR' | 'NORMAL' | 'SOON' | 'VERY_SOON';

/** Mức độ gấp theo L (số ngày từ hôm nay tới ngày cưới). L ≤ 0: ngày cưới không hợp lệ, chặn lưu. */
export function levelOf(L: number): PrepLevel {
  if (L <= 0) throw new RangeError('WEDDING_DATE_NOT_FUTURE');
  if (L > 270) return 'FAR';
  if (L >= 81) return 'NORMAL';
  if (L >= 21) return 'SOON';
  return 'VERY_SOON';
}

export interface ScheduledTask {
  code: string;
  /** Hạn (ngày muộn nhất phải làm), "YYYY-MM-DD" */
  date: string;
  /** Cờ "Cần làm gấp" */
  urgent: boolean;
  /** Đã bị ép / co so với mẫu */
  shortened: boolean;
  /** Các luật đã tác động: 'rút ngắn', 'dời cuối tuần', 'đẩy theo thứ tự', 'kẹp I+1' */
  rules: string[];
}

export interface FramePlan {
  L: number;
  level: PrepLevel;
  /** Ngưỡng giữ nguyên K; null khi không phải ép (L1 ≥ 270) */
  K: number | null;
  tasks: ScheduledTask[];
}

/** K = min(60, max(floor(L1/2), L1 − 20)). */
export function keepThreshold(L1: number): number | null {
  if (L1 >= FRAME_MAX_OFFSET) return null;
  return Math.min(60, Math.max(Math.floor(L1 / 2), L1 - 20));
}

const isFrame = (k: TaskKind) => k === 'SELF' || k === 'CHOOSE' || k === 'BOOK';

/** Lùi về T7/CN gần nhất trước hạn (chỉ lùi, không bao giờ sau hạn). */
const backToWeekend = (n: number) => {
  const w = weekday(n);
  return w === 0 || w === 6 ? n : n - w; // lùi w ngày thì tới Chủ nhật gần nhất trước
};

/**
 * Timeline khung của một đám cưới mới: mọi việc Tự làm của "Chung" và Tự làm / Chọn NCC / Mốc chốt của các hạng mục khách chọn.
 * Khung không bao giờ bị dời sau khi đã sinh; hàm này chỉ dùng lúc tạo (hoặc xem trước khi đổi ngày cưới).
 */
export function planFrame(templates: readonly TimelineTemplate[], input: { wedding: string; today: string; services: readonly ServiceKey[] }): FramePlan {
  const W = dayOf(input.wedding);
  const I = dayOf(input.today);
  const L = W - I;
  const level = levelOf(L);
  const L1 = L - 1;
  const K = keepThreshold(L1);
  const first = I + 1;

  const shrink = (d: number, noShrink?: boolean) => (K === null || noShrink || d <= K ? d : roundHalfUp(K + ((d - K) * (L1 - K)) / (FRAME_MAX_OFFSET - K)));

  const mine = templates.filter((t) => isFrame(t.kind) && (t.service === null || input.services.includes(t.service))).sort((a, b) => a.order - b.order);
  const out = new Map<string, ScheduledTask>();

  const base = (t: TimelineTemplate) => {
    // Việc sau ngày cưới (W+n) không ép
    if (t.offset > 0) return { n: W + t.offset, d: -t.offset, shrunk: false };
    const d = -t.offset;
    const d2 = shrink(d, t.noShrink);
    return { n: W - d2, d, shrunk: d2 !== d };
  };
  const finish = (t: TimelineTemplate, n: number, d: number, rules: string[], clamped: boolean) => {
    const dFinal = W - n;
    const far = d > 0 && (d - dFinal) / d > 0.5;
    // "Gấp": bị kẹp về I+1 / không xếp được (mọi mức), hoặc bị ép > 50% khi đám cưới ở mức Gấp / Rất gấp
    const tight = level === 'SOON' || level === 'VERY_SOON';
    out.set(t.code, { code: t.code, date: ymd(n), urgent: clamped || (tight && far) || (t.offset <= 0 && n >= W), shortened: rules.includes('rút ngắn') || clamped, rules });
  };

  // Việc không thuộc chuỗi dịch vụ
  for (const t of mine.filter((x) => x.service === null)) {
    const b = base(t);
    const rules = b.shrunk ? ['rút ngắn'] : [];
    let n = b.n;
    let clamped = false;
    if (n < first) {
      n = first;
      clamped = true;
      rules.push('kẹp I+1');
    }
    finish(t, n, b.d, rules, clamped);
  }

  // Chuỗi từng dịch vụ: Chọn NCC cách nhau ≥ 1 ngày, Mốc chốt sau Chọn NCC cuối ≥ 1 ngày
  for (const service of new Set(mine.map((t) => t.service).filter((s): s is ServiceKey => s !== null))) {
    let prev: number | null = null;
    for (const t of mine.filter((x) => x.service === service && (x.kind === 'CHOOSE' || x.kind === 'BOOK'))) {
      const b = base(t);
      const rules = b.shrunk ? ['rút ngắn'] : [];
      let n = b.n;
      let clamped = false;
      if (n < first) {
        n = first;
        clamped = true;
        rules.push('kẹp I+1');
      }
      const lo = prev === null ? first : Math.max(first, prev + 1);
      if (n < lo) {
        n = lo;
        rules.push('đẩy theo thứ tự');
      } else if (t.kind === 'CHOOSE' && t.weekendPreferred) {
        // Chỉ lùi; bị chặn (trước I+1 hoặc trước/trùng việc trước cùng dịch vụ) thì giữ ngày thường
        const back = backToWeekend(n);
        if (back !== n && back >= lo) {
          n = back;
          rules.push('dời cuối tuần');
        }
      }
      finish(t, n, b.d, rules, clamped);
      prev = n;
    }
  }

  const tasks = mine.map((t) => out.get(t.code)!).filter(Boolean);
  return { L, level, K, tasks };
}

/**
 * S mặc định = D(chụp) + 23, không muộn hơn W − 35; nhưng không sớm hơn D + 2 (cọc muộn thì W − 35 đã qua, S không thể ở quá khứ).
 * Khách nhập Ngày hẹn thì dùng ngày đó thay cho giá trị này.
 */
export function defaultAlbumDate(depositDay: string, wedding: string): string {
  const D = dayOf(depositDay);
  return ymd(Math.max(Math.min(D + 23, dayOf(wedding) - 35), D + MIN_AFTER_DEPOSIT['chup-anh']));
}

export interface DetailContext {
  /** Hôm nay (ngày sinh việc) */
  today: string;
  wedding: string;
  /** Ngày thực hiện của đơn (Orders.EventDate) */
  event: string;
  /** Ngày đặt cọc (Payments.PaidDate, giờ VN) */
  deposit: string;
  /** Ngày chụp album S; bỏ trống thì suy ra mặc định */
  albumDate?: string;
}

export interface DetailPlan {
  /** E − (D + k) */
  space: number;
  /** Hệ số co của các việc E−x (1 = không co) */
  scale: number;
  tasks: ScheduledTask[];
}

/**
 * Việc chi tiết của một dịch vụ khi đơn chuyển Deposited, tính từ D và E thật.
 * Chỉ trả việc của chính dịch vụ này; không biết và không đụng tới việc của dịch vụ khác.
 */
export function planDetails(templates: readonly TimelineTemplate[], service: ServiceKey, ctx: DetailContext, opts: { onlyAnchor?: 'S' } = {}): DetailPlan {
  const W = dayOf(ctx.wedding);
  const E = dayOf(ctx.event);
  const D = dayOf(ctx.deposit);
  const I = dayOf(ctx.today);
  const k = MIN_AFTER_DEPOSIT[service];
  const lo = D + k;
  const S = dayOf(ctx.albumDate ?? defaultAlbumDate(service === 'chup-anh' ? ctx.deposit : ctx.today, ctx.wedding));

  const mine = templates.filter((t) => t.service === service && !isFrame(t.kind)).sort((a, b) => a.order - b.order);
  const xmax = Math.max(0, ...mine.filter((t) => t.kind === 'DETAIL' && t.anchor === 'E' && t.offset < 0).map((t) => -t.offset));
  const space = E - lo;
  const scale = xmax > 0 && space > 0 ? Math.min(1, space / xmax) : 1;
  const squeezed = space <= 0;

  const tasks: ScheduledTask[] = [];
  let prev = -Infinity;
  for (const t of mine) {
    const rules: string[] = [];
    let n: number;
    let urgent = false;
    const fixed = t.kind === 'EVENT' || t.kind === 'PAYMENT' || (t.anchor === 'E' && t.offset > 0) || (t.anchor === 'W' && t.offset > 0);
    if (t.kind === 'EVENT') n = t.anchor === 'S' ? S : t.anchor === 'W' ? W : E;
    else if (t.kind === 'PAYMENT') n = E + t.offset; // Hạn = E + 7
    else if (t.anchor === 'E' && t.offset > 0) n = E + t.offset;
    else if (t.anchor === 'W' && t.offset > 0) n = W + t.offset;
    else if (squeezed) {
      // Không còn chỗ giữa D + k và E: dồn mọi việc trước sự kiện vào ngay sau hôm nay / ngày cọc
      n = Math.max(I + 1, D + 1);
      urgent = true;
      rules.push('rút ngắn');
    } else {
      if (t.anchor === 'D') n = D + t.offset;
      else if (t.anchor === 'S') n = S + t.offset;
      else if (t.anchor === 'W') n = W + t.offset;
      else {
        const x = -t.offset;
        const x2 = roundHalfUp(x * scale);
        if (x2 !== x) rules.push('rút ngắn');
        n = Math.min(E - x2, E - 1); // còn chỗ thì không để việc chuẩn bị rơi vào đúng ngày thực hiện
      }
      if (n < lo) {
        n = lo;
        if (!rules.includes('rút ngắn')) rules.push('rút ngắn');
      } else if (t.weekendPreferred) {
        const back = backToWeekend(n);
        if (back !== n && back >= lo && back > prev) {
          n = back;
          rules.push('dời cuối tuần');
        }
      }
    }
    // Việc neo theo S (sau buổi chụp) mà rơi vào hoặc sau ngày thực hiện thì không kịp chuẩn bị
    if (!squeezed && t.kind === 'DETAIL' && t.anchor === 'S' && n >= E) urgent = true;
    if (!fixed) prev = Math.max(prev, n);
    if (opts.onlyAnchor && t.anchor !== opts.onlyAnchor) continue;
    tasks.push({ code: t.code, date: ymd(n), urgent, shortened: rules.includes('rút ngắn'), rules });
  }
  return { space, scale, tasks };
}

/**
 * Khi một dịch vụ vừa đặt cọc: chỉ trả việc CHƯA có trong timeline (theo task_code). Dịch vụ cọc trước giữ nguyên ngày,
 * việc đã có không bị tính lại hay dời.
 */
export function newDetailTasks(templates: readonly TimelineTemplate[], service: ServiceKey, ctx: DetailContext, existingCodes: ReadonlySet<string>): ScheduledTask[] {
  return planDetails(templates, service, ctx).tasks.filter((t) => !existingCodes.has(t.code));
}

/**
 * Khách nhập Ngày hẹn cho việc chụp album / chốt concept: S = ngày đó. Chỉ tính lại các việc neo theo S của chính dịch vụ chụp ảnh
 * mà còn Todo (todoCodes); việc đã xong và việc của dịch vụ khác không đổi.
 */
export function replanAlbumTasks(templates: readonly TimelineTemplate[], ctx: DetailContext & { albumDate: string }, todoCodes: ReadonlySet<string>): ScheduledTask[] {
  return planDetails(templates, 'chup-anh', ctx, { onlyAnchor: 'S' }).tasks.filter((t) => todoCodes.has(t.code));
}

export interface ExistingTask {
  code: string;
  /** Hạn hiện tại "YYYY-MM-DD" */
  date: string;
  done: boolean;
}

export interface DepositedOrder {
  service: ServiceKey;
  deposit: string;
  event: string;
}

export interface DateChange {
  code: string;
  from: string;
  to: string;
}

/**
 * Khi khách đổi ngày cưới (W mới, I = hôm nay): chỉ tính lại việc khung đang Todo chưa gắn đơn (bằng planFrame đầy đủ luật),
 * và việc neo theo S còn Todo (S tính lại theo W mới; S đã chụp xong thì giữ). Việc đã Done, việc chi tiết của dịch vụ đã cọc
 * (neo theo E của đơn) và việc khách tự thêm (không có mã mẫu) giữ nguyên. Trả các việc có hạn đổi.
 */
export function replanOnWeddingDateChange(
  templates: readonly TimelineTemplate[],
  input: { wedding: string; today: string; tasks: readonly ExistingTask[]; services: readonly ServiceKey[]; orders: readonly DepositedOrder[] },
): DateChange[] {
  const byCode = new Map(templates.map((t) => [t.code, t]));
  const have = new Map(input.tasks.map((t) => [t.code, t]));
  const changes = new Map<string, DateChange>();
  const push = (code: string, to: string) => {
    const t = have.get(code);
    if (t && !t.done && t.date !== to) changes.set(code, { code, from: t.date, to });
  };

  const plan = planFrame(templates, { wedding: input.wedding, today: input.today, services: input.services });
  for (const p of plan.tasks) {
    const tpl = byCode.get(p.code);
    if (tpl && isFrame(tpl.kind)) push(p.code, p.date);
  }

  const shoot = have.get('PHOTO_ALBUM_SHOOT');
  const photo = input.orders.find((o) => o.service === 'chup-anh');
  const albumDate = shoot?.done ? shoot.date : defaultAlbumDate(photo ? photo.deposit : input.today, input.wedding);
  for (const o of input.orders) {
    const ctx = { today: o.deposit, wedding: input.wedding, event: o.event, deposit: o.deposit, albumDate };
    for (const p of planDetails(templates, o.service, ctx, { onlyAnchor: 'S' }).tasks) push(p.code, p.date);
  }
  return [...changes.values()].sort((a, b) => a.to.localeCompare(b.to));
}

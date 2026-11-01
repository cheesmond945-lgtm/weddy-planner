/*
 * Bộ tính ngày timeline cưới (docs/TIMELINE.md). Hàm thuần: không đụng CSDL, không đọc đồng hồ; "hôm nay" do nơi gọi truyền vào.
 * Ngày là chuỗi "YYYY-MM-DD" (cùng quy ước cột @db.Date), bên trong tính theo số ngày kể từ 1970-01-01 UTC để khỏi lệch múi giờ.
 *
 * Ký hiệu: W ngày cưới, I hôm nay (ngày nhập), L = W − I, L1 = L − 1, d số ngày trước W theo mẫu,
 *          D ngày đặt cọc, E ngày thực hiện của đơn.
 */
import type { ServiceKey, TaskKind, TimelineTemplate } from './timeline-templates.ts';
import { FRAME_MAX_OFFSET } from './timeline-templates.ts';

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

/** Số ngày tối thiểu từ ngày đặt cọc tới việc đầu tiên của gói: việc không sớm hơn D + 2. */
export const MIN_AFTER_DEPOSIT = 2;

export interface PackageTaskInput {
  id: string;
  /** So với ngày thực hiện E: âm = trước, 0 = đúng ngày, dương = sau */
  offsetDays: number;
}

export interface PackageTaskPlan {
  /** E − (D + 2) */
  space: number;
  /** Hệ số co của các việc trước E (1 = không co) */
  scale: number;
  tasks: { id: string; date: string; urgent: boolean; shortened: boolean }[];
}

/**
 * Hạn của các việc NCC khai theo gói, tính từ D (ngày cọc), E (ngày thực hiện của đơn) và I (hôm nay). Giữ công thức co giãn của bộ mẫu cũ:
 * lo = D + 2; xmax = số ngày trước E xa nhất; scale = min(1, (E − lo) / xmax); việc trước E: n = min(E − round(x · scale), E − 1), n < lo thì n = lo;
 * E − lo ≤ 0: dồn mọi việc trước E về max(I + 1, D + 1) (cờ gấp); việc từ E trở đi: E + offset. Giữ nguyên thứ tự đầu vào.
 */
export function planPackageTasks(input: { D: string; E: string; I: string; tasks: readonly PackageTaskInput[] }): PackageTaskPlan {
  const D = dayOf(input.D);
  const E = dayOf(input.E);
  const I = dayOf(input.I);
  const lo = D + MIN_AFTER_DEPOSIT;
  const xmax = Math.max(0, ...input.tasks.filter((t) => t.offsetDays < 0).map((t) => -t.offsetDays));
  const space = E - lo;
  const scale = xmax > 0 && space > 0 ? Math.min(1, space / xmax) : 1;
  const squeezed = space <= 0;

  const tasks = input.tasks.map((t) => {
    if (t.offsetDays >= 0) return { id: t.id, date: ymd(E + t.offsetDays), urgent: false, shortened: false };
    if (squeezed) return { id: t.id, date: ymd(Math.max(I + 1, D + 1)), urgent: true, shortened: true };
    const x = -t.offsetDays;
    const x2 = roundHalfUp(x * scale);
    let n = Math.min(E - x2, E - 1); // còn chỗ thì không để việc chuẩn bị rơi vào đúng ngày thực hiện
    let shortened = x2 !== x;
    if (n < lo) {
      n = lo;
      shortened = true;
    }
    return { id: t.id, date: ymd(n), urgent: false, shortened };
  });
  return { space, scale, tasks };
}

export interface ExistingTask {
  code: string;
  /** Hạn hiện tại "YYYY-MM-DD" */
  date: string;
  done: boolean;
}

export interface DateChange {
  code: string;
  from: string;
  to: string;
}

/**
 * Khi khách đổi ngày cưới (W mới, I = hôm nay): chỉ tính lại việc khung chưa xong chưa gắn đơn (bằng planFrame đầy đủ luật).
 * Việc đã xong, việc chi tiết của đơn (neo theo ngày thực hiện E của đơn) và việc khách tự thêm (không có mã mẫu) giữ nguyên. Trả các việc có hạn đổi.
 */
export function replanOnWeddingDateChange(
  templates: readonly TimelineTemplate[],
  input: { wedding: string; today: string; tasks: readonly ExistingTask[]; services: readonly ServiceKey[] },
): DateChange[] {
  const byCode = new Map(templates.map((t) => [t.code, t]));
  const have = new Map(input.tasks.map((t) => [t.code, t]));
  const changes: DateChange[] = [];
  const plan = planFrame(templates, { wedding: input.wedding, today: input.today, services: input.services });
  for (const p of plan.tasks) {
    const tpl = byCode.get(p.code);
    const t = have.get(p.code);
    if (tpl && isFrame(tpl.kind) && t && !t.done && t.date !== p.date) changes.push({ code: p.code, from: t.date, to: p.date });
  }
  return changes.sort((a, b) => a.to.localeCompare(b.to));
}

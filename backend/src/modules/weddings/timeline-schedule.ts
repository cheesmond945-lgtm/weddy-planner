/*
 * Bộ tính ngày timeline cưới (docs/TIMELINE.md). Hàm thuần: không đụng CSDL, không đọc đồng hồ; "hôm nay" do nơi gọi truyền vào.
 * Ngày là chuỗi "YYYY-MM-DD" (cùng quy ước cột @db.Date), bên trong tính theo số ngày kể từ 1970-01-01 UTC để khỏi lệch múi giờ.
 *
 * Ký hiệu: W ngày cưới, I hôm nay (ngày nhập), L = W − I, L1 = L − 1, d số ngày trước W theo mẫu,
 *          D ngày đặt cọc, E ngày thực hiện của đơn.
 */
import type { BudgetPresetKey, ServiceKey, TaskKind, TimelineTemplate } from './timeline-templates.ts';
import { FRAME_MAX_OFFSET, PRIORITY_ORDER, STEP_HINT, mergedTitle } from './timeline-templates.ts';

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

/* ------------------------------------------------------------------------------------------------------------------
 * Timeline khung đầy đủ: Bước 0 (gộp việc theo mật độ) → Bước 1–6 (planFrame, giữ nguyên) → Bước 7 (ưu tiên, chặn W − 1).
 * ------------------------------------------------------------------------------------------------------------------ */

/** Nhãn "Ưu tiên k" chỉ khi L ≤ ngưỡng này. */
export const PRIORITY_MAX_L = 80;
const NOTE_MAX = 200;
const FINAL_CHECK = 'SELF_FINAL_CHECK';
const isChain = (k: TaskKind) => k === 'CHOOSE' || k === 'BOOK';
const byOrder = (a: TimelineTemplate, b: TimelineTemplate) => a.order - b.order;

/** Tỷ lệ % mức Tùy chỉnh theo dịch vụ (thiếu dịch vụ nào coi như 0). */
export type ServiceWeights = Partial<Record<ServiceKey, number>>;

/**
 * Thứ tự ưu tiên các dịch vụ khách chọn: trung tâm tiệc cưới luôn đầu, còn lại theo mức chia ngân sách (PRIORITY_ORDER).
 * Tùy chỉnh có tỷ lệ: % cao trước, bằng nhau theo thứ tự Cân bằng. Không có dữ liệu (hoặc Tùy chỉnh chưa có tỷ lệ) thì dùng Cân bằng.
 */
export function priorityOrder(services: readonly ServiceKey[], preset?: BudgetPresetKey | null, weights?: ServiceWeights | null): ServiceKey[] {
  const balanced = PRIORITY_ORDER.BALANCED;
  const rest =
    preset === 'CUSTOM'
      ? weights
        ? [...balanced].sort((a, b) => (weights[b] ?? 0) - (weights[a] ?? 0)) // sort ổn định: bằng nhau giữ thứ tự Cân bằng
        : balanced
      : preset && preset in PRIORITY_ORDER
        ? PRIORITY_ORDER[preset as Exclude<BudgetPresetKey, 'CUSTOM'>]
        : balanced;
  const picked = new Set(services);
  return [...(picked.has('nha-hang') ? (['nha-hang'] as ServiceKey[]) : []), ...rest.filter((s) => picked.has(s))];
}

/** Ghi chú gợi ý của việc gộp: "Gợi ý: bước 1 → bước 2 → … → Chốt" từ các việc Chọn NCC của chuỗi, tối đa 200 ký tự. */
export function mergedNote(templates: readonly TimelineTemplate[], service: ServiceKey): string {
  const steps = templates.filter((t) => t.service === service && t.kind === 'CHOOSE').sort(byOrder).map((t) => STEP_HINT[t.code] ?? t.title);
  const s = `Gợi ý: ${[...steps, 'Chốt'].join(' → ')}`;
  return s.length > NOTE_MAX ? `${s.slice(0, NOTE_MAX - 1)}…` : s;
}

/**
 * Bước 0: thay mọi việc Chọn NCC + Mốc chốt của từng dịch vụ trong `services` bằng một việc "Chọn và chốt …":
 * giữ mã, thứ tự và d của Mốc chốt (để vẫn tự hoàn thành khi đặt cọc), không ưu tiên cuối tuần, không noShrink.
 */
export function mergeChains(templates: readonly TimelineTemplate[], services: readonly ServiceKey[]): TimelineTemplate[] {
  const out = templates.filter((t) => !(t.service && services.includes(t.service) && isChain(t.kind)));
  for (const s of services) {
    const book = templates.find((t) => t.service === s && t.kind === 'BOOK');
    if (book) out.push({ order: book.order, code: book.code, title: mergedTitle(s), service: s, kind: 'BOOK', anchor: 'W', offset: book.offset });
  }
  return out.sort(byOrder);
}

/**
 * Dịch vụ đã gộp trong một timeline có sẵn: có mã Mốc chốt mà không còn mã Chọn NCC nào của dịch vụ đó.
 * `codes`: mã mẫu của mọi dòng (kể cả dòng khách đã xóa, bỏ tiền tố DEL:) để việc khách tự xóa không bị coi là gộp.
 */
export function mergedServicesOf(templates: readonly TimelineTemplate[], codes: Iterable<string>): ServiceKey[] {
  const have = new Set(codes);
  const out: ServiceKey[] = [];
  for (const book of templates.filter((t) => t.kind === 'BOOK' && t.service)) {
    const chooses = templates.filter((t) => t.service === book.service && t.kind === 'CHOOSE');
    if (have.has(book.code) && chooses.length > 0 && !chooses.some((t) => have.has(t.code))) out.push(book.service!);
  }
  return out;
}

export interface TimelineTask extends ScheduledTask {
  title: string;
  service: ServiceKey | null;
  kind: TaskKind;
  /** offset của mẫu: âm là việc trước cưới */
  offset: number;
  /** Việc gộp "Chọn và chốt …" (Bước 0) */
  merged: boolean;
  /** Ghi chú gợi ý bước con (chỉ việc gộp) */
  note: string | null;
  /** "Ưu tiên k" (chỉ khi L ≤ 80 và việc thuộc một dịch vụ) */
  priority: number | null;
}

export interface TimelinePlan {
  L: number;
  level: PrepLevel;
  K: number | null;
  /** Số việc trước cưới sau khi lọc theo dịch vụ (trước khi gộp) */
  n: number;
  /** n / (L − 1); L − 1 ≤ 0 là vô hạn */
  density: number;
  /** Dịch vụ đã gộp */
  merged: ServiceKey[];
  /** Thứ tự ưu tiên dịch vụ (luôn tính, dùng để giao hạn cho việc gộp) */
  order: ServiceKey[];
  /** Nhãn ưu tiên theo dịch vụ; null khi L > 80 */
  priority: Partial<Record<ServiceKey, number>> | null;
  /** W − 1 < I + 1 (cưới ngày mai): Bước 7.3 không chặn, giữ hành vi cũ */
  capSkipped: boolean;
  tasks: TimelineTask[];
}

/**
 * Timeline khung đầy đủ (hàm thuần):
 * - Bước 0: n = số việc trước cưới của các dịch vụ khách chọn, mật độ = n / (L − 1). Mật độ > 1 thì gộp chuỗi từng dịch vụ (mergeChains).
 *   `merged` truyền vào thì dùng đúng danh sách đó (tính lại timeline đã sinh: giữ trạng thái gộp như lúc sinh).
 * - Bước 1–6: planFrame trên danh sách sau Bước 0, không đổi công thức.
 * - Bước 7.1: L ≤ 80 thì mọi việc của dịch vụ mang nhãn "Ưu tiên k" (priorityOrder).
 * - Bước 7.2: có gộp thì các hạn (kèm cờ Gấp) của việc gộp sắp tăng dần, hạn sớm nhất cho dịch vụ ưu tiên cao nhất;
 *   trùng ngày thì việc ưu tiên thấp hơn lùi 1 ngày, không quá W − 1 (vượt thì để trùng).
 * - Bước 7.3: việc trước cưới có hạn > W − 1 về W − 1; "Rà soát cuối" là việc trước cưới muộn nhất (tối đa W − 1).
 *   W − 1 < I + 1 thì bỏ qua (giữ hành vi cũ). Việc sau cưới không đổi.
 */
export function planTimeline(
  templates: readonly TimelineTemplate[],
  input: { wedding: string; today: string; services: readonly ServiceKey[]; preset?: BudgetPresetKey | null; weights?: ServiceWeights | null; merged?: readonly ServiceKey[] },
): TimelinePlan {
  const W = dayOf(input.wedding);
  const I = dayOf(input.today);
  const L = W - I;
  levelOf(L); // L ≤ 0: RangeError như planFrame
  const L1 = L - 1;
  const services = [...new Set(input.services)];

  // Bước 0
  const mine = templates.filter((t) => isFrame(t.kind) && (t.service === null || services.includes(t.service)));
  const n = mine.filter((t) => t.offset < 0).length;
  const density = L1 <= 0 ? Infinity : n / L1;
  const withBook = services.filter((s) => templates.some((t) => t.service === s && t.kind === 'BOOK'));
  const merged = input.merged ? withBook.filter((s) => input.merged!.includes(s)) : density > 1 ? withBook : [];
  const effective = merged.length ? mergeChains(templates, merged) : templates;

  // Bước 1–6
  const frame = planFrame(effective, { wedding: input.wedding, today: input.today, services });

  // Bước 7.1
  const order = priorityOrder(services, input.preset, input.weights);
  const priority = L <= PRIORITY_MAX_L ? Object.fromEntries(order.map((s, i) => [s, i + 1])) as Partial<Record<ServiceKey, number>> : null;
  const tpl = new Map(effective.map((t) => [t.code, t]));
  const tasks: TimelineTask[] = frame.tasks.map((p) => {
    const t = tpl.get(p.code)!;
    const isMerged = t.kind === 'BOOK' && !!t.service && merged.includes(t.service);
    return {
      ...p,
      rules: [...p.rules],
      title: t.title,
      service: t.service,
      kind: t.kind,
      offset: t.offset,
      merged: isMerged,
      note: isMerged ? mergedNote(templates, t.service!) : null,
      priority: t.service && priority ? (priority[t.service] ?? null) : null,
    };
  });

  const last = W - 1;
  // Bước 7.2
  const mt = tasks.filter((t) => t.merged);
  if (mt.length > 1) {
    const slots = mt.map((t) => ({ day: dayOf(t.date), urgent: t.urgent, shortened: t.shortened })).sort((a, b) => a.day - b.day);
    const ranked = [...mt].sort((a, b) => order.indexOf(a.service!) - order.indexOf(b.service!));
    let prev: number | null = null;
    ranked.forEach((t, i) => {
      let day = slots[i].day;
      if (prev !== null && day <= prev) day = prev + 1 <= last ? prev + 1 : prev;
      if (ymd(day) !== t.date) t.rules.push('theo ưu tiên');
      t.date = ymd(day);
      t.urgent = slots[i].urgent;
      t.shortened = slots[i].shortened;
      prev = day;
    });
  }

  // Bước 7.3
  const capSkipped = last < I + 1;
  if (!capSkipped) {
    const before = tasks.filter((t) => t.offset < 0);
    for (const t of before) {
      if (dayOf(t.date) > last) {
        t.date = ymd(last);
        t.rules.push('chặn W−1');
      }
    }
    const fc = before.find((t) => t.code === FINAL_CHECK);
    if (fc) {
      const latest = Math.max(...before.filter((t) => t !== fc).map((t) => dayOf(t.date)));
      if (latest > dayOf(fc.date)) {
        fc.date = ymd(Math.min(latest, last));
        fc.rules.push('rà soát cuối');
      }
    }
  }

  return { L, level: frame.level, K: frame.K, n, density, merged, order, priority, capSkipped, tasks };
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
 * Khi khách đổi ngày cưới (W mới, I = hôm nay): chỉ tính lại việc khung chưa xong chưa gắn đơn (bằng planTimeline đầy đủ luật).
 * Trạng thái gộp giữ như lúc sinh: `merged` (nơi gọi tính từ mọi dòng, kể cả dòng đã xóa) hoặc suy từ `tasks` (mergedServicesOf).
 * Việc đã xong, việc chi tiết của đơn (neo theo ngày thực hiện E của đơn) và việc khách tự thêm (không có mã mẫu) giữ nguyên. Trả các việc có hạn đổi.
 */
export function replanOnWeddingDateChange(
  templates: readonly TimelineTemplate[],
  input: {
    wedding: string;
    today: string;
    tasks: readonly ExistingTask[];
    services: readonly ServiceKey[];
    preset?: BudgetPresetKey | null;
    weights?: ServiceWeights | null;
    merged?: readonly ServiceKey[];
  },
): DateChange[] {
  const byCode = new Map(templates.map((t) => [t.code, t]));
  const have = new Map(input.tasks.map((t) => [t.code, t]));
  const changes: DateChange[] = [];
  const merged = input.merged ?? mergedServicesOf(templates, input.tasks.map((t) => t.code));
  const plan = planTimeline(templates, { wedding: input.wedding, today: input.today, services: input.services, preset: input.preset, weights: input.weights, merged });
  for (const p of plan.tasks) {
    const tpl = byCode.get(p.code);
    const t = have.get(p.code);
    if (tpl && isFrame(tpl.kind) && t && !t.done && t.date !== p.date) changes.push({ code: p.code, from: t.date, to: p.date });
  }
  return changes.sort((a, b) => a.to.localeCompare(b.to));
}

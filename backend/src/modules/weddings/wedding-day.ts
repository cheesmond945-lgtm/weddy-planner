/*
 * Lịch trình ngày cưới theo giờ (docs/LICH_TRINH_NGAY_CUOI.md). Hàm thuần: không đụng CSDL, không đọc đồng hồ.
 * Mốc là giờ chính của khách (weddings.main_time, vd 11:00 đón khách). Mỗi đơn đã cọc / hoàn thành làm ĐÚNG ngày cưới có một khung giờ
 * có mặt: NCC đã chốt thì lấy giờ đã chốt; chưa chốt thì dự kiến = giờ chính − thời gian có mặt trước (gói khai, hoặc mặc định theo lĩnh vực).
 * Sảnh (Nhà hàng / Trung tâm tiệc cưới) cho đơn vị khác vào setup từ setup_open_time; hôm trước sảnh có tiệc khác thì không vào sớm hơn được.
 * Thời điểm trong ngày tính bằng PHÚT kể từ 00:00 ngày cưới (giờ VN); âm là tối hôm trước.
 */

/** Lĩnh vực có sảnh (khớp halls/hall-busy.ts HALL_CATEGORY_SLUG) */
export const VENUE_SLUG = 'nha-hang';

export interface DayDefault {
  /** Có mặt trước giờ chính bao nhiêu phút */
  lead: number;
  /** Làm trong bao nhiêu phút kể từ lúc có mặt */
  duration: number;
  /** Phải xong trước giờ chính (trang trí, hoa, makeup, trang phục); sảnh và chụp ảnh làm xuyên giờ chính */
  finishBeforeMain: boolean;
}

/** Mặc định theo lĩnh vực khi gói chưa khai (service_packages.dayof_*). Lĩnh vực lạ dùng OTHER_DEFAULT. */
export const DAY_DEFAULTS: Record<string, DayDefault> = {
  'nha-hang': { lead: 180, duration: 420, finishBeforeMain: false },
  decor: { lead: 360, duration: 300, finishBeforeMain: true },
  'hoa-cuoi': { lead: 180, duration: 60, finishBeforeMain: true },
  makeup: { lead: 240, duration: 180, finishBeforeMain: true },
  'trang-phuc': { lead: 300, duration: 60, finishBeforeMain: true },
  'chup-anh': { lead: 180, duration: 480, finishBeforeMain: false },
};
export const OTHER_DEFAULT: DayDefault = { lead: 120, duration: 240, finishBeforeMain: false };
export const defaultOf = (slug: string) => DAY_DEFAULTS[slug] ?? OTHER_DEFAULT;

/** Sảnh chưa khai giờ cho đơn vị khác vào setup: coi như từ 06:00 */
export const DEFAULT_SETUP_OPEN = 6 * 60;
/** Giới hạn khi NCC khai / chốt (khớp CHECK trong SQL) */
export const LEAD_MAX = 1440;
export const DURATION_MIN = 15;
export const DURATION_MAX = 1440;

// ---------- Giờ, phút ----------

/** "HH:mm" -> phút trong ngày; null nếu sai dạng */
export function parseHm(s: unknown): number | null {
  if (typeof s !== 'string') return null;
  const m = /^(\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** Phút (có thể âm hoặc ≥ 1440) -> "HH:mm" theo giờ đồng hồ */
export const hm = (min: number) => {
  const d = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(d / 60)).padStart(2, '0')}:${String(d % 60).padStart(2, '0')}`;
};

/** "1 giờ 30 phút" */
export const durationText = (min: number) => {
  const h = Math.floor(Math.abs(min) / 60);
  const m = Math.abs(min) % 60;
  return [h ? `${h} giờ` : '', m ? `${m} phút` : ''].filter(Boolean).join(' ') || '0 phút';
};

const DAY_MS = 86_400_000;
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Phút kể từ 00:00 ngày `ymd` -> giờ VN dạng "YYYY-MM-DDTHH:mm" (có thể là ngày hôm trước) */
export function localOf(ymd: string, min: number): string {
  const day = Math.floor(min / 1440);
  return `${addDays(ymd, day)}T${hm(min)}`;
}

/** "YYYY-MM-DDTHH:mm" (giờ VN) -> phút kể từ 00:00 ngày `ymd`; null nếu sai dạng */
export function minutesFrom(ymd: string, local: unknown): number | null {
  if (typeof local !== 'string') return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(local.trim());
  if (!m || Number.isNaN(Date.parse(m[1]))) return null;
  const t = parseHm(m[2]);
  if (t === null) return null;
  return Math.round((Date.parse(`${m[1]}T00:00:00Z`) - Date.parse(`${ymd}T00:00:00Z`)) / 60_000) + t;
}

/** Thời điểm (timestamptz) -> phút kể từ 00:00 ngày `ymd` giờ VN */
export const minutesOfInstant = (ymd: string, d: Date) => Math.round((d.getTime() - Date.parse(`${ymd}T00:00:00+07:00`)) / 60_000);
/** Phút kể từ 00:00 ngày `ymd` giờ VN -> thời điểm */
export const instantOf = (ymd: string, min: number) => new Date(Date.parse(`${ymd}T00:00:00+07:00`) + min * 60_000);
/** Cột @db.Time (Prisma trả Date 1970-01-01 theo UTC) <-> phút trong ngày */
export const minutesOfTime = (d: Date | null | undefined) => (d ? d.getUTCHours() * 60 + d.getUTCMinutes() : null);
export const timeOfMinutes = (min: number) => new Date(Date.UTC(1970, 0, 1, Math.floor(min / 60), min % 60));

// ---------- Khai báo của gói ----------

export interface DayPlanInput {
  leadMinutes?: unknown;
  durationMinutes?: unknown;
  setupOpenTime?: unknown;
}

export interface DayPlanValue {
  lead: number | null;
  duration: number | null;
  /** Chỉ gói sảnh; null với gói khác */
  setupOpen: number | null;
}

/** Kiểm tra khai báo "thời gian trong ngày cưới" của gói. null / "" là bỏ khai (dùng mặc định). Sảnh mới có giờ cho vào setup. */
export function parseDayPlan(body: DayPlanInput, isVenue: boolean): { value: DayPlanValue } | { errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  const lead = num(body.leadMinutes);
  const duration = num(body.durationMinutes);
  if (lead !== null && (!Number.isInteger(lead) || lead < 0 || lead > LEAD_MAX)) errors.leadMinutes = `Có mặt trước giờ chính từ 0 đến ${LEAD_MAX / 60} giờ.`;
  if (duration !== null && (!Number.isInteger(duration) || duration < DURATION_MIN || duration > DURATION_MAX)) errors.durationMinutes = `Thời gian làm từ ${DURATION_MIN} phút đến ${DURATION_MAX / 60} giờ.`;
  let setupOpen: number | null = null;
  if (isVenue && body.setupOpenTime !== null && body.setupOpenTime !== undefined && body.setupOpenTime !== '') {
    setupOpen = parseHm(body.setupOpenTime);
    if (setupOpen === null) errors.setupOpenTime = 'Giờ dạng HH:mm, ví dụ 05:00.';
  }
  return Object.keys(errors).length ? { errors } : { value: { lead, duration, setupOpen } };
}

// ---------- Xếp lịch ----------

export interface DayOrderInput {
  orderId: string;
  orderCode: string;
  vendorName: string;
  categorySlug: string;
  categoryName: string;
  /** Khai báo của các gói gắn với đơn (sảnh của đơn và gói của từng dòng) */
  packages: readonly { lead: number | null; duration: number | null }[];
  /** Giờ NCC đã chốt (phút kể từ 00:00 ngày cưới); null là chưa chốt */
  confirmed: { start: number; end: number; at: string } | null;
}

export interface VenueInput {
  orderId: string;
  name: string;
  hallName: string | null;
  /** Giờ sảnh khai cho đơn vị khác vào setup; null: chưa khai (dùng DEFAULT_SETUP_OPEN) */
  setupOpen: number | null;
  /** Hôm trước sảnh có tiệc khác / bận thủ công; null: không biết (đơn chưa gắn sảnh) */
  prevDayBusy: boolean | null;
}

export type SlotSource = 'CONFIRMED' | 'PACKAGE' | 'DEFAULT';
export type SlotIssueCode = 'BEFORE_VENUE_OPEN' | 'NEEDS_EARLY_ACCESS' | 'ENDS_AFTER_MAIN';

export interface SlotIssue {
  code: SlotIssueCode;
  /** warn: phải xử lý; info: nên hỏi lại */
  level: 'warn' | 'info';
  message: string;
}

export interface DaySlot {
  orderId: string;
  orderCode: string;
  vendorName: string;
  categorySlug: string;
  categoryName: string;
  isVenue: boolean;
  /** Phút kể từ 00:00 ngày cưới; null khi chưa có giờ chính và NCC chưa chốt */
  start: number | null;
  end: number | null;
  source: SlotSource;
  confirmedAt: string | null;
  issues: SlotIssue[];
}

export interface DayPlan {
  mainTime: number | null;
  venue: (VenueInput & { openAt: number; openIsDefault: boolean }) | null;
  slots: DaySlot[];
}

/** Khung dự kiến của một đơn: gói có khai thì lấy gói (nhiều gói: có mặt sớm nhất, xong muộn nhất), thiếu thì mặc định theo lĩnh vực. */
export function plannedOf(o: Pick<DayOrderInput, 'categorySlug' | 'packages'>, mainTime: number): { start: number; end: number; source: SlotSource } {
  const def = defaultOf(o.categorySlug);
  const declared = o.packages.filter((p) => p.lead !== null || p.duration !== null);
  if (!declared.length) return { start: mainTime - def.lead, end: mainTime - def.lead + def.duration, source: 'DEFAULT' };
  const spans = declared.map((p) => {
    const start = mainTime - (p.lead ?? def.lead);
    return { start, end: start + (p.duration ?? def.duration) };
  });
  return { start: Math.min(...spans.map((s) => s.start)), end: Math.max(...spans.map((s) => s.end)), source: 'PACKAGE' };
}

/** Cảnh báo của một khung giờ: vào sảnh trước giờ mở (hôm trước sảnh bận là lỗi, sảnh trống là nhắc hỏi), xong sau giờ chính. */
export function slotIssues(s: { start: number; end: number; categorySlug: string; isVenue: boolean }, ctx: { mainTime: number | null; venue: DayPlan['venue'] }): SlotIssue[] {
  const out: SlotIssue[] = [];
  const v = ctx.venue;
  if (v && !s.isVenue && s.start < v.openAt) {
    const short = durationText(v.openAt - s.start);
    if (v.prevDayBusy) {
      out.push({ code: 'BEFORE_VENUE_OPEN', level: 'warn', message: `Sảnh chỉ cho vào từ ${hm(v.openAt)} vì hôm trước có tiệc khác; cần có mặt ${hm(s.start)} nên thiếu ${short}.` });
    } else {
      const why = v.prevDayBusy === false ? 'hôm trước sảnh trống, hỏi sảnh cho setup từ tối hôm trước' : 'hỏi sảnh cho vào sớm hơn';
      out.push({ code: 'NEEDS_EARLY_ACCESS', level: 'info', message: `Cần vào sảnh lúc ${hm(s.start)}, trước giờ sảnh mở ${hm(v.openAt)}: ${why}.` });
    }
  }
  if (ctx.mainTime !== null && defaultOf(s.categorySlug).finishBeforeMain && s.end > ctx.mainTime) {
    out.push({ code: 'ENDS_AFTER_MAIN', level: 'warn', message: `Xong lúc ${hm(s.end)}, sau giờ chính ${hm(ctx.mainTime)} (${durationText(s.end - ctx.mainTime)}).` });
  }
  return out;
}

/** Lịch trình ngày cưới: khung giờ của từng đơn (đã chốt hoặc dự kiến), sắp theo giờ có mặt; đơn chưa có giờ xuống cuối. */
export function planDay(input: { mainTime: number | null; venue: VenueInput | null; orders: readonly DayOrderInput[] }): DayPlan {
  const venue = input.venue ? { ...input.venue, openAt: input.venue.setupOpen ?? DEFAULT_SETUP_OPEN, openIsDefault: input.venue.setupOpen === null } : null;
  const slots = input.orders.map((o): DaySlot => {
    const isVenue = venue?.orderId === o.orderId;
    const base = { orderId: o.orderId, orderCode: o.orderCode, vendorName: o.vendorName, categorySlug: o.categorySlug, categoryName: o.categoryName, isVenue };
    const span = o.confirmed ? { start: o.confirmed.start, end: o.confirmed.end, source: 'CONFIRMED' as const } : input.mainTime !== null ? plannedOf(o, input.mainTime) : null;
    if (!span) return { ...base, start: null, end: null, source: 'DEFAULT', confirmedAt: null, issues: [] };
    return { ...base, ...span, confirmedAt: o.confirmed?.at ?? null, issues: slotIssues({ ...span, categorySlug: o.categorySlug, isVenue }, { mainTime: input.mainTime, venue }) };
  });
  slots.sort((a, b) => (a.start ?? Infinity) - (b.start ?? Infinity) || a.categoryName.localeCompare(b.categoryName));
  return { mainTime: input.mainTime, venue, slots };
}

/** NCC chốt giờ: có mặt từ 00:00 hôm trước đến hết ngày cưới, xong sau lúc có mặt, tối đa DURATION_MAX phút. */
export function slotRangeIssue(start: number | null, end: number | null): string | null {
  if (start === null || end === null) return 'Chọn giờ có mặt và giờ xong dạng YYYY-MM-DDTHH:mm.';
  if (start < -1440 || end > 1440) return 'Giờ có mặt chỉ từ ngày hôm trước đến hết ngày cưới.';
  if (end <= start) return 'Giờ xong phải sau giờ có mặt.';
  if (end - start > DURATION_MAX) return `Một khung giờ tối đa ${DURATION_MAX / 60} giờ.`;
  return null;
}

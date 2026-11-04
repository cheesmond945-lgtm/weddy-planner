/*
 * CHỈ CÒN phần khai báo "thời gian trong ngày cưới" của gói (vendor-packages: PUT /vendors/me/packages/:id/day-plan) và các hàm đổi giờ.
 * Tính năng lịch trình / giờ có mặt ngày cưới (giờ đón khách, xếp giờ cho NCC, chốt giờ) ĐÃ BỎ (docs/LICH_TRINH_NGAY_CUOI.md).
 * Hàm thuần: không đụng CSDL, không đọc đồng hồ.
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

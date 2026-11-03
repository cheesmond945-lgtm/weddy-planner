/**
 * Quy tắc lịch khả dụng theo gói (hàm thuần, không DB), có unit test ở backend/test/availability-rules.test.cjs.
 * Đặc tả: docs/api/availability.md.
 *
 * - Mỗi gói có trạng thái riêng theo ngày: AVAILABLE (còn trống), HELD (giữ chỗ), BOOKED (đã kín); không có dòng = UNKNOWN.
 * - Các gói cùng NCC khai cùng một sảnh (tên sảnh, không phân biệt hoa thường) dùng chung lịch: ngày nào một gói trong
 *   nhóm đã kín thì cả nhóm kín, có gói giữ chỗ thì cả nhóm giữ chỗ. Nhờ vậy không có hai gói cùng hiện "Còn trống"
 *   khi thực tế sảnh chỉ phục vụ được một tiệc.
 */

export type DayStatus = 'AVAILABLE' | 'HELD' | 'BOOKED' | 'UNKNOWN';
export type StoredStatus = 'Available' | 'Held' | 'Booked';

export const TO_API: Record<StoredStatus, DayStatus> = { Available: 'AVAILABLE', Held: 'HELD', Booked: 'BOOKED' };
export const TO_DB: Record<Exclude<DayStatus, 'UNKNOWN'>, StoredStatus> = { AVAILABLE: 'Available', HELD: 'Held', BOOKED: 'Booked' };

export interface RulePackage {
  id: string;
  name: string;
  /** Tên sảnh / nguồn lực; null là gói dùng lịch riêng */
  resource: string | null;
}

/** Trạng thái đã lưu: packageId -> (ngày "YYYY-MM-DD" -> trạng thái) */
export type StoredMap = Map<string, Map<string, DayStatus>>;

export const resourceKey = (name: string | null | undefined) => {
  const k = (name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
  return k || null;
};

/** Các gói dùng chung lịch với gói này (gồm cả chính nó). */
export function siblingsOf(pkg: RulePackage, all: RulePackage[]) {
  const key = resourceKey(pkg.resource);
  return key ? all.filter((p) => resourceKey(p.resource) === key) : [pkg];
}

export interface EffectiveDay {
  date: string;
  /** Trạng thái khách thấy */
  status: DayStatus;
  /** Trạng thái NCC tự đặt cho gói này */
  own: DayStatus;
  /** Gói khác cùng sảnh làm ngày này kín hoặc giữ chỗ (chỉ trả cho NCC) */
  blockedBy: string | null;
}

/** Trạng thái một gói trong một ngày, đã xét các gói cùng sảnh. */
export function effectiveDay(pkg: RulePackage, all: RulePackage[], stored: StoredMap, date: string): EffectiveDay {
  const own = stored.get(pkg.id)?.get(date) ?? 'UNKNOWN';
  const group = siblingsOf(pkg, all);
  const statusOf = (p: RulePackage) => stored.get(p.id)?.get(date) ?? 'UNKNOWN';
  for (const level of ['BOOKED', 'HELD'] as const) {
    if (own === level) return { date, status: level, own, blockedBy: null };
    const other = group.find((p) => p.id !== pkg.id && statusOf(p) === level);
    if (other) return { date, status: level, own, blockedBy: other.name };
  }
  return { date, status: own, own, blockedBy: null };
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

/** "YYYY-MM-DD" hợp lệ (có thật trên lịch). */
export function validDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && isoDate(d) === s;
}

/** Các ngày của tháng "YYYY-MM"; sai định dạng thì null. */
export function monthDays(month: unknown): string[] | null {
  if (typeof month !== 'string' || !MONTH_RE.test(month)) return null;
  const [y, m] = month.split('-').map(Number);
  if (m < 1 || m > 12) return null;
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** Tháng cách tháng hiện tại bao nhiêu (âm là quá khứ). */
export function monthOffset(month: string, now: Date) {
  const [y, m] = month.split('-').map(Number);
  return (y - now.getUTCFullYear()) * 12 + (m - 1 - now.getUTCMonth());
}

/** Số ngày từ lần cập nhật cuối; chưa cập nhật lần nào thì null. */
export const daysSince = (last: Date | null, now: Date) => (last ? Math.floor((now.getTime() - last.getTime()) / 86_400_000) : null);

/** Quá bao nhiêu ngày không cập nhật thì nhắc NCC (và tạo lại thông báo nhắc). */
export const REMIND_AFTER_DAYS = 7;
/** Xét các ngày chưa cập nhật trong bấy nhiêu ngày tới. */
export const REMIND_WINDOW_DAYS = 30;
/** Xem và sửa lịch trong khoảng: 1 tháng trước đến 24 tháng sau tháng hiện tại. */
export const MONTH_RANGE = { min: -1, max: 24 } as const;

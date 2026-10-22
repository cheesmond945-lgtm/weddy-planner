/**
 * Giờ hoạt động lưu thành chuỗi trong cột vendor_profiles.working_hours:
 *   "09:00–21:00"                 (cả tuần, giống dữ liệu mẫu)
 *   "09:00–21:00 (Thứ 2 - Thứ 6)"  (một khoảng ngày)
 * Chuỗi không đúng dạng này (dữ liệu cũ) được coi là chưa khai báo.
 */
export const WEEKDAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const LABELS: Record<Weekday, string> = {
  MONDAY: 'Thứ 2',
  TUESDAY: 'Thứ 3',
  WEDNESDAY: 'Thứ 4',
  THURSDAY: 'Thứ 5',
  FRIDAY: 'Thứ 6',
  SATURDAY: 'Thứ 7',
  SUNDAY: 'Chủ nhật',
};

export interface BusinessHours {
  fromDay: Weekday;
  toDay: Weekday;
  openTime: string;
  closeTime: string;
}

const dayOf = (label: string) => WEEKDAYS.find((d) => LABELS[d] === label.trim());

export function formatHours(h: BusinessHours): string {
  const base = `${h.openTime}–${h.closeTime}`;
  if (h.fromDay === 'MONDAY' && h.toDay === 'SUNDAY') return base;
  return h.fromDay === h.toDay ? `${base} (${LABELS[h.fromDay]})` : `${base} (${LABELS[h.fromDay]} - ${LABELS[h.toDay]})`;
}

export function parseHours(text: string | null): BusinessHours | null {
  const m = text?.match(/^(\d{2}:\d{2})\s*[–-]\s*(\d{2}:\d{2})(?:\s*\((.+)\))?$/);
  if (!m) return null;
  if (!m[3]) return { fromDay: 'MONDAY', toDay: 'SUNDAY', openTime: m[1], closeTime: m[2] };
  const [a, b] = m[3].split(' - ');
  const fromDay = dayOf(a);
  const toDay = dayOf(b ?? a);
  return fromDay && toDay ? { fromDay, toDay, openTime: m[1], closeTime: m[2] } : null;
}

const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;

/** Trả về thông báo lỗi, hoặc null nếu hợp lệ. */
export function validateHours(h: BusinessHours): string | null {
  if (!WEEKDAYS.includes(h.fromDay) || !WEEKDAYS.includes(h.toDay)) return 'Chọn đủ ngày bắt đầu và kết thúc.';
  if (WEEKDAYS.indexOf(h.toDay) < WEEKDAYS.indexOf(h.fromDay)) return 'Ngày kết thúc phải sau ngày bắt đầu.';
  if (!TIME_RE.test(h.openTime ?? '') || !TIME_RE.test(h.closeTime ?? '')) return 'Giờ có dạng HH:mm, bước 30 phút.';
  if (h.closeTime <= h.openTime) return 'Giờ đóng cửa phải sau giờ mở cửa.';
  return null;
}

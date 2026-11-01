/**
 * Giờ làm việc lưu thành một chuỗi trong cột vendor_profiles.working_hours, dạng "09:30–21:00".
 * Giao diện tách thành giờ mở và giờ đóng; BE nối khi lưu và tách khi trả về.
 * Chuỗi cũ không đúng dạng giờ (VD "Cả ngày") được coi là chưa khai báo; phần chữ theo sau (VD "(Thứ 2 - Chủ nhật)") bị bỏ khi lưu lại.
 */
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const RANGE_RE = /^\s*(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})/;

/** "9:5" không hợp lệ; "9:05" -> "09:05". Trả về null nếu không đúng dạng giờ. */
export function normalizeTime(text: string | null | undefined): string | null {
  const m = text?.trim().match(TIME_RE);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

export function parseHours(text: string | null): { openTime: string; closeTime: string } | null {
  const m = text?.match(RANGE_RE);
  const openTime = normalizeTime(m?.[1]);
  const closeTime = normalizeTime(m?.[2]);
  return openTime && closeTime ? { openTime, closeTime } : null;
}

export const formatHours = (openTime: string, closeTime: string) => `${openTime}–${closeTime}`;

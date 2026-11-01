import { HttpException } from '@nestjs/common';

/** Lỗi theo khuôn { error: { code, message, details? } } (AllExceptionsFilter). */
export const fail = (code: string, message: string, status: number, details?: unknown): never => {
  throw new HttpException({ code, message, ...(details !== undefined && { details }) }, status);
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Bỏ dấu, chữ thường: tìm kiếm không phân biệt hoa thường và dấu tiếng Việt. */
export const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase();

export const matches = (q: string | undefined, ...fields: (string | null | undefined)[]) => {
  const term = q?.trim();
  return !term || fields.some((f) => !!f && norm(f).includes(norm(term)));
};

/** "YYYY-MM" của một thời điểm theo giờ Việt Nam. */
export const monthVN = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);

/** Mốc đầu tháng (giờ VN) của tháng cách hiện tại `back` tháng, dạng UTC. */
export function monthStartVN(back = 0): Date {
  const now = new Date(Date.now() + 7 * 3600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1) - 7 * 3600_000);
}

/** "YYYY-MM" của tháng cách hiện tại `back` tháng. */
export const periodBack = (back: number) => monthVN(new Date(monthStartVN(back).getTime() + 3600_000));

export const pct = (now: number, before: number) => (before > 0 ? Math.round(((now - before) / before) * 1000) / 10 : 0);

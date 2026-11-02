import { createHash, createHmac } from 'node:crypto';
import { PLAN_TABS, isPlanTab, type PlanTab } from './plan-tabs';

/**
 * Quy tắc thuần của link xem công khai (P7), có unit test ở backend/test/sharing-rules.test.cjs.
 */

/** Tab mặc định của link xem công khai */
export const DEFAULT_SHARE_TABS: PlanTab[] = ['overview', 'timeline', 'services'];

/** Danh sách tab hợp lệ (bỏ trùng, theo thứ tự chuẩn); không hợp lệ hoặc rỗng thì null. */
export function normalizeTabs(input: unknown): PlanTab[] | null {
  if (!Array.isArray(input) || !input.every(isPlanTab)) return null;
  const set = new Set(input as PlanTab[]);
  const tabs = PLAN_TABS.filter((t) => set.has(t));
  return tabs.length ? tabs : null;
}

/**
 * Mã trong link: HMAC-SHA256(khóa bí mật, "share:" + id dòng), dạng base64url (43 ký tự, 32 byte).
 * Backend dựng lại được mã từ id để cặp đôi sao chép lại link, nên DB không cần lưu mã.
 */
export const linkToken = (secret: string, id: string) => createHmac('sha256', secret).update(`share:${id}`).digest('base64url');

/** Thứ lưu trong DB để tra cứu: SHA-256 (hex) của mã. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Mã có đúng dạng không (chặn sớm chuỗi rác trước khi tra DB). */
export const isTokenShape = (s: string) => /^[A-Za-z0-9_-]{43}$/.test(s);

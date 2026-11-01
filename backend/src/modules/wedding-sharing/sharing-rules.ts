import { createHash, createHmac } from 'node:crypto';
import { PLAN_TABS, isPlanTab, type PlanTab } from '../wedding-members/wedding-access';

/**
 * Quy tắc thuần của lời mời và link xem công khai (P7), có unit test ở backend/test/sharing-rules.test.cjs.
 */

export type InviteRelation = 'Bride' | 'Groom' | 'Relative';
export type InviteRole = 'Editor' | 'Viewer';

/** Tối đa số link mời đang chờ của một đám cưới */
export const MAX_PENDING_INVITES = 10;
/** Link mời hết hạn sau số ngày này */
export const INVITE_TTL_DAYS = 14;
/** Tab mặc định của link xem công khai */
export const DEFAULT_SHARE_TABS: PlanTab[] = ['overview', 'timeline', 'services'];

/** Mặc định khi mời: Cô dâu/Chú rể chỉnh sửa, xem cả 5 tab; Người thân chỉ xem, xem Tổng quan, Timeline, Dịch vụ. */
export function inviteDefaults(relation: InviteRelation): { role: InviteRole; tabs: PlanTab[] } {
  return relation === 'Relative' ? { role: 'Viewer', tabs: [...DEFAULT_SHARE_TABS] } : { role: 'Editor', tabs: [...PLAN_TABS] };
}

/** Danh sách tab hợp lệ (bỏ trùng, theo thứ tự chuẩn); không hợp lệ hoặc rỗng thì null. */
export function normalizeTabs(input: unknown): PlanTab[] | null {
  if (!Array.isArray(input) || !input.every(isPlanTab)) return null;
  const set = new Set(input as PlanTab[]);
  const tabs = PLAN_TABS.filter((t) => set.has(t));
  return tabs.length ? tabs : null;
}

/**
 * Mã trong link: HMAC-SHA256(khóa bí mật, loại + id dòng), dạng base64url (43 ký tự, 32 byte).
 * Backend dựng lại được mã từ id để chủ kế hoạch sao chép lại link, nên DB không cần lưu mã.
 */
export const linkToken = (secret: string, kind: 'invite' | 'share', id: string) => createHmac('sha256', secret).update(`${kind}:${id}`).digest('base64url');

/** Thứ lưu trong DB để tra cứu: SHA-256 (hex) của mã. */
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Mã có đúng dạng không (chặn sớm chuỗi rác trước khi tra DB). */
export const isTokenShape = (s: string) => /^[A-Za-z0-9_-]{43}$/.test(s);

export type InviteStatus = 'VALID' | 'USED' | 'REVOKED' | 'EXPIRED';

export function inviteStatus(inv: { used_date: Date | null; revoked_date: Date | null; expires_date: Date }, now = new Date()): InviteStatus {
  if (inv.revoked_date) return 'REVOKED';
  if (inv.used_date) return 'USED';
  if (inv.expires_date.getTime() <= now.getTime()) return 'EXPIRED';
  return 'VALID';
}

/**
 * Người nhận lời mời đang có kế hoạch riêng (Q5):
 * - đang là thành viên (không phải owner) của kế hoạch khác: phải rời trước;
 * - owner của kế hoạch có hội thoại, đơn, hoặc người cùng lập: từ chối;
 * - owner của kế hoạch trống (chưa có những thứ trên): hỏi, đồng ý (leaveOwnPlan) thì xóa kế hoạch riêng rồi nhận.
 */
export function acceptDecision(
  current: { role: 'Owner' | 'Editor' | 'Viewer'; sameWedding: boolean; conversations: number; orders: number; otherMembers: number } | null,
  leaveOwnPlan: boolean,
): 'JOIN' | 'ALREADY_JOINED' | 'LEAVE_OTHER_FIRST' | 'OWN_PLAN_IN_USE' | 'CONFIRM_LEAVE_OWN_PLAN' | 'DELETE_OWN_PLAN_THEN_JOIN' {
  if (!current) return 'JOIN';
  if (current.sameWedding) return 'ALREADY_JOINED';
  if (current.role !== 'Owner') return 'LEAVE_OTHER_FIRST';
  if (current.conversations || current.orders || current.otherMembers) return 'OWN_PLAN_IN_USE';
  return leaveOwnPlan ? 'DELETE_OWN_PLAN_THEN_JOIN' : 'CONFIRM_LEAVE_OWN_PLAN';
}

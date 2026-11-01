/** Vai trò trong một đám cưới (cột wedding_members.role). */
export type MemberRole = 'Owner' | 'Editor' | 'Viewer';

/** Subtab của Kế hoạch (cột wedding_members.tabs, wedding_share_links.tabs). */
export const PLAN_TABS = ['overview', 'timeline', 'services', 'budget', 'guests'] as const;
export type PlanTab = (typeof PLAN_TABS)[number];

export const ROLE_RANK: Record<MemberRole, number> = { Viewer: 0, Editor: 1, Owner: 2 };

/** Đám cưới đang dùng của người gọi, guard gắn vào req.wedding. */
export interface WeddingAccess {
  weddingId: string;
  /** Tài khoản owner (= weddings.user_id). Hội thoại và đơn hàng phía khách gắn với tài khoản này. */
  ownerId: string;
  role: MemberRole;
  /** Subtab được xem. Owner và thành viên có tabs NULL: tất cả. */
  tabs: PlanTab[];
}

/** NULL hoặc rỗng trong DB nghĩa là xem tất cả. */
export const tabsOf = (role: MemberRole, tabs: string[] | null | undefined): PlanTab[] =>
  role === 'Owner' || !tabs?.length ? [...PLAN_TABS] : PLAN_TABS.filter((t) => tabs.includes(t));

export const isPlanTab = (s: unknown): s is PlanTab => typeof s === 'string' && (PLAN_TABS as readonly string[]).includes(s);

/** Dạng trả về API: vai trò viết hoa như các enum khác (docs/api/README.md). */
export const roleDto = (r: MemberRole) => r.toUpperCase() as 'OWNER' | 'EDITOR' | 'VIEWER';

export const accessDto = (a: WeddingAccess) => ({ role: roleDto(a.role), tabs: a.tabs });

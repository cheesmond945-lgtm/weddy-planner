/** Subtab của Kế hoạch (cột wedding_share_links.tabs): link xem công khai chọn phần nào được xem. */
export const PLAN_TABS = ['overview', 'timeline', 'services', 'budget'] as const;
export type PlanTab = (typeof PLAN_TABS)[number];

export const isPlanTab = (s: unknown): s is PlanTab => typeof s === 'string' && (PLAN_TABS as readonly string[]).includes(s);

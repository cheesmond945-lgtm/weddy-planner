import { PLAN_TABS, type PlanTab } from '@/types/wedding'

/** Tên subtab (dùng ở hộp chia sẻ và trang xem công khai) */
export const PLAN_TAB_LABEL: Record<PlanTab, string> = { overview: 'Tổng quan', timeline: 'Timeline', services: 'Dịch vụ', budget: 'Ngân sách' }

/**
 * Các subtab hiện trong Kế hoạch của tôi (Timeline là trang riêng). Tab 'timeline' của link xem công khai quyết định
 * thẻ Công việc trong Tổng quan, nên khi chia sẻ thì đi kèm Tổng quan (xem withTaskAccess).
 */
export const VISIBLE_PLAN_TABS: PlanTab[] = PLAN_TABS.filter((t) => t !== 'timeline')

/** Gắn tab 'timeline' theo Tổng quan: có Tổng quan thì người xem thấy cả thẻ Công việc. */
export const withTaskAccess = (tabs: PlanTab[]): PlanTab[] => {
  const shown = tabs.filter((t) => t !== 'timeline')
  return shown.includes('overview') ? PLAN_TABS.filter((t) => t === 'timeline' || shown.includes(t)) : shown
}

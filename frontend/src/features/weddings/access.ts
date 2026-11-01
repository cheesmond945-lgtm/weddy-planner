import { PLAN_TABS, type PlanTab, type WeddingAccess } from '@/types/wedding'

/**
 * Quyền của người đang xem trên Kế hoạch. Backend vẫn kiểm tra lại mọi thao tác; ở đây chỉ để ẩn tab, khóa nút.
 * Không có `access` (chưa có đám cưới, chế độ dữ liệu giả): coi như owner.
 */
export function accessOf(access: WeddingAccess | null | undefined) {
  const role = access?.role ?? 'OWNER'
  const tabs = access?.tabs ?? PLAN_TABS
  const canSee = (tab: PlanTab) => tabs.includes(tab)
  return {
    role,
    tabs,
    canSee,
    canEdit: role !== 'VIEWER',
    /** Viewer chỉ xem được Kế hoạch của tôi (các subtab được cho phép), không vào Dịch vụ cưới, Yêu thích, So sánh, Tin nhắn */
    planOnly: role === 'VIEWER',
    isOwner: role === 'OWNER',
    /** Chat, đặt cọc, yêu cầu sửa đơn: owner hoặc editor được xem tab Dịch vụ (viewer không xem được chat) */
    canChat: role !== 'VIEWER' && canSee('services'),
  }
}

export type PlanAccess = ReturnType<typeof accessOf>

/** Tên subtab (dùng ở hộp chia sẻ, trang lời mời, trang xem công khai) */
export const PLAN_TAB_LABEL: Record<PlanTab, string> = { overview: 'Tổng quan', timeline: 'Timeline', services: 'Dịch vụ', budget: 'Ngân sách', guests: 'Khách mời' }

/**
 * Các subtab hiện trên giao diện. Tab Timeline đã ẩn; quyền 'timeline' ở backend vẫn quyết định
 * thẻ Công việc trong Tổng quan, nên khi chia sẻ thì đi kèm Tổng quan (xem withTaskAccess).
 */
export const VISIBLE_PLAN_TABS: PlanTab[] = PLAN_TABS.filter((t) => t !== 'timeline')

/** Gắn quyền 'timeline' theo Tổng quan: có Tổng quan thì người xem thấy cả thẻ Công việc. */
export const withTaskAccess = (tabs: PlanTab[]): PlanTab[] => {
  const shown = tabs.filter((t) => t !== 'timeline')
  return shown.includes('overview') ? PLAN_TABS.filter((t) => t === 'timeline' || shown.includes(t)) : shown
}

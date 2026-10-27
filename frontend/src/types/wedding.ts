/*
 * CHỜ ĐỐI CHIẾU docs/database.md và docs/state-diagrams.md: tên thực thể, trường, enum đang suy từ prototype.
 * Hợp đồng: docs/api/weddings.md
 */
import type { CategoryRef, ServiceSummary } from './catalog'
import type { Order } from './order'

export interface Wedding {
  id: string
  groomName: string
  brideName: string
  /** Ngày tổ chức, "YYYY-MM-DD" */
  date: string
  /** Khu vực; NCC chỉ có ở Hà Nội nên form không hỏi, BE gán mặc định "Hà Nội" */
  location: string
  /** Sức chứa dự kiến (khách) */
  guestCount: number | null
  /** Tổng ngân sách, đồng */
  budget: number
  styles: string[]
  /** Danh mục dịch vụ muốn sử dụng (slug) */
  categorySlugs: string[]
}

export type WeddingInput = Omit<Wedding, 'id' | 'location'>

// ---- Timeline (4.2, 4.4) ----

export type TimelineItemKind =
  /** Việc chung: mặc định hoặc do cặp đôi thêm */
  | 'TASK'
  /** Mốc "Chốt <hạng mục>", xong khi đã đặt cọc dịch vụ của hạng mục */
  | 'CATEGORY_DEADLINE'
  /** Ngày thực hiện dịch vụ khác ngày cưới (chỉ để xem) */
  | 'SERVICE_DATE'
  /** Việc chi tiết của dịch vụ đã đặt cọc */
  | 'SERVICE_TASK'
  /** Chỗ giữ: việc chi tiết của hạng mục chưa đặt cọc */
  | 'LOCKED'

export interface TimelineItem {
  id: string
  kind: TimelineItemKind
  title: string
  /** "YYYY-MM-DD"; null với LOCKED */
  dueDate: string | null
  isDone: boolean
  /** Việc do cặp đôi tự thêm (được xóa) */
  isCustom: boolean
  category: CategoryRef | null
  /** Với SERVICE_TASK: tên dịch vụ. Với CATEGORY_DEADLINE: dịch vụ trong kế hoạch của hạng mục (nếu có) */
  serviceName: string | null
  /** Với CATEGORY_DEADLINE: trạng thái dịch vụ trong kế hoạch của hạng mục */
  planStatus: PlanItemStatus | null
  /** Với CATEGORY_DEADLINE: id dịch vụ trong kế hoạch (để mở tin nhắn) */
  serviceId: string | null
}

export interface Timeline {
  items: TimelineItem[]
}

export interface TimelineItemPatch {
  title?: string
  dueDate?: string
  isDone?: boolean
}

// ---- Kế hoạch (5.1) ----

export type PlanItemStatus = 'PLANNED' | 'DISCUSSING' | 'AWAITING_DEPOSIT' | 'CONFIRMED'

export interface PlanItem {
  id: string
  service: ServiceSummary
  status: PlanItemStatus
  /** Tên gói đang tính (gói đầu tiên, hoặc gói trong đơn NCC gửi) */
  packageName: string
  /** Giá đang tính, đồng */
  price: number
  /** Đơn dịch vụ mới nhất NCC gửi (nếu có) */
  order: Order | null
}

// ---- Gợi ý AI (4.3) ----

export interface AiSuggestion {
  service: ServiceSummary
  reasons: string[]
}

export interface AiSuggestionResult {
  category: CategoryRef
  /** Ngân sách dùng để lọc */
  budget: number
  budgetSource: 'ALLOCATED' | 'ESTIMATED'
  location: string
  styles: string[]
  /** Với nhà hàng: số khách cần chứa */
  guestCount: number | null
  suggestions: AiSuggestion[]
  /** Khi không có gợi ý: lựa chọn rẻ nhất hiện có */
  cheapest: ServiceSummary | null
}

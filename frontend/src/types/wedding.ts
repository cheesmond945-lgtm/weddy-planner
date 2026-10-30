/*
 * CHỜ ĐỐI CHIẾU docs/database.md và docs/state-diagrams.md: tên thực thể, trường, enum đang suy từ prototype.
 * Hợp đồng: docs/api/weddings.md
 */
import type { CategoryRef, ServiceSummary } from './catalog'
import type { Order } from './order'

export interface Wedding {
  id: string
  /** Ngày tổ chức, "YYYY-MM-DD" */
  date: string
  location: string
  /** Sức chứa dự kiến (khách) */
  guestCount: number | null
  /** Tổng ngân sách, đồng */
  budget: number
  styles: string[]
  /** Danh mục dịch vụ muốn sử dụng (slug) */
  categorySlugs: string[]
}

export type WeddingInput = Omit<Wedding, 'id'>

// ---- Timeline (4.2, 4.4) ----

export type TimelineItemKind =
  /** Việc chung: mặc định hoặc do cặp đôi thêm */
  | 'TASK'
  /** Việc khung "Chọn NCC" (lọc, hỏi giá, đi xem, thử để đánh giá): có nút "Gợi ý {dịch vụ}" */
  | 'CHOOSE'
  /** Mốc "Chốt <hạng mục>", xong khi đã đặt cọc dịch vụ của hạng mục */
  | 'CATEGORY_DEADLINE'
  /** Ngày thực hiện dịch vụ khác ngày cưới (chỉ để xem) */
  | 'SERVICE_DATE'
  /** Việc chi tiết của dịch vụ đã đặt cọc */
  | 'SERVICE_TASK'
  /** Khối khóa "Việc chi tiết của <hạng mục>" khi chưa đặt cọc; không có hạn */
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
  /** SERVICE_TASK: dịch vụ của đơn (để Hẹn với NCC). CHOOSE / CATEGORY_DEADLINE: dịch vụ trong kế hoạch của hạng mục (để nhắn tin) */
  serviceId: string | null
  /** Cờ "Cần làm gấp" (lịch bị ép vì thời gian chuẩn bị ngắn) */
  urgent: boolean
  /** Ngày chỉ là tạm tính (việc theo lịch chụp album chưa chốt) */
  tentative: boolean
  /** Việc chi tiết cần gặp NCC: có nút "Hẹn với NCC" */
  needsMeeting: boolean
  /** Ngày hẹn với NCC "YYYY-MM-DD" (khác Hạn); null khi chưa hẹn */
  appointmentDate: string | null
  /** SERVICE_TASK: ai làm việc này. Khách chỉ tick được CUSTOMER và BOTH; VENDOR do NCC cập nhật */
  owner?: 'CUSTOMER' | 'VENDOR' | 'BOTH' | null
  /** SERVICE_TASK: mã đơn đang giữ việc */
  orderCode: string | null
  /** SERVICE_TASK: ngày thực hiện của đơn đang giữ việc */
  orderEventDate?: string | null
  /** SERVICE_TASK: ngày thực hiện của đơn sau ngày cưới (đơn cũ hoặc khách đã đổi ngày cưới) */
  dateConflict?: boolean
  /** CATEGORY_DEADLINE chưa chốt: số việc chi tiết sẽ mở sau khi đặt cọc */
  detailCount: number
  /** CATEGORY_DEADLINE đang Todo: đơn đã cọc rồi bị hủy gần nhất cùng hạng mục; mất khi cọc đơn mới */
  cancelledOrder: { orderCode: string; vendorName: string; date: string } | null
  /** Có nút "Gợi ý {dịch vụ} →": việc Chọn NCC đầu tiên của dịch vụ, hoặc Mốc chốt đang Todo có đơn đã hủy */
  suggest: boolean
}

/** Mức độ gấp theo số ngày còn lại tới ngày cưới */
export type PrepLevel = 'FAR' | 'NORMAL' | 'SOON' | 'VERY_SOON'

export interface Timeline {
  items: TimelineItem[]
  level: PrepLevel | null
  daysLeft: number | null
}

export interface DateChangePreview {
  /** Số việc chưa xong sẽ đổi hạn */
  count: number
  changes: { id: string; title: string; oldDate: string; newDate: string }[]
  /** Đơn có ngày thực hiện lệch ngày cưới mới: đã cọc khác ngày, hoặc sau ngày cưới mới. blocksDeposit: đơn chưa cọc, khách chưa cọc được cho tới khi NCC đổi ngày */
  warnings: { orderCode: string; vendorName: string; serviceId: string; eventDate: string; message: string; kind?: 'DIFFERENT' | 'AFTER_WEDDING'; blocksDeposit?: boolean }[]
  level: PrepLevel
  daysLeft: number
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
  /** Giá đang tính, đồng: có đơn thì tổng đơn; chưa có thì ước tính từ gói rẻ nhất (giá theo mâm thì × số mâm) */
  price: number
  /** Chưa có đơn và giá theo mâm: giá mỗi mâm, số mâm dùng để ước tính (theo số khách, không dưới số mâm tối thiểu) */
  estimate?: { unitPrice: number; tables: number; minTables: number | null } | null
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

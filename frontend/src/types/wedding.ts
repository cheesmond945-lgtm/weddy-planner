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
  /** Nơi tổ chức: một phường/xã của Hà Nội, có tiền tố ("Phường Cầu Giấy", HANOI_WARDS); null là chưa chọn (đám cưới tạo trước khi có trường này) */
  ward: string | null
  /** Sức chứa dự kiến (khách) */
  guestCount: number | null
  /** Tổng ngân sách, đồng */
  budget: number
  /** Mức chi tiêu (bỏ phong cách 30/10/2026) */
  spendingTier: SpendingTier
  /** Số bàn khách tự nhập; null là tự tính */
  tableCountOverride: number | null
  /** Phiên bản dữ liệu (weddings.updated_date) */
  version?: string
  /** Danh mục dịch vụ muốn sử dụng (slug) */
  categorySlugs: string[]
}

export type WeddingInput = Omit<Wedding, 'id' | 'location' | 'tableCountOverride' | 'version'> & { version?: string }

export interface WeddingPatch {
  budget?: number
  guestCount?: number
  spendingTier?: SpendingTier
  /** null: về số bàn tự tính */
  tableCountOverride?: number | null
  version: string
}

// ---- Chia sẻ ----

/** Subtab của Kế hoạch (link xem công khai chọn phần nào được xem) */
export type PlanTab = 'overview' | 'timeline' | 'services' | 'budget' | 'guests'
export const PLAN_TABS: PlanTab[] = ['overview', 'timeline', 'services', 'budget', 'guests']

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
  /** Thời điểm hoàn thành (ISO) nếu đã xong */
  completedDate?: string | null
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
  /** Todo (NCC đang làm) | Waiting (chờ khách) | Done. Việc khung và việc tự thêm chỉ Todo | Done */
  status: 'Todo' | 'Waiting' | 'Done'
  /** SERVICE_TASK: việc lấy từ gói của NCC (khách chỉ xem) */
  isPackageTask: boolean
  /** SERVICE_TASK: ngày dự kiến (PLANNED) hay NCC đã chốt với khách (CONFIRMED) */
  dateStatus: 'PLANNED' | 'CONFIRMED'
  confirmedAt: string | null
  /** SERVICE_TASK: ai làm việc này (chỉ để hiển thị; khách không tick được việc gắn đơn) */
  owner?: 'CUSTOMER' | 'VENDOR' | 'BOTH' | null
  /** SERVICE_TASK: tên gói của NCC gắn với đơn (sảnh và gói của các dòng) */
  packageName?: string | null
  /** SERVICE_TASK: mã đơn đang giữ việc */
  orderCode: string | null
  /** SERVICE_TASK: ngày thực hiện của đơn đang giữ việc */
  orderEventDate?: string | null
  /** SERVICE_TASK: ngày thực hiện của đơn sau ngày cưới (đơn cũ hoặc khách đã đổi ngày cưới) */
  dateConflict?: boolean
  /** CATEGORY_DEADLINE đã chốt mà đơn không có việc nào của gói: NCC chưa khai quy trình công việc */
  vendorProcessMissing?: boolean
  /** CATEGORY_DEADLINE đã chốt, gói của đơn có việc nhưng timeline chưa có dòng nào của gói: quy trình đang được cập nhật */
  processSyncFailed?: boolean
  /** CATEGORY_DEADLINE đang Todo: đơn đã cọc rồi bị hủy gần nhất cùng hạng mục; mất khi cọc đơn mới */
  cancelledOrder: { orderCode: string; vendorName: string; date: string } | null
  /** Có nút "Gợi ý {dịch vụ} →": việc Chọn NCC đầu tiên của dịch vụ, hoặc Mốc chốt đang Todo có đơn đã hủy */
  suggest: boolean
  /** Nhãn nút theo dịch vụ ("Gợi ý studio chụp ảnh & quay phim"); null khi không có nút */
  suggestLabel: string | null
  /** Ghi chú (tối đa 200 ký tự), không ghi người viết */
  note: string | null
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
  /** Chuỗi rỗng hoặc null: xóa ghi chú */
  note?: string | null
}

export interface NewTask {
  title: string
  dueDate: string
  note?: string
}

// ---- Tổng quan (6) ----

export interface Overview {
  /** null khi không được xem tab Timeline */
  tasks: {
    done: number
    total: number
    overdue: number
    upcoming: { id: string; title: string; dueDate: string; daysLeft: number; category: CategoryRef | null }[]
    /** slug null là "Việc chung" */
    byCategory: { slug: string | null; name: string; done: number; total: number }[]
  } | null
  /** null khi không được xem tab Ngân sách */
  budget: {
    total: number
    planned: number
    deposited: number
    remaining: number
    /** Chi phí theo hạng mục; slug "other" là Chi phí khác */
    slices: { slug: string; name: string; amount: number; budget: number; isOver: boolean }[]
  } | null
  /** null khi không được xem tab Khách mời */
  guests: GuestStats | null
}

// ---- Ngân sách (7) ----

/** Mức chi tiêu: AUTO chọn mức cao nhất vừa ngân sách */
export type SpendingTier = 'AUTO' | 'SAVING' | 'BALANCED' | 'PREMIUM'
export type ConcreteTier = Exclude<SpendingTier, 'AUTO'>

/** Gói đang tính của một nhà cung cấp: ORDER theo đơn (khóa), SELECTED khách chọn, PLANNED gói dự kiến */
export interface PlanPackageRef {
  id: string | null
  name: string | null
  source: 'ORDER' | 'SELECTED' | 'PLANNED'
  /** Gói khách chọn đã ngừng bán, đang tính theo gói dự kiến */
  unavailable: boolean
}

export interface BudgetVendor {
  id: string
  name: string
  status: PlanItemStatus | null
  /** Chi phí theo gói (có đơn thì tổng đơn) */
  cost: number
  hasOrder: boolean
  package: PlanPackageRef & { unit: 'TABLE' | 'PACKAGE' | null }
}

export interface BudgetCategory {
  categoryId: string
  slug: string
  name: string
  /** Ngân sách hiển thị: số sửa tay nếu có, ngược lại số gợi ý */
  budget: number
  /** Số gợi ý theo mức chi đang áp dụng */
  suggested: number
  /** Khách đã sửa tay ("đã sửa") */
  manual: boolean
  /** Lý do dưới số, ví dụ "Theo giá gói mức Cân đối" */
  reason: string
  source: 'PACKAGES' | 'FALLBACK'
  packageCount: number
  vendors: BudgetVendor[]
  /** Tổng chi phí theo gói của hạng mục; null khi chưa có nhà cung cấp */
  cost: number | null
  /** budget - cost: dương là còn, âm là vượt; null khi chưa có nhà cung cấp */
  diff: number | null
}

export interface ExtraCost {
  id: string
  name: string
  amount: number
  createdDate: string
}

export interface BudgetWarning {
  code: 'BELOW_SAVING' | 'TIER_OVER_BUDGET' | 'ALLOCATED_OVER_BUDGET' | 'PACKAGE_UNAVAILABLE'
  message: string
  amount?: number
  vendorId?: string
}

export interface Budget {
  /** Phiên bản dữ liệu, gửi kèm mỗi lần ghi (ghi đồng thời thì nhận 409 STALE_DATA) */
  version: string
  tier: SpendingTier
  effectiveTier: ConcreteTier
  /** "Tự động, đang áp dụng mức Cân đối" */
  tierLabel: string
  tierTotals: Record<ConcreteTier, number>
  guestCount: number
  tables: { count: number; auto: number; override: number | null }
  categories: BudgetCategory[]
  totals: {
    total: number
    extraCosts: number
    /** Ngân sách đã chia: tổng ngân sách hiển thị của các hạng mục */
    allocated: number
    /** Tổng − chi phí khác − ngân sách đã chia: dương là còn dư, âm là vượt */
    unallocated: number
    /** Chi phí theo gói đã chọn */
    packagesCost: number
    /** Tổng − chi phí theo gói − chi phí khác: dương là còn lại, âm là vượt */
    remaining: number
  }
  extraCosts: ExtraCost[]
  warnings: BudgetWarning[]
}

// ---- Khách mời (8) ----

export type GuestSide = 'BRIDE' | 'GROOM'
export type GuestRsvp = 'PENDING' | 'ATTENDING' | 'DECLINED'
export const GUEST_GROUPS = ['Gia đình', 'Họ hàng', 'Bạn bè', 'Đồng nghiệp', 'Khác']

export interface Guest {
  id: string
  fullName: string
  side: GuestSide
  group: string
  partySize: number
  isInvited: boolean
  rsvp: GuestRsvp
  createdDate: string
}

export type GuestInput = Omit<Guest, 'id' | 'createdDate'>

/** Thống kê theo số người */
export interface GuestStats {
  total: number
  expected: number
  invited: number
  attending: number
  declined: number
  /** Đã mời, chưa phản hồi */
  pending: number
  notInvited: number
  bride: number
  groom: number
  rows: number
}

export interface GuestList {
  items: Guest[]
  stats: GuestStats
}

// ---- Nhập và xuất (9) ----

export type ImportType = 'guests' | 'tasks' | 'expenses'

export interface ImportRequest {
  rows: Record<string, string>[]
  /** Chi phí khác: phiên bản ngân sách đã đọc (bắt buộc khi ghi) */
  version?: string
  mode?: 'APPEND' | 'REPLACE'
  dryRun?: boolean
  dateOrder?: 'DMY' | 'MDY'
}

export interface ImportReport {
  total: number
  valid: number
  invalid: number
  created: number
  /** Chỉ các dòng có lỗi hoặc cảnh báo; row bắt đầu từ 1 */
  issues: { row: number; errors: string[]; warnings: string[] }[]
}

// ---- Kế hoạch (5.1) ----

export type PlanItemStatus = 'PLANNED' | 'DISCUSSING' | 'AWAITING_DEPOSIT' | 'CONFIRMED'

export interface PlanItem {
  id: string
  service: ServiceSummary
  status: PlanItemStatus
  /** Tên gói đang tính (gói đầu tiên, hoặc gói trong đơn NCC gửi) */
  packageName: string
  /** Chi phí đang tính (tổng đơn, gói đã chọn hoặc gói dự kiến), đồng */
  price: number
  /** Gói đang tính; null khi không tính được */
  package: PlanPackageRef | null
  /** Các gói đổi được, chi phí theo số bàn hiện tại */
  packages: PlanPackageOption[]
  /** Số bàn đang dùng để tính */
  tables: number
  /** Đơn dịch vụ mới nhất NCC gửi (nếu có) */
  order: Order | null
}

export interface PlanPackageOption {
  id: string
  name: string
  price: number
  unit: 'TABLE' | 'PACKAGE'
  cost: number
  capacity: number | null
  minTables: number | null
  /** Đủ chỗ cho số khách dự kiến */
  fits: boolean
}

// ---- Gợi ý AI (4.3) ----

export interface AiSuggestedPackage {
  id: string
  name: string
  cost: number
  /** Phép tính, ví dụ "Sảnh A: 25 bàn × 5.000.000đ = 125.000.000đ" */
  calculation: string
}

export interface AiSuggestion {
  service: ServiceSummary
  reasons: string[]
  package?: AiSuggestedPackage
}

export interface AiSuggestionResult {
  category: CategoryRef
  /** Ngân sách dùng để lọc */
  budget: number
  budgetSource: 'ALLOCATED' | 'ESTIMATED'
  /** Lý do của ngân sách hạng mục, ví dụ "Theo giá gói mức Cân đối" */
  budgetReason?: string
  location: string
  /** Với nhà hàng: số khách cần chứa */
  guestCount: number | null
  /** Với nhà hàng: số bàn dùng để tính */
  tables?: number | null
  suggestions: AiSuggestion[]
  /** Khi không có gợi ý: lựa chọn rẻ nhất hiện có */
  cheapest: ServiceSummary | null
  cheapestPackage?: AiSuggestedPackage | null
  /** Không gợi ý nào: tăng ngân sách hạng mục lên đúng số này thì có ít nhất một lựa chọn */
  raiseBudgetTo?: number | null
  /** Không nhà hàng nào đủ chỗ */
  noVenueFits?: boolean
  categoryId?: string
  /** Hạng mục nằm trong dịch vụ muốn dùng (mới sửa được ngân sách) */
  isChosenCategory?: boolean
  version?: string
}

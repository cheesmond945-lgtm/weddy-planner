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
  /** Mức chia ngân sách (docs/api/weddings.md mục 7) */
  budgetPreset: BudgetPreset
  /** Số bàn khách tự nhập; null là tự tính */
  tableCountOverride: number | null
  /** Phiên bản dữ liệu (weddings.updated_date) */
  version?: string
  /** Danh mục dịch vụ muốn sử dụng (slug) */
  categorySlugs: string[]
}

export type WeddingInput = Omit<Wedding, 'id' | 'location' | 'tableCountOverride' | 'version' | 'budgetPreset'> & {
  budgetPreset?: Exclude<BudgetPreset, 'CUSTOM'>
  version?: string
}

export interface WeddingPatch {
  budget?: number
  guestCount?: number
  /** null: về số bàn tự tính */
  tableCountOverride?: number | null
  version: string
}

// ---- Chia sẻ ----

/** Subtab của Kế hoạch (link xem công khai chọn phần nào được xem) */
export type PlanTab = 'overview' | 'timeline' | 'services' | 'budget'
export const PLAN_TABS: PlanTab[] = ['overview', 'timeline', 'services', 'budget']

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
  /** SERVICE_TASK: việc "Thanh toán phần còn lại"; Done = NCC đã nhận đủ tiền mặt, completedDate là ngày nhận */
  isRestPayment?: boolean
  /** SERVICE_TASK: việc riêng NCC thêm cho đơn này (khách thấy nhãn "NCC thêm") */
  isCustomOrderTask?: boolean
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
    /** Tiến độ theo dịch vụ (việc không gắn dịch vụ không có nhóm riêng) */
    byCategory: { slug: string; name: string; done: number; total: number }[]
  } | null
  /** Số hạng mục theo trạng thái (total không gồm tự lo); null khi không được xem tab Dịch vụ */
  services: { total: number; deposited: number; ordered: number; planned: number; open: number; own: number } | null
  /** null khi không được xem tab Ngân sách */
  budget: {
    total: number
    planned: number
    deposited: number
    /** Tiền cọc đã mất của đơn bị hủy (đã trả, nằm trong planned) */
    lostDeposits: number
    remaining: number
    /** Chi phí theo hạng mục; slug "other" là Chi phí khác */
    slices: { slug: string; name: string; amount: number; budget: number; isOver: boolean }[]
  } | null
}

// ---- Ngân sách (7) ----

/** Mức chi tiêu: AUTO chọn mức cao nhất vừa ngân sách */
/** Mức chia: Cân bằng, Ưu tiên không gian, Ưu tiên hình ảnh, Tùy chỉnh (thanh kéo ở tab Ngân sách) */
export type BudgetPreset = 'BALANCED' | 'SPACE' | 'VISUAL' | 'CUSTOM'

/** Gói đang tính của một nhà cung cấp: ORDER theo đơn (khóa), SELECTED khách chọn, PLANNED gói dự kiến */
export interface PlanPackageRef {
  id: string | null
  name: string | null
  source: 'ORDER' | 'SELECTED' | 'PLANNED'
  /** Gói khách chọn đã ngừng bán, đang tính theo gói dự kiến */
  unavailable: boolean
  /** Số bàn tối thiểu của gói (nhà hàng); số bàn tính phí = max(số bàn dự kiến, số này) */
  minTables?: number | null
}

/** Một gói trong ô chọn gói của tab Ngân sách: chi phí theo số bàn, gói tiệc vượt sức chứa bị vô hiệu, hệ quả nếu chọn */
export interface BudgetPackageOption {
  id: string
  name: string
  price: number
  unit: 'TABLE' | 'PACKAGE' | null
  minTables: number | null
  capacity: number | null
  cost: number
  chargedTables: number | null
  fits: boolean
  /** Cảnh báo thiếu tiền nếu chọn gói (vượt bao nhiêu, dịch vụ chưa chọn nào cần bao nhiêu, nên làm gì); null khi không thiếu */
  consequence: string | null
}

export interface BudgetVendor {
  id: string
  name: string
  status: PlanItemStatus | null
  /** Chi phí: có đơn thì giá đơn, chưa có đơn thì theo gói đang chọn (mặc định gói rẻ nhất) */
  cost: number
  hasOrder: boolean
  /** Nguồn của số chi phí: PLANNED "Dự kiến", ORDER "Theo đơn", DEPOSITED "Đã cọc" */
  costSource: BudgetCostSource
  /** Tiền cọc đã trả (đơn đã cọc) */
  deposited: number
  /** Gói tiệc vượt sức chứa so với số khách */
  overCapacity: boolean
  package: PlanPackageRef & { unit: 'TABLE' | 'PACKAGE' | null; chargedTables: number | null }
  /** Gói đổi được (rỗng khi đã có đơn) */
  options: BudgetPackageOption[]
}

export type BudgetCostSource = 'PLANNED' | 'ORDER' | 'DEPOSITED'

/** Nhãn của gói gợi ý: không có gói trong giới hạn, gợi ý gói rẻ nhất, vượt X đồng */
export type BudgetSuggestionLabel = { code: 'OVER_BY'; amount: number }

/** Gói hợp lệ của hạng mục trong nhóm chia (client chọn gói gợi ý ngay khi tỷ lệ đổi, cùng hàm pickPackage với backend) */
export interface BudgetCandidatePackage {
  id: string
  cost: number
  place: number
  rating: number | null
  reviewCount: number
  overlap: number
  vendorId: string
  vendorName: string
  name: string
  chargedTables: number | null
  unit: 'TABLE' | 'PACKAGE' | null
}

export interface BudgetCategory {
  categoryId: string
  slug: string
  name: string
  kind: 'VENUE' | 'SERVICE'
  /** CHOSEN đã chọn; SUGGESTED trong nhóm chia / tiệc đề xuất; NO_VENDOR chưa có gói hợp lệ; OWN_VENUE tự lo tiệc; EXCLUDED bỏ khỏi phần chia */
  status: 'CHOSEN' | 'SUGGESTED' | 'NO_VENDOR' | 'OWN_VENUE' | 'EXCLUDED'
  /** Chi phí đang tính: đã chọn, tự lo, hoặc gói gợi ý */
  cost: number
  /** Tỷ lệ trong nhóm chia (số nguyên theo 0,01%, tổng 10000); null nếu ngoài nhóm */
  ratio: number | null
  /** Ngân sách hạng mục (đồng, chính xác): tiền phân bổ / giới hạn gợi ý / giới hạn gói tiệc */
  limit: number | null
  minPrice: number | null
  medianPrice: number | null
  /** Giá gói đắt nhất trong các gói hợp lệ */
  maxPackagePrice: number | null
  message: string | null
  suggestion: {
    packageId: string
    packageName: string
    vendorId: string
    vendorName: string
    cost: number
    chargedTables: number | null
    unit: 'TABLE' | 'PACKAGE' | null
    label: BudgetSuggestionLabel | null
  } | null
  /** Gói hợp lệ (chỉ hạng mục trong nhóm chia) */
  packages: BudgetCandidatePackage[]
  vendors: BudgetVendor[]
}

/** Quỹ dịch vụ (mục 3): chi tiết sau ⓘ và dòng Tiệc chỉ đọc */
export interface BudgetFund {
  totalBudget: number
  selectedCost: number
  /** Phần của tiệc đã chọn trong selectedCost */
  venueSelectedCost: number
  lostDeposit: number
  selfVenueCost: number
  externalCost: number
  remaining: number
  venue: { status: 'CHOSEN' | 'OWN' | 'SUGGESTED' | 'NO_PACKAGE' | 'NONE'; amount: number | null; overBy: number | null }
  /** Quỹ trước khi chặn ở 0 (có thể âm) */
  serviceBudgetRaw: number
  serviceBudget: number
}

export type BaseMode = Exclude<BudgetPreset, 'CUSTOM'>

/** Cấu hình Tùy chỉnh đã lưu (tỷ lệ số nguyên theo 0,01%) */
export interface BudgetSplitConfig {
  version: number
  baseMode: BaseMode
  excluded: string[]
  capAmount: number | null
  items: { categoryId: string; ratio: number; locked: boolean }[]
}

/** Body PUT budget/split */
export type BudgetSplitBody = BudgetSplitConfig

export interface BudgetSplitInfo {
  mode: BudgetPreset
  baseMode: BaseMode
  /** Cấu hình Tùy chỉnh đang dùng (đã áp nhóm hiện tại); null khi dùng phương án có sẵn */
  config: BudgetSplitConfig | null
  /** Dịch vụ chưa chọn có gói hợp lệ (gồm cả hạng mục đã bỏ khỏi phần chia) */
  eligible: { categoryId: string; slug: string; median: number }[]
  /** Hạng mục tự mở khóa khi nhóm đổi */
  notices: string[]
}

export interface ExtraCost {
  id: string
  name: string
  amount: number
  createdDate: string
}

export interface BudgetWarning {
  code: 'PACKAGE_UNAVAILABLE'
  message: string
  vendorId?: string
}

export interface Budget {
  /** Phiên bản dữ liệu, gửi kèm mỗi lần ghi (ghi đồng thời thì nhận 409 STALE_DATA) */
  version: string
  preset: BudgetPreset
  presetLabel: string
  ownVenue: boolean
  ownVenueCost: number | null
  guestCount: number
  tables: { count: number; auto: number; override: number | null }
  fund: BudgetFund
  split: BudgetSplitInfo
  categories: BudgetCategory[]
  totals: {
    total: number
    /** Giá các đơn đã chốt */
    ordersTotal: number
    deposited: number
    /** Còn phải trả cho nhà cung cấp = giá đơn − đã cọc */
    owed: number
    /** Dự kiến chưa chốt: theo gói đang chọn của dịch vụ chưa có đơn */
    plannedTotal: number
    /** Cọc của đơn đã hủy (không hoàn) */
    lostDeposits: number
    extraCosts: number
    ownVenueCost: number
    /** Tổng − giá đơn đã chốt − dự kiến chưa chốt (− cọc mất, chi phí khác, tiệc tự lo) */
    remaining: number
    /** Tổng chi phí các gói gợi ý cho hạng mục chưa chọn */
    suggestedTotal: number
    /** "Còn dư" của phần chia (nhóm rỗng, hoặc chênh lệch với giá trần) */
    leftover: number
  }
  status: 'OK' | 'OVER_BUDGET'
  /** Vượt ngân sách (cảnh báo mềm): soft khi do số dự kiến, strong khi do giá đơn thật */
  overBudget: { level: 'soft' | 'strong'; amount: number; message: string } | null
  /** Kiểm tra khả thi (chỉ cảnh báo) */
  feasibility: { ok: boolean; minNeed: number; shortfall: number; message: string | null; options: string[] }
  extraCosts: ExtraCost[]
  warnings: BudgetWarning[]
}

export interface BudgetSettings {
  budgetPreset?: BudgetPreset
  ownVenue?: boolean
  ownVenueCost?: number | null
}

// ---- Nhập và xuất (9) ----

export type ImportType = 'tasks' | 'expenses'

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
  /** Gói theo bàn: số bàn tính phí = max(số bàn dự kiến, số bàn tối thiểu); trọn gói: null */
  chargedTables?: number | null
}

/** Một thẻ "Gợi ý cho bạn" (thuật toán theo luật ở backend, không dùng AI) */
export interface AiSuggestion {
  service: ServiceSummary
  /** 2 đến 3 ý ngắn: chi phí so với ngân sách, địa điểm, đánh giá */
  reasons: string[]
  /** Nhà hàng có số bàn tối thiểu cao hơn dự kiến */
  warning?: string | null
  /** Dưới ngưỡng số lượt đánh giá: nhãn "Ít đánh giá" */
  fewReviews?: boolean
  package?: AiSuggestedPackage
  /** Cùng phường/xã với nơi tổ chức (gợi ý xếp những NCC này trước); dữ liệu giả có thể không có */
  sameWard?: boolean
}

export interface AiSuggestionResult {
  category: CategoryRef
  /** Ngân sách dùng để lọc */
  budget: number
  budgetSource: 'ALLOCATED' | 'CHOSEN'
  /** Lý do của ngân sách hạng mục, ví dụ "Theo giá gói mức Cân đối" */
  budgetReason?: string
  location: string
  /** Phường/xã nơi tổ chức; null khi chưa có (ghi "tại {tỉnh/thành}") */
  ward?: string | null
  /** Với nhà hàng: số khách cần chứa */
  guestCount: number | null
  /** Với nhà hàng: số bàn dùng để tính */
  tables?: number | null
  suggestions: AiSuggestion[]
  /** Số dịch vụ đang hiển thị của hạng mục ("Xem thêm n dịch vụ") */
  totalInCategory?: number
  /** Số dịch vụ qua mọi điều kiện trừ ngân sách */
  outOfBudgetCount?: number
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

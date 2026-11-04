import type {
  AiSuggestionResult,
  Budget,
  BudgetSettings,
  BudgetSplitBody,
  DateChangePreview,
  DaySchedule,
  ImportReport,
  ImportRequest,
  ImportType,
  NewTask,
  Overview,
  PlanItem,
  Timeline,
  TimelineItemPatch,
  Wedding,
  WeddingInput,
  WeddingPatch,
} from '@/types/wedding'
import { download, http } from './client'

const q = (version: string) => `?version=${encodeURIComponent(version)}`

const TEMPLATE_NAME: Record<ImportType, string> = { tasks: 'cong-viec', expenses: 'chi-phi-khac' }
const EXPORT_NAME = { tasks: 'cong-viec.csv', budget: 'ngan-sach.csv' } as const

/** Hợp đồng: docs/api/weddings.md */
export const weddingsApi = {
  // Thông tin đám cưới (4.1)
  getMine: (): Promise<Wedding | null> => (http.get('/weddings/me')),
  saveMine: (body: WeddingInput): Promise<Wedding> => (http.put('/weddings/me', body)),
  /** Đổi nhanh tổng ngân sách, số khách, mức chi, số bàn (tab Ngân sách) */
  patchMine: (body: WeddingPatch): Promise<Wedding> => (http.patch('/weddings/me', body)),

  // Timeline (4.2, 4.4)
  getTimeline: (): Promise<Timeline> => (http.get('/weddings/me/timeline')),
  addTask: (body: NewTask): Promise<Timeline> =>
    http.post('/weddings/me/timeline/tasks', body),
  /** Lịch trình ngày cưới theo giờ: giờ có mặt của từng NCC làm đúng ngày cưới */
  getDaySchedule: (): Promise<DaySchedule> => http.get('/weddings/me/day-schedule'),
  /** Xem trước khi đổi ngày cưới: việc đổi hạn (cũ → mới) và cảnh báo đơn lệch ngày. Không ghi gì. */
  previewDateChange: (weddingDate: string): Promise<DateChangePreview> =>
    http.post('/weddings/me/timeline/regenerate-preview', { weddingDate }),
  updateTimelineItem: (id: string, body: TimelineItemPatch): Promise<Timeline> =>
    http.patch(`/weddings/me/timeline/items/${id}`, body),
  deleteTask: (id: string): Promise<Timeline> =>
    http.delete(`/weddings/me/timeline/tasks/${id}`),

  // Kế hoạch (5.1)
  getPlan: (): Promise<{ categorySlugs: string[]; items: PlanItem[] }> =>
    http.get('/weddings/me/plan-items'),
  addPlanItem: (serviceId: string, replace = false, packageId: string | null = null): Promise<PlanItem> =>
    http.post('/weddings/me/plan-items', { serviceId, replace, ...(packageId && { packageId }) }),
  /** Chọn gói cho nhà cung cấp trong kế hoạch; null là về gói dự kiến */
  setPlanVendorPackage: (vendorId: string, packageId: string | null, version: string): Promise<PlanItem> =>
    http.patch(`/weddings/me/plan-vendors/${vendorId}`, { packageId, version }),
  removePlanItem: (id: string): Promise<null> =>
    http.delete(`/weddings/me/plan-items/${id}`),

  // Gợi ý AI (4.3)
  aiSuggest: (categorySlug: string): Promise<AiSuggestionResult> =>
    http.post('/weddings/me/ai-suggestions', { categorySlug }),

  // Tổng quan (6)
  getOverview: (): Promise<Overview> => (http.get('/weddings/me/overview')),

  // Ngân sách và chi phí khác (7)
  getBudget: (): Promise<Budget> => (http.get('/weddings/me/budget')),
  /** Mức chia, tiệc tự lo; chọn CUSTOM lần đầu thì backend khởi tạo cấu hình Tùy chỉnh */
  updateBudgetSettings: (body: BudgetSettings & { version: string }): Promise<Budget> => http.patch('/weddings/me/budget/settings', body),
  /** Tự lưu cấu hình Tùy chỉnh (toàn bộ); 422 không hợp lệ, 409 lệch phiên bản (details.budget). keepalive: gửi khi rời trang */
  saveBudgetSplit: (body: BudgetSplitBody, keepalive = false): Promise<Budget> => http.put('/weddings/me/budget/split', body, { keepalive }),
  addExtraCost: (body: { name: string; amount: number; version: string }): Promise<Budget> =>
    http.post('/weddings/me/extra-costs', body),
  updateExtraCost: (id: string, body: { name?: string; amount?: number; version: string }): Promise<Budget> =>
    http.patch(`/weddings/me/extra-costs/${id}`, body),
  removeExtraCost: (id: string, version: string): Promise<Budget> =>
    http.delete(`/weddings/me/extra-costs/${id}${q(version)}`),

  // Nhập và xuất (9)
  importRows: (type: ImportType, body: ImportRequest): Promise<ImportReport> =>
    http.post(`/weddings/me/import/${type}`, body),
  downloadTemplate: (type: ImportType) => download(`/weddings/me/import/${type}/template.csv`, `mau-${TEMPLATE_NAME[type]}.csv`),
  downloadExport: (type: 'tasks' | 'budget') => download(`/weddings/me/export/${type}.csv`, EXPORT_NAME[type]),

}

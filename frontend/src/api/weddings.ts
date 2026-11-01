import { mockPlanning } from '@/mocks/planning'
import type {
  AiSuggestionResult,
  Budget,
  GuestInput,
  GuestList,
  GuestSide,
  ImportReport,
  ImportRequest,
  ImportType,
  NewTask,
  Overview,
  PlanItem,
  PlanTab,
  Timeline,
  TimelineItemPatch,
  Wedding,
  WeddingInput,
  WeddingMember,
  WeddingPatch,
} from '@/types/wedding'
import { ApiError, download, http } from './client'
import { isMock, mockDelay } from './mock'

const mock = <T>(fn: () => T, ms = 250) => mockDelay(null, ms).then(fn)

/** Chế độ dữ liệu giả chưa có Tổng quan, Ngân sách, Khách mời, nhập/xuất: đọc thì trả rỗng, ghi thì báo lỗi. */
const EMPTY_GUESTS: GuestList = { items: [], stats: { total: 0, expected: 0, invited: 0, attending: 0, declined: 0, pending: 0, notInvited: 0, bride: 0, groom: 0, rows: 0 } }
const EMPTY_BUDGET: Budget = {
  version: '',
  tier: 'AUTO',
  effectiveTier: 'BALANCED',
  tierLabel: 'Tự động',
  tierTotals: { SAVING: 0, BALANCED: 0, PREMIUM: 0 },
  guestCount: 0,
  tables: { count: 0, auto: 0, override: null },
  categories: [],
  totals: { total: 0, extraCosts: 0, allocated: 0, unallocated: 0, packagesCost: 0, remaining: 0 },
  extraCosts: [],
  warnings: [],
}
const q = (version: string) => `?version=${encodeURIComponent(version)}`
const mockUnsupported = (): never => {
  throw new ApiError(400, 'MOCK_UNSUPPORTED', 'Chế độ dữ liệu giả chưa hỗ trợ thao tác này.')
}

const TEMPLATE_NAME: Record<ImportType, string> = { guests: 'khach-moi', tasks: 'cong-viec', expenses: 'chi-phi-khac' }
const EXPORT_NAME = { guests: 'khach-moi.csv', tasks: 'cong-viec.csv', budget: 'ngan-sach.csv' } as const

/** Hợp đồng: docs/api/weddings.md */
export const weddingsApi = {
  // Thông tin đám cưới (4.1)
  getMine: (): Promise<Wedding | null> => (isMock('weddings') ? mock(mockPlanning.getWedding) : http.get('/weddings/me')),
  saveMine: (body: WeddingInput): Promise<Wedding> => (isMock('weddings') ? mock(() => mockPlanning.saveWedding(body)) : http.put('/weddings/me', body)),
  /** Đổi nhanh tổng ngân sách, số khách, mức chi, số bàn (tab Ngân sách) */
  patchMine: (body: WeddingPatch): Promise<Wedding> => (isMock('weddings') ? mock(mockUnsupported) : http.patch('/weddings/me', body)),

  // Timeline (4.2, 4.4)
  getTimeline: (): Promise<Timeline> => (isMock('weddings') ? mock(mockPlanning.getTimeline) : http.get('/weddings/me/timeline')),
  addTask: (body: NewTask): Promise<Timeline> =>
    isMock('weddings') ? mock(() => mockPlanning.addTask(body)) : http.post('/weddings/me/timeline/tasks', body),
  updateTimelineItem: (id: string, body: TimelineItemPatch): Promise<Timeline> =>
    isMock('weddings') ? mock(() => mockPlanning.updateItem(id, body)) : http.patch(`/weddings/me/timeline/items/${id}`, body),
  deleteTask: (id: string): Promise<Timeline> =>
    isMock('weddings') ? mock(() => mockPlanning.deleteTask(id)) : http.delete(`/weddings/me/timeline/tasks/${id}`),

  // Kế hoạch (5.1)
  getPlan: (): Promise<{ categorySlugs: string[]; items: PlanItem[] }> =>
    isMock('weddings') ? mock(mockPlanning.listPlanItems) : http.get('/weddings/me/plan-items'),
  addPlanItem: (serviceId: string, replace = false, packageId: string | null = null): Promise<PlanItem> =>
    isMock('weddings') ? mock(() => mockPlanning.addPlanItem(serviceId, replace)) : http.post('/weddings/me/plan-items', { serviceId, replace, ...(packageId && { packageId }) }),
  /** Chọn gói cho nhà cung cấp trong kế hoạch; null là về gói dự kiến */
  setPlanVendorPackage: (vendorId: string, packageId: string | null, version: string): Promise<PlanItem> =>
    isMock('weddings') ? mock(mockUnsupported) : http.patch(`/weddings/me/plan-vendors/${vendorId}`, { packageId, version }),
  removePlanItem: (id: string): Promise<null> =>
    isMock('weddings') ? mock(() => mockPlanning.removePlanItem(id)) : http.delete(`/weddings/me/plan-items/${id}`),

  // Gợi ý AI (4.3)
  aiSuggest: (categorySlug: string): Promise<AiSuggestionResult> =>
    isMock('weddingsAi') ? mock(() => mockPlanning.aiSuggest(categorySlug), 1100) : http.post('/weddings/me/ai-suggestions', { categorySlug }),

  // Tổng quan (6)
  getOverview: (): Promise<Overview> => (isMock('weddings') ? mock(() => ({ tasks: null, budget: null, guests: null })) : http.get('/weddings/me/overview')),

  // Ngân sách và chi phí khác (7)
  getBudget: (): Promise<Budget> => (isMock('weddings') ? mock(() => EMPTY_BUDGET) : http.get('/weddings/me/budget')),
  setManualBudget: (categoryId: string, amount: number, version: string): Promise<Budget> =>
    isMock('weddings') ? mock(mockUnsupported) : http.put(`/weddings/me/budget/categories/${categoryId}`, { amount, version }),
  clearManualBudget: (categoryId: string, version: string): Promise<Budget> =>
    isMock('weddings') ? mock(mockUnsupported) : http.delete(`/weddings/me/budget/categories/${categoryId}${q(version)}`),
  resetBudget: (version: string): Promise<Budget> => (isMock('weddings') ? mock(mockUnsupported) : http.post('/weddings/me/budget/reset', { version })),
  rebalanceBudget: (version: string): Promise<Budget> => (isMock('weddings') ? mock(mockUnsupported) : http.post('/weddings/me/budget/rebalance', { version })),
  addExtraCost: (body: { name: string; amount: number; version: string }): Promise<Budget> =>
    isMock('weddings') ? mock(mockUnsupported) : http.post('/weddings/me/extra-costs', body),
  updateExtraCost: (id: string, body: { name?: string; amount?: number; version: string }): Promise<Budget> =>
    isMock('weddings') ? mock(mockUnsupported) : http.patch(`/weddings/me/extra-costs/${id}`, body),
  removeExtraCost: (id: string, version: string): Promise<Budget> =>
    isMock('weddings') ? mock(mockUnsupported) : http.delete(`/weddings/me/extra-costs/${id}${q(version)}`),

  // Khách mời (8)
  getGuests: (): Promise<GuestList> => (isMock('weddings') ? mock(() => EMPTY_GUESTS) : http.get('/weddings/me/guests')),
  addGuest: (body: GuestInput): Promise<GuestList> => (isMock('weddings') ? mock(mockUnsupported) : http.post('/weddings/me/guests', body)),
  addGuests: (body: { names: string[]; side: GuestSide; group: string }): Promise<GuestList> =>
    isMock('weddings') ? mock(mockUnsupported) : http.post('/weddings/me/guests/bulk', body),
  updateGuest: (id: string, body: Partial<GuestInput>): Promise<GuestList> =>
    isMock('weddings') ? mock(mockUnsupported) : http.patch(`/weddings/me/guests/${id}`, body),
  removeGuest: (id: string): Promise<GuestList> => (isMock('weddings') ? mock(mockUnsupported) : http.delete(`/weddings/me/guests/${id}`)),

  // Nhập và xuất (9)
  importRows: (type: ImportType, body: ImportRequest): Promise<ImportReport> =>
    isMock('weddings') ? mock(mockUnsupported) : http.post(`/weddings/me/import/${type}`, body),
  downloadTemplate: (type: ImportType) => download(`/weddings/me/import/${type}/template.csv`, `mau-${TEMPLATE_NAME[type]}.csv`),
  downloadExport: (type: 'guests' | 'tasks' | 'budget') => download(`/weddings/me/export/${type}.csv`, EXPORT_NAME[type]),

  // Người cùng lập kế hoạch (GĐ 2). Chế độ dữ liệu giả: chưa có thành viên nào khác
  listMembers: (): Promise<WeddingMember[]> => (isMock('weddings') ? mock(() => []) : http.get('/weddings/me/members')),
  updateMember: (userId: string, body: { role?: 'EDITOR' | 'VIEWER'; tabs?: PlanTab[] }): Promise<WeddingMember[]> =>
    isMock('weddings') ? mock(mockUnsupported) : http.patch(`/weddings/me/members/${userId}`, body),
  /** Owner xóa thành viên, hoặc thành viên tự rời kế hoạch */
  removeMember: (userId: string): Promise<null> => (isMock('weddings') ? mock(mockUnsupported) : http.delete(`/weddings/me/members/${userId}`)),

}

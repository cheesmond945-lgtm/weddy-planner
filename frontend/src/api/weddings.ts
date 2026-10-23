import { mockPlanning } from '@/mocks/planning'
import type { AiSuggestionResult, PlanItem, Timeline, TimelineItemPatch, Wedding, WeddingInput } from '@/types/wedding'
import { http } from './client'
import { isMock, mockDelay } from './mock'

const mock = <T>(fn: () => T, ms = 250) => mockDelay(null, ms).then(fn)

/** Hợp đồng: docs/api/weddings.md */
export const weddingsApi = {
  // Thông tin đám cưới (4.1)
  getMine: (): Promise<Wedding | null> => (isMock('weddings') ? mock(mockPlanning.getWedding) : http.get('/weddings/me')),
  saveMine: (body: WeddingInput): Promise<Wedding> => (isMock('weddings') ? mock(() => mockPlanning.saveWedding(body)) : http.put('/weddings/me', body)),

  // Timeline (4.2, 4.4)
  getTimeline: (): Promise<Timeline> => (isMock('weddings') ? mock(mockPlanning.getTimeline) : http.get('/weddings/me/timeline')),
  addTask: (body: { title: string; dueDate: string }): Promise<Timeline> =>
    isMock('weddings') ? mock(() => mockPlanning.addTask(body)) : http.post('/weddings/me/timeline/tasks', body),
  updateTimelineItem: (id: string, body: TimelineItemPatch): Promise<Timeline> =>
    isMock('weddings') ? mock(() => mockPlanning.updateItem(id, body)) : http.patch(`/weddings/me/timeline/items/${id}`, body),
  deleteTask: (id: string): Promise<Timeline> =>
    isMock('weddings') ? mock(() => mockPlanning.deleteTask(id)) : http.delete(`/weddings/me/timeline/tasks/${id}`),

  // Kế hoạch (5.1)
  getPlan: (): Promise<{ categorySlugs: string[]; items: PlanItem[] }> =>
    isMock('weddings') ? mock(mockPlanning.listPlanItems) : http.get('/weddings/me/plan-items'),
  addPlanItem: (serviceId: string, replace = false): Promise<PlanItem> =>
    isMock('weddings') ? mock(() => mockPlanning.addPlanItem(serviceId, replace)) : http.post('/weddings/me/plan-items', { serviceId, replace }),
  removePlanItem: (id: string): Promise<null> =>
    isMock('weddings') ? mock(() => mockPlanning.removePlanItem(id)) : http.delete(`/weddings/me/plan-items/${id}`),

  // Gợi ý AI (4.3)
  aiSuggest: (categorySlug: string): Promise<AiSuggestionResult> =>
    isMock('weddingsAi') ? mock(() => mockPlanning.aiSuggest(categorySlug), 1100) : http.post('/weddings/me/ai-suggestions', { categorySlug }),

  // Danh sách phong cách cho form (thuộc catalog)
  listStyles: (): Promise<string[]> => (isMock('catalog') ? mock(mockPlanning.styles) : http.get('/services/styles')),
}

import type { AiSuggestionResult, PlanItem, Timeline, TimelineItemPatch, Wedding, WeddingInput } from '@/types/wedding'
import { http } from './client'

/** Hợp đồng: docs/api/weddings.md */
export const weddingsApi = {
  // Thông tin đám cưới (4.1)
  getMine: (): Promise<Wedding | null> => (http.get('/weddings/me')),
  saveMine: (body: WeddingInput): Promise<Wedding> => (http.put('/weddings/me', body)),

  // Timeline (4.2, 4.4)
  getTimeline: (): Promise<Timeline> => (http.get('/weddings/me/timeline')),
  addTask: (body: { title: string; dueDate: string }): Promise<Timeline> =>
    http.post('/weddings/me/timeline/tasks', body),
  updateTimelineItem: (id: string, body: TimelineItemPatch): Promise<Timeline> =>
    http.patch(`/weddings/me/timeline/items/${id}`, body),
  deleteTask: (id: string): Promise<Timeline> =>
    http.delete(`/weddings/me/timeline/tasks/${id}`),

  // Kế hoạch (5.1)
  getPlan: (): Promise<{ categorySlugs: string[]; items: PlanItem[] }> =>
    http.get('/weddings/me/plan-items'),
  addPlanItem: (serviceId: string, replace = false): Promise<PlanItem> =>
    http.post('/weddings/me/plan-items', { serviceId, replace }),
  removePlanItem: (id: string): Promise<null> =>
    http.delete(`/weddings/me/plan-items/${id}`),

  // Gợi ý AI (4.3)
  aiSuggest: (categorySlug: string): Promise<AiSuggestionResult> =>
    http.post('/weddings/me/ai-suggestions', { categorySlug }),

  // Danh sách phong cách cho form (thuộc catalog)
  listStyles: (): Promise<string[]> => (http.get('/services/styles')),
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weddingsApi } from '@/api/weddings'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { Timeline, TimelineItemPatch, WeddingInput } from '@/types/wedding'

/** Khóa cache theo người dùng để đổi tài khoản không lẫn dữ liệu. */
export const planningKeys = {
  wedding: (uid?: string) => ['wedding', uid] as const,
  timeline: (uid?: string) => ['timeline', uid] as const,
  plan: (uid?: string) => ['plan', uid] as const,
  conversations: (uid?: string) => ['conversations', uid] as const,
  messages: (uid: string | undefined, conversationId: string) => ['messages', uid, conversationId] as const,
  order: (uid: string | undefined, id: string) => ['order', uid, id] as const,
  ai: (uid: string | undefined, slug: string) => ['ai', uid, slug] as const,
}

/** Gọi sau khi dữ liệu kế hoạch đổi: làm mới kế hoạch, timeline, hội thoại. */
export function useRefreshPlanning() {
  const qc = useQueryClient()
  return () => Promise.all(['plan', 'timeline', 'conversations', 'messages', 'order'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

function useCoupleId() {
  const { user } = useAuth()
  return user?.role === 'COUPLE' ? user.id : undefined
}

export function useWedding() {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.wedding(uid), queryFn: weddingsApi.getMine, enabled: !!uid })
}

export function useSaveWedding() {
  const uid = useCoupleId()
  const qc = useQueryClient()
  const refresh = useRefreshPlanning()
  return useMutation({
    mutationFn: (input: WeddingInput) => weddingsApi.saveMine(input),
    onSuccess: (wedding) => {
      qc.setQueryData(planningKeys.wedding(uid), wedding)
      void refresh()
    },
  })
}

export function useStyles() {
  return useQuery({ queryKey: ['styles'], queryFn: weddingsApi.listStyles, staleTime: Infinity })
}

export function useTimeline(enabled: boolean) {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.timeline(uid), queryFn: weddingsApi.getTimeline, enabled: !!uid && enabled })
}

/** Thêm / sửa / xóa việc trên timeline. API trả timeline mới, ghi thẳng vào cache. */
export function useTimelineMutations() {
  const uid = useCoupleId()
  const qc = useQueryClient()
  const onSuccess = (timeline: Timeline) => qc.setQueryData(planningKeys.timeline(uid), timeline)
  return {
    add: useMutation({ mutationFn: weddingsApi.addTask, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: TimelineItemPatch }) => weddingsApi.updateTimelineItem(id, patch),
      onSuccess,
      onError: (e) => toast(e.message),
    }),
    remove: useMutation({ mutationFn: weddingsApi.deleteTask, onSuccess }),
  }
}

export function usePlan() {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.plan(uid), queryFn: weddingsApi.getPlan, enabled: !!uid })
}

export function useRemovePlanItem() {
  const refresh = useRefreshPlanning()
  return useMutation({
    mutationFn: weddingsApi.removePlanItem,
    onSuccess: () => {
      toast('Đã bỏ dịch vụ khỏi kế hoạch')
      void refresh()
    },
    onError: (e) => toast(e.message),
  })
}

export function useAiSuggestions(slug: string, enabled: boolean) {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.ai(uid, slug), queryFn: () => weddingsApi.aiSuggest(slug), enabled: !!uid && enabled && !!slug, staleTime: 0, gcTime: 0 })
}

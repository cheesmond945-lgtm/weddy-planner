import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { weddingsApi } from '@/api/weddings'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import { ApiError } from '@/api/client'
import type { Budget, GuestList, NewTask, PlanTab, Timeline, TimelineItemPatch, Wedding, WeddingInput, WeddingPatch } from '@/types/wedding'
import { accessOf } from './access'

/** Khóa cache theo người dùng để đổi tài khoản không lẫn dữ liệu. */
export const planningKeys = {
  wedding: (uid?: string) => ['wedding', uid] as const,
  timeline: (uid?: string) => ['timeline', uid] as const,
  plan: (uid?: string) => ['plan', uid] as const,
  members: (uid?: string) => ['members', uid] as const,
  overview: (uid?: string) => ['overview', uid] as const,
  budget: (uid?: string) => ['budget', uid] as const,
  guests: (uid?: string) => ['guests', uid] as const,
  conversations: (uid?: string) => ['conversations', uid] as const,
  messages: (uid: string | undefined, conversationId: string) => ['messages', uid, conversationId] as const,
  order: (uid: string | undefined, id: string) => ['order', uid, id] as const,
  ai: (uid: string | undefined, slug: string) => ['ai', uid, slug] as const,
}

/** Gọi sau khi dữ liệu kế hoạch đổi: làm mới kế hoạch, timeline, ngân sách, khách mời (số khách dự kiến), tổng quan, hội thoại. */
export function useRefreshPlanning() {
  const qc = useQueryClient()
  return () =>
    Promise.all(['plan', 'timeline', 'budget', 'guests', 'overview', 'conversations', 'messages', 'order', 'orders'].map((k) => qc.invalidateQueries({ queryKey: [k] })))
}

function useCoupleId() {
  const { user } = useAuth()
  return user?.role === 'COUPLE' ? user.id : undefined
}

export function useWedding() {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.wedding(uid), queryFn: weddingsApi.getMine, enabled: !!uid })
}

/** Quyền của người đang xem trên đám cưới (vai trò, subtab được xem). */
export function useWeddingAccess() {
  return accessOf(useWedding().data?.access)
}

/** Người cùng lập kế hoạch. */
export function useMembers(enabled = true) {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.members(uid), queryFn: weddingsApi.listMembers, enabled: !!uid && enabled })
}

/** Owner đổi quyền hoặc tab được xem của thành viên. */
export function useUpdateMember() {
  const uid = useCoupleId()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string; role?: 'EDITOR' | 'VIEWER'; tabs?: PlanTab[] }) => weddingsApi.updateMember(userId, body),
    onSuccess: (members) => qc.setQueryData(planningKeys.members(uid), members),
    onError: (e) => toast(e.message),
  })
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

export function useTimeline(enabled: boolean) {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.timeline(uid), queryFn: weddingsApi.getTimeline, enabled: !!uid && enabled })
}

/** Thêm / sửa / xóa việc trên timeline. API trả timeline mới, ghi thẳng vào cache. */
export function useTimelineMutations() {
  const uid = useCoupleId()
  const qc = useQueryClient()
  const onSuccess = (timeline: Timeline) => {
    qc.setQueryData(planningKeys.timeline(uid), timeline)
    void qc.invalidateQueries({ queryKey: ['overview'] })
  }
  return {
    add: useMutation({ mutationFn: (task: NewTask) => weddingsApi.addTask(task), onSuccess }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: TimelineItemPatch }) => weddingsApi.updateTimelineItem(id, patch),
      // Tick / bỏ tick hiện ngay trên giao diện, lỗi thì trả về như cũ
      onMutate: async ({ id, patch }) => {
        const key = planningKeys.timeline(uid)
        await qc.cancelQueries({ queryKey: key })
        const previous = qc.getQueryData<Timeline>(key)
        if (previous && patch.isDone !== undefined) {
          qc.setQueryData<Timeline>(key, { ...previous, items: previous.items.map((i) => (i.id === id ? { ...i, isDone: patch.isDone! } : i)) })
        }
        return { previous }
      },
      onError: (e, _vars, context) => {
        if (context?.previous) qc.setQueryData(planningKeys.timeline(uid), context.previous)
        toast(e.message)
      },
      onSuccess,
    }),
    remove: useMutation({ mutationFn: weddingsApi.deleteTask, onSuccess }),
  }
}

/** Dịch vụ trong kế hoạch. Chỉ gọi khi được xem tab Dịch vụ (header, thanh subtab gọi ở mọi trang). */
export function usePlan() {
  const uid = useCoupleId()
  const { canSee } = useWeddingAccess()
  return useQuery({ queryKey: planningKeys.plan(uid), queryFn: weddingsApi.getPlan, enabled: !!uid && canSee('services') })
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

/** Tab Tổng quan. */
export function useOverview() {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.overview(uid), queryFn: weddingsApi.getOverview, enabled: !!uid })
}

/** Tab Ngân sách. `enabled` false khi không được xem tab. */
export function useBudget(enabled = true) {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.budget(uid), queryFn: weddingsApi.getBudget, enabled: !!uid && enabled })
}

/**
 * Phiên bản dữ liệu hiện tại (weddings.updated_date) để gửi kèm khi ghi: lấy từ ngân sách nếu đã tải, không thì từ đám cưới.
 * Ghi đồng thời thì backend trả 409 STALE_DATA; khi đó báo lỗi và tải lại.
 */
function useVersion() {
  const uid = useCoupleId()
  const qc = useQueryClient()
  return () => qc.getQueryData<Budget>(planningKeys.budget(uid))?.version || qc.getQueryData<Wedding>(planningKeys.wedding(uid))?.version || ''
}

/** Sau khi ghi phần ảnh hưởng ngân sách: cập nhật cache và làm mới các nơi dùng chung số liệu. */
function useAfterBudgetWrite() {
  const uid = useCoupleId()
  const qc = useQueryClient()
  return {
    onSuccess: (budget: Budget) => {
      qc.setQueryData(planningKeys.budget(uid), budget)
      // Phiên bản mới cũng là phiên bản của đám cưới
      qc.setQueryData<Wedding | null>(planningKeys.wedding(uid), (w) => (w ? { ...w, version: budget.version } : w))
      for (const k of ['overview', 'plan']) void qc.invalidateQueries({ queryKey: [k] })
    },
    onError: (e: Error) => {
      toast(e.message)
      if (e instanceof ApiError && e.code === 'STALE_DATA') for (const k of ['budget', 'wedding', 'plan']) void qc.invalidateQueries({ queryKey: [k] })
    },
  }
}

/** Sửa tay, đặt lại, cân đối, chi phí khác. API trả ngân sách mới, ghi thẳng vào cache. */
export function useBudgetMutations() {
  const version = useVersion()
  const after = useAfterBudgetWrite()
  return {
    setManual: useMutation({ mutationFn: ({ categoryId, amount }: { categoryId: string; amount: number }) => weddingsApi.setManualBudget(categoryId, amount, version()), ...after }),
    clearManual: useMutation({ mutationFn: (categoryId: string) => weddingsApi.clearManualBudget(categoryId, version()), ...after }),
    reset: useMutation({ mutationFn: () => weddingsApi.resetBudget(version()), ...after }),
    rebalance: useMutation({ mutationFn: () => weddingsApi.rebalanceBudget(version()), ...after }),
    addExtraCost: useMutation({ mutationFn: (body: { name: string; amount: number }) => weddingsApi.addExtraCost({ ...body, version: version() }), onSuccess: after.onSuccess }),
    updateExtraCost: useMutation({
      mutationFn: ({ id, ...body }: { id: string; name?: string; amount?: number }) => weddingsApi.updateExtraCost(id, { ...body, version: version() }),
      ...after,
    }),
    removeExtraCost: useMutation({ mutationFn: (id: string) => weddingsApi.removeExtraCost(id, version()), ...after }),
  }
}

/** Đổi nhanh tổng ngân sách, số khách, mức chi, số bàn. Ô sửa tay giữ nguyên. */
export function usePatchWedding() {
  const uid = useCoupleId()
  const qc = useQueryClient()
  const version = useVersion()
  const after = useAfterBudgetWrite()
  return useMutation({
    mutationFn: (patch: Omit<WeddingPatch, 'version'>) => weddingsApi.patchMine({ ...patch, version: version() }),
    onSuccess: (w) => {
      qc.setQueryData(planningKeys.wedding(uid), w)
      for (const k of ['budget', 'plan', 'guests', 'overview', 'ai']) void qc.invalidateQueries({ queryKey: [k] })
    },
    onError: after.onError,
  })
}

/** Chọn gói cho nhà cung cấp trong kế hoạch (null: về gói dự kiến). */
export function useChoosePackage() {
  const qc = useQueryClient()
  const version = useVersion()
  const after = useAfterBudgetWrite()
  return useMutation({
    mutationFn: ({ vendorId, packageId }: { vendorId: string; packageId: string | null }) => weddingsApi.setPlanVendorPackage(vendorId, packageId, version()),
    onSuccess: () => {
      for (const k of ['plan', 'budget', 'wedding', 'overview']) void qc.invalidateQueries({ queryKey: [k] })
    },
    onError: after.onError,
  })
}

/** Tab Khách mời. */
export function useGuests(enabled = true) {
  const uid = useCoupleId()
  return useQuery({ queryKey: planningKeys.guests(uid), queryFn: weddingsApi.getGuests, enabled: !!uid && enabled })
}

/** Thêm, sửa, xóa khách. API trả danh sách mới, ghi thẳng vào cache. */
export function useGuestMutations() {
  const uid = useCoupleId()
  const qc = useQueryClient()
  const onSuccess = (list: GuestList) => {
    qc.setQueryData(planningKeys.guests(uid), list)
    void qc.invalidateQueries({ queryKey: ['overview'] })
  }
  return {
    add: useMutation({ mutationFn: weddingsApi.addGuest, onSuccess }),
    addMany: useMutation({ mutationFn: weddingsApi.addGuests, onSuccess }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: Parameters<typeof weddingsApi.updateGuest>[1] }) => weddingsApi.updateGuest(id, patch),
      onSuccess,
      onError: (e) => toast(e.message),
    }),
    remove: useMutation({ mutationFn: weddingsApi.removeGuest, onSuccess, onError: (e) => toast(e.message) }),
  }
}

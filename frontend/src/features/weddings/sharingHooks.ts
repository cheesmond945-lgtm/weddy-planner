import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sharingApi } from '@/api/sharing'
import { weddingsApi } from '@/api/weddings'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { ShareLink } from '@/types/sharing'
import { planningKeys, useWeddingAccess } from './hooks'

const keys = {
  invites: (uid?: string) => ['invites', uid] as const,
  shareLink: (uid?: string) => ['share-link', uid] as const,
}

/** Link mời đang chờ (chỉ owner gọi). */
export function useInvites() {
  const { user } = useAuth()
  const { isOwner } = useWeddingAccess()
  return useQuery({ queryKey: keys.invites(user?.id), queryFn: sharingApi.listInvites, enabled: !!user && isOwner, retry: false })
}

/** Link xem công khai (chỉ owner gọi). */
export function useShareLink(enabled = true) {
  const { user } = useAuth()
  const { isOwner } = useWeddingAccess()
  return useQuery({ queryKey: keys.shareLink(user?.id), queryFn: sharingApi.getShareLink, enabled: !!user && isOwner && enabled, retry: false })
}

export function useSharingMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const onError = (e: Error) => toast(e.message)
  const refreshInvites = () => qc.invalidateQueries({ queryKey: keys.invites(user?.id) })
  const setLink = (link: ShareLink) => qc.setQueryData(keys.shareLink(user?.id), link)
  return {
    createInvite: useMutation({ mutationFn: sharingApi.createInvite, onSuccess: () => void refreshInvites() }),
    revokeInvite: useMutation({ mutationFn: sharingApi.revokeInvite, onSuccess: () => (void refreshInvites(), toast('Đã thu hồi link mời')), onError }),
    putShareLink: useMutation({ mutationFn: sharingApi.putShareLink, onSuccess: setLink, onError }),
    regenerate: useMutation({ mutationFn: sharingApi.regenerateShareLink, onSuccess: (l) => (setLink(l), toast('Đã tạo link mới, link cũ không còn dùng được')), onError }),
  }
}

/** Owner xóa thành viên, hoặc thành viên tự rời. Tự rời thì tải lại toàn bộ (không còn đám cưới). */
export function useRemoveMember() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: weddingsApi.removeMember,
    onSuccess: (_r, userId) => {
      if (userId === user?.id) void qc.invalidateQueries()
      else void qc.invalidateQueries({ queryKey: planningKeys.members(user?.id) })
    },
    onError: (e) => toast(e.message),
  })
}

/** Chép link vào bộ nhớ tạm. */
export function copyLink(url: string) {
  return navigator.clipboard?.writeText(url).then(
    () => toast('Đã sao chép link'),
    () => toast(url, 8000),
  )
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { sharingApi } from '@/api/sharing'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { ShareLink } from '@/types/sharing'

const keys = {
  shareLink: (uid?: string) => ['share-link', uid] as const,
}

/** Link xem công khai của đám cưới mình. */
export function useShareLink(enabled = true) {
  const { user } = useAuth()
  return useQuery({ queryKey: keys.shareLink(user?.id), queryFn: sharingApi.getShareLink, enabled: !!user && enabled, retry: false })
}

export function useSharingMutations() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const onError = (e: Error) => toast(e.message)
  const setLink = (link: ShareLink) => qc.setQueryData(keys.shareLink(user?.id), link)
  return {
    putShareLink: useMutation({ mutationFn: sharingApi.putShareLink, onSuccess: setLink, onError }),
    regenerate: useMutation({ mutationFn: sharingApi.regenerateShareLink, onSuccess: (l) => (setLink(l), toast('Đã tạo link mới, link cũ không còn dùng được')), onError }),
  }
}

/** Chép link vào bộ nhớ tạm. */
export function copyLink(url: string) {
  return navigator.clipboard?.writeText(url).then(
    () => toast('Đã sao chép link'),
    () => toast(url, 8000),
  )
}

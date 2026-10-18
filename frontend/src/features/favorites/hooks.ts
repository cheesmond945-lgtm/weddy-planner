import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { favoritesApi } from '@/api/favorites'
import { toast } from '@/components/ui/toast'
import { useAuth } from '@/store/auth'
import type { ServiceSummary } from '@/types/catalog'
import { compareStore } from '../compare/store'

const favoritesKey = (userId: string | undefined) => ['favorites', userId] as const

/** Dịch vụ yêu thích của cặp đôi đang đăng nhập. Chưa đăng nhập thì danh sách rỗng. */
export function useFavorites() {
  const { user } = useAuth()
  const enabled = user?.role === 'COUPLE'
  const query = useQuery({ queryKey: favoritesKey(user?.id), queryFn: favoritesApi.list, enabled })
  const favorites = enabled ? (query.data ?? []) : []
  return { ...query, favorites, isFavorite: (id: string) => favorites.some((s) => s.id === id) }
}

/** Thả/bỏ tim (3.1). Cập nhật giao diện ngay, lỗi thì trả lại như cũ. */
export function useToggleFavorite() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const key = favoritesKey(user?.id)

  return useMutation({
    mutationFn: ({ service, favorite }: { service: ServiceSummary; favorite: boolean }) =>
      favorite ? favoritesApi.add(service.id) : favoritesApi.remove(service.id),
    onMutate: async ({ service, favorite }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<ServiceSummary[]>(key)
      qc.setQueryData<ServiceSummary[]>(key, (list = []) =>
        favorite ? (list.some((s) => s.id === service.id) ? list : [...list, service]) : list.filter((s) => s.id !== service.id),
      )
      if (!favorite) compareStore.remove(service.id)
      toast(favorite ? 'Đã thêm vào yêu thích' : 'Đã bỏ khỏi yêu thích')
      return { previous }
    },
    onError: (err, _vars, ctx) => {
      qc.setQueryData(key, ctx?.previous)
      toast(err.message)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })
}

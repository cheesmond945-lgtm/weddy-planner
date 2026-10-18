import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/catalog'
import type { ServiceListQuery } from '@/types/catalog'

const PAGE_SIZE = 24

export const catalogKeys = {
  categories: ['catalog', 'categories'] as const,
  locations: ['catalog', 'locations'] as const,
  services: (q: ServiceListQuery) => ['catalog', 'services', q] as const,
  service: (id: string) => ['catalog', 'service', id] as const,
}

export function useCategories() {
  return useQuery({ queryKey: catalogKeys.categories, queryFn: catalogApi.listCategories, staleTime: 5 * 60_000 })
}

export function useLocations() {
  return useQuery({ queryKey: catalogKeys.locations, queryFn: catalogApi.listLocations, staleTime: 5 * 60_000 })
}

/** Danh sách dịch vụ có phân trang; bấm "Xem thêm" để tải trang tiếp. */
export function useServices(query: ServiceListQuery) {
  return useInfiniteQuery({
    queryKey: catalogKeys.services(query),
    queryFn: ({ pageParam }) => catalogApi.listServices({ ...query, page: pageParam, pageSize: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
  })
}

export function useService(id: string) {
  return useQuery({ queryKey: catalogKeys.service(id), queryFn: () => catalogApi.getService(id), enabled: !!id })
}

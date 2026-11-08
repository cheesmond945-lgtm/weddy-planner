import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { catalogApi } from '@/api/catalog'
import { reviewsApi } from '@/api/reviews'
import type { ServiceListQuery } from '@/types/catalog'

const PAGE_SIZE = 24

export const catalogKeys = {
  categories: ['catalog', 'categories'] as const,
  locations: ['catalog', 'locations'] as const,
  areas: ['catalog', 'areas'] as const,
  services: (q: ServiceListQuery) => ['catalog', 'services', q] as const,
  service: (id: string) => ['catalog', 'service', id] as const,
  reviews: (id: string) => ['catalog', 'service', id, 'reviews'] as const,
  reviewSummary: (id: string) => ['catalog', 'service', id, 'review-summary'] as const,
}

/** Id + tên lĩnh vực, truy vấn nhẹ: ô chọn lĩnh vực trong form Admin không phải chờ danh mục NCC */
export function useCategoryOptions() {
  return useQuery({ queryKey: ['catalog', 'category-options'], queryFn: catalogApi.listCategoryOptions, staleTime: 10 * 60_000 })
}

/** Chi phí thấp nhất từng hạng mục theo số khách, dạng { slug: chi phí }; chưa có số khách thì vẫn tính (1 bàn) */
export function useCategoryMinCosts(guests: number) {
  return useQuery({
    queryKey: ['category-min-costs', guests],
    queryFn: () => catalogApi.categoryMinCosts(guests),
    select: (rows) => Object.fromEntries(rows.map((r) => [r.slug, r.minCost])) as Record<string, number>,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  })
}

export function useCategories() {
  return useQuery({ queryKey: catalogKeys.categories, queryFn: catalogApi.listCategories, staleTime: 5 * 60_000 })
}

/** Khu vực lọc dịch vụ, dùng chung cho thanh tìm kiếm và ô nơi tổ chức của đám cưới */
export function useAreas() {
  return useQuery({ queryKey: catalogKeys.areas, queryFn: catalogApi.listAreas, staleTime: 5 * 60_000 })
}

export function useLocations() {
  return useQuery({ queryKey: catalogKeys.locations, queryFn: catalogApi.listLocations, staleTime: 5 * 60_000 })
}

/** Danh sách dịch vụ có phân trang; bấm "Xem thêm" để tải trang tiếp. */
export function useServices(query: ServiceListQuery, enabled = true) {
  return useInfiniteQuery({
    queryKey: catalogKeys.services(query),
    queryFn: ({ pageParam, signal }) => catalogApi.listServices({ ...query, page: pageParam, pageSize: PAGE_SIZE }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/**
 * Tìm kiếm theo câu gõ (chạy khi bấm Enter / Tìm kiếm, vì q chỉ đổi khi đó). Gõ tìm lần mới thì React Query hủy yêu cầu cũ (signal),
 * chỉ dùng kết quả lần cuối. ai = true: lần gọi thứ hai sau khi nhận NEEDS_AI.
 */
export function useServiceSearch(query: ServiceListQuery, ai: boolean, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ['catalog', 'search', query, ai],
    queryFn: ({ pageParam, signal }) => catalogApi.searchServices({ ...query, page: pageParam, pageSize: PAGE_SIZE, ai }, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    // Lưới thẻ dùng chung với danh sách thường (pages[].data)
    select: (d) => ({ ...d, pages: d.pages.map((p) => ({ ...p, data: p.items })) }),
    enabled,
    staleTime: 60_000,
    retry: false,
  })
}

export function useService(id: string) {
  return useQuery({ queryKey: catalogKeys.service(id), queryFn: () => catalogApi.getService(id), enabled: !!id })
}

/** Đánh giá của khách trên web cho một dịch vụ, mỗi lần 5 đánh giá; bấm "Xem thêm" để tải tiếp. */
export function useServiceReviews(serviceId: string) {
  return useInfiniteQuery({
    queryKey: catalogKeys.reviews(serviceId),
    queryFn: ({ pageParam }) => reviewsApi.list(serviceId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
    enabled: !!serviceId,
  })
}

/** Điểm trung bình và số lượt đánh giá trên web của một dịch vụ. */
export function useReviewSummary(serviceId: string) {
  return useQuery({ queryKey: catalogKeys.reviewSummary(serviceId), queryFn: () => reviewsApi.summary(serviceId), enabled: !!serviceId, staleTime: 60_000 })
}

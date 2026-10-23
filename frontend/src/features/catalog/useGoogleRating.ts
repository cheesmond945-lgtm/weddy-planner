import { useQueries, useQuery } from '@tanstack/react-query'
import { getGoogleRating } from '@/api/googleRating'
import type { GoogleRatingMode } from '@/types/googleRating'

/*
 * Dữ liệu Google chỉ giữ trong cache bộ nhớ của React Query (không persist), theo điều khoản
 * Google Maps Platform. Không ghi ra localStorage/sessionStorage/IndexedDB.
 */
const STALE_MS = 5 * 60_000

export const googleRatingKey = (vendorId: string, mode: GoogleRatingMode) => ['google-rating', vendorId, mode] as const

const options = (vendorId: string, mode: GoogleRatingMode, enabled = true) => ({
  queryKey: googleRatingKey(vendorId, mode),
  queryFn: () => getGoogleRating(vendorId, mode),
  enabled: enabled && !!vendorId,
  staleTime: STALE_MS,
  gcTime: STALE_MS,
  // Thử lại 1 lần với lỗi tạm thời (502, mạng); 404 (chưa có PlaceId) và 429 (vượt hạn mức) thì không
  retry: (failureCount: number, error: Error) => {
    const status = (error as { status?: number }).status ?? 0
    return failureCount < 1 && !(status >= 400 && status < 500)
  },
  refetchOnWindowFocus: false,
})

/** Điểm Google của một nhà cung cấp. summary: chỉ điểm + số đánh giá; reviews: kèm tối đa 5 đánh giá. */
export function useGoogleRating(vendorId: string, mode: GoogleRatingMode, opts: { enabled?: boolean } = {}) {
  return useQuery(options(vendorId, mode, opts.enabled ?? true))
}

/** Điểm Google của nhiều nhà cung cấp cùng lúc (bảng so sánh). */
export function useGoogleRatings(vendorIds: string[], mode: GoogleRatingMode) {
  return useQueries({ queries: vendorIds.map((id) => options(id, mode)) })
}

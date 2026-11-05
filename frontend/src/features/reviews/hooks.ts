import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reviewsApi, type ReviewInput } from '@/api/reviews'
import { toast } from '@/components/ui/toast'

export const reviewKeys = {
  order: (orderId: string) => ['reviews', 'order', orderId] as const,
  vendorOrder: (orderId: string) => ['reviews', 'vendor-order', orderId] as const,
}

/** Khách: các dòng của đơn kèm đánh giá (chỉ hỏi với đơn Hoàn thành) */
export function useOrderReviews(orderId: string, enabled = true) {
  return useQuery({ queryKey: reviewKeys.order(orderId), queryFn: () => reviewsApi.itemsOfOrder(orderId), enabled: enabled && !!orderId, staleTime: 30_000 })
}

/** Khách: lưu đánh giá của nhiều dòng (dòng chưa có thì viết mới, có rồi thì sửa); xong thì tải lại đánh giá của đơn và của trang dịch vụ */
export function useSaveReviews(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rows: { orderItemId: string; existing: boolean; body: ReviewInput }[]) =>
      Promise.all(rows.map((r) => (r.existing ? reviewsApi.update(r.orderItemId, r.body) : reviewsApi.create(r.orderItemId, r.body)))),
    onSuccess: () => {
      toast('Cảm ơn bạn đã chia sẻ cảm nhận!')
      void qc.invalidateQueries({ queryKey: reviewKeys.order(orderId) })
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'catalog' && (q.queryKey[3] === 'reviews' || q.queryKey[3] === 'review-summary') })
    },
    onError: (e) => toast(e.message),
  })
}

/** NCC: đánh giá của khách theo đơn */
export function useVendorOrderReviews(orderId: string, enabled = true) {
  return useQuery({ queryKey: reviewKeys.vendorOrder(orderId), queryFn: () => reviewsApi.vendorItemsOfOrder(orderId), enabled: enabled && !!orderId })
}

/** NCC phản hồi một lần */
export function useReplyReview(orderId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reviewId, content }: { reviewId: string; content: string }) => reviewsApi.reply(reviewId, content),
    onSuccess: () => {
      toast('Đã gửi phản hồi')
      void qc.invalidateQueries({ queryKey: reviewKeys.vendorOrder(orderId) })
    },
    onError: (e) => toast(e.message),
  })
}

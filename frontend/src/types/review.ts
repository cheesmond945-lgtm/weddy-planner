/** Đánh giá của khách trên web (bảng reviews, theo dòng đơn đã hoàn thành). Hợp đồng: docs/api/reviews.md */
export interface ServiceReview {
  id: string
  /** 1 đến 5 sao */
  rating: number
  content: string
  /** ISO */
  createdAt: string
  /** Gói dịch vụ được đánh giá */
  packageName: string | null
  customerName: string
}

/** Điểm trung bình (1 chữ số) và số lượt đánh giá; chưa có đánh giá thì average = null */
export interface ReviewSummary {
  count: number
  average: number | null
}

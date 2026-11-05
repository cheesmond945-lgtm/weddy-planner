/** Đánh giá của khách trên web (bảng reviews, theo dòng đơn đã hoàn thành). Hợp đồng: docs/api/reviews.md */
export interface ServiceReview {
  id: string
  /** 1 đến 5 sao */
  rating: number
  content: string
  /** Thẻ gợi ý nhanh khách chọn (REVIEW_TAGS) */
  tags: string[]
  /** ISO */
  createdAt: string
  /** Gói dịch vụ được đánh giá */
  packageName: string | null
  /** Tên rút gọn để giữ riêng tư ("Trang L.") */
  customerName: string
  /** Phản hồi một lần của nhà cung cấp */
  vendorReply: VendorReply | null
}

export interface VendorReply {
  content: string
  /** ISO */
  repliedAt: string
}

/** Đánh giá của chính khách (khi viết / sửa) */
export interface OwnReview {
  id: string
  orderItemId: string
  rating: number
  content: string
  tags: string[]
  createdAt: string
  vendorReply: VendorReply | null
  /** Còn sửa được (30 ngày kể từ lúc viết) */
  canEdit: boolean
  editableUntil: string | null
}

/** Một dòng của đơn trong form đánh giá: GET /orders/:orderId/reviews */
export interface OrderReviewItem {
  orderItemId: string
  name: string
  /** Dòng gắn gói (form ưu tiên các dòng này) */
  isPackage: boolean
  review: OwnReview | null
  canReview: boolean
}

/** Đánh giá của khách theo đơn, phía NCC: GET /vendors/me/orders/:orderId/reviews */
export interface VendorOrderReview {
  orderItemId: string
  name: string
  review: OwnReview
}

/** Điểm trung bình (1 chữ số) và số lượt đánh giá; chưa có đánh giá thì average = null */
export interface ReviewSummary {
  count: number
  average: number | null
}

/** Thẻ gợi ý nhanh khi đánh giá, khớp backend (review-rules.ts) */
export const REVIEW_TAGS = ['Đúng giờ', 'Đúng như cam kết', 'Tư vấn nhiệt tình', 'Giá hợp lý', 'Sẽ giới thiệu bạn bè'] as const

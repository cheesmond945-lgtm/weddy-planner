/*
 * Đơn dịch vụ theo prototype NCC (dòng báo giá, đợt thanh toán, phiên bản, điều chỉnh).
 * Hợp đồng: docs/api/orders.md (phần Nhà cung cấp). Dùng cho Tin nhắn và Quản lý đơn hàng phía NCC.
 * CHỜ ĐỐI CHIẾU docs/database.md và docs/state-diagrams.md: tên trường, enum đang suy từ prototype NCC.
 *
 * Kiểu Order cũ ở types/order.ts (phía cặp đôi: một trạng thái gộp SENT/REVISION_REQUESTED/PAID) giữ nguyên;
 * cách ánh xạ sang kiểu này ghi trong docs/api/orders.md để phía cặp đôi chuyển dần.
 */
import type { VendorFile } from './vendor'

/** Trạng thái đơn (tách riêng trạng thái thanh toán). Nhãn ở features/serviceOrders/constants.ts. */
export const ORDER_STATUSES = ['DRAFT', 'AWAITING_CONFIRMATION', 'REVISION_REQUESTED', 'CONFIRMED', 'CANCELLED'] as const
export type ServiceOrderStatus = (typeof ORDER_STATUSES)[number]

/** Trạng thái thanh toán, BE tính từ các khoản đã thu và đợt đặt cọc. */
export const PAYMENT_STATUSES = ['UNPAID', 'AWAITING_DEPOSIT', 'DEPOSIT_PAID', 'PARTIALLY_PAID', 'PAID', 'OVERPAID'] as const
export type OrderPaymentStatus = (typeof PAYMENT_STATUSES)[number]

/**
 * Phương thức của một đợt. Đợt 1 (đặt cọc) khách trả qua VietQR (docs/api/payments.md);
 * các đợt sau trả ngoài hệ thống bằng chuyển khoản hoặc tiền mặt, NCC tự ghi nhận.
 */
export const PAYMENT_METHODS = ['VIETQR', 'BANK_TRANSFER', 'CASH'] as const
export type OrderPaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Một dòng báo giá. */
export interface OrderLine {
  id: string
  /** Gói đã đăng được dùng để điền nhanh (nếu có) */
  packageId: string | null
  name: string
  /** Đơn vị tính: Bàn, Gói, Buổi… */
  unit: string
  quantity: number
  /** Đơn giá, đồng */
  unitPrice: number
  /** Phí theo chính sách đã thỏa thuận (thêm khi điều chỉnh) */
  isPolicyFee: boolean
}

/** Một đợt trong lịch thanh toán (yêu cầu thanh toán, chưa phải tiền đã thu). Đợt đầu là đặt cọc. */
export interface OrderInstallment {
  id: string
  name: string
  /**
   * Tỷ lệ trên tổng đơn, số nguyên phần trăm; null khi nhập số tiền trực tiếp.
   * Khi mọi đợt có tỷ lệ và cộng đủ 100%, đợt cuối nhận phần tiền lẻ còn lại.
   */
  rate: number | null
  amount: number
  /** Hạn thanh toán "YYYY-MM-DD" */
  dueDate: string
  method: OrderPaymentMethod
  note: string | null
}

/** Nội dung một phiên bản đơn (cũng là nội dung bản nháp, phương án điều chỉnh). */
export interface OrderContent {
  customerName: string
  customerPhone: string
  /** Ngày diễn ra sự kiện "YYYY-MM-DD" */
  eventDate: string
  /** Ghi chú gửi khách, khách nhìn thấy */
  note: string | null
  lines: OrderLine[]
  installments: OrderInstallment[]
}

export interface OrderVersion {
  version: number
  sentAt: string
  content: OrderContent
  /** Danh sách thay đổi so với phiên bản trước (BE tính khi gửi lại) */
  changes: string[]
  /** Phiên bản sinh ra khi khách đồng ý phương án điều chỉnh */
  fromAdjustmentId: string | null
}

/** Bản nháp của NCC, khách không nhìn thấy. NEW: đơn chưa gửi lần nào; EDIT: bản sửa của đơn đã gửi. */
export interface OrderDraft {
  kind: 'NEW' | 'EDIT'
  /** EDIT: phiên bản đang sửa dựa trên */
  baseVersion: number | null
  content: OrderContent
  savedAt: string
}

export interface OrderRevisionRequest {
  /** Phiên bản khách yêu cầu sửa */
  version: number
  note: string
  requestedAt: string
}

/** Khoản đã thu thực tế. Cọc qua VietQR do hệ thống ghi nhận; khoản khác NCC tự ghi nhận. */
export interface OrderPayment {
  id: string
  installmentId: string
  installmentName: string
  amount: number
  paidAt: string
  method: OrderPaymentMethod
  /** Phương thức dự kiến theo lịch (khi khác phương thức thực tế) */
  plannedMethod: OrderPaymentMethod
  recordedBy: 'SYSTEM' | 'VENDOR'
  /** Ảnh hoặc PDF minh chứng (NCC ghi nhận) */
  proofFile: VendorFile | null
  note: string | null
}

export const ADJUSTMENT_STATUSES = ['AWAITING_CONFIRMATION', 'REVISION_REQUESTED', 'ACCEPTED', 'SUPERSEDED'] as const
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number]

/** Phương án điều chỉnh đơn đã xác nhận: đơn hiện hành giữ nguyên tới khi khách đồng ý. */
export interface OrderAdjustment {
  id: string
  status: AdjustmentStatus
  reason: string
  proposedAt: string
  before: OrderContent
  after: OrderContent
  beforeTotal: number
  afterTotal: number
  /** Số đã thu lúc lập phương án (giữ nguyên) */
  paidAmount: number
  /** Khách yêu cầu sửa phương án */
  customerNote: string | null
  customerNoteAt: string | null
  /** Phiên bản đơn có hiệu lực khi khách đồng ý */
  resultVersion: number | null
  /** Phương án này sửa lại từ phương án nào */
  revisionOf: string | null
  /** Yêu cầu điều chỉnh của khách mà phương án này đáp ứng */
  forRequest: { note: string; requestedAt: string } | null
}

export interface OrderHistoryEntry {
  at: string
  text: string
}

export interface ServiceOrder {
  id: string
  /** Mã hiển thị, ví dụ "#WP1029" */
  code: string
  conversationId: string
  status: ServiceOrderStatus
  paymentStatus: OrderPaymentStatus
  /** Rỗng khi là bản nháp chưa gửi lần nào */
  versions: OrderVersion[]
  draft: OrderDraft | null
  revisionRequest: OrderRevisionRequest | null
  /** Khách đề nghị điều chỉnh đơn đã xác nhận, NCC chưa lập phương án */
  adjustmentRequest: { note: string; requestedAt: string } | null
  payments: OrderPayment[]
  adjustments: OrderAdjustment[]
  /** Tổng phiên bản hiện hành (hoặc bản nháp), đồng */
  totalAmount: number
  /** Tổng đã thu thực tế, đồng */
  paidAmount: number
  history: OrderHistoryEntry[]
  /** Khi CANCELLED */
  cancellation: { reason: string; cancelledAt: string } | null
  createdAt: string
  updatedAt: string
}

export interface OrderListQuery {
  q?: string
  status?: ServiceOrderStatus
  paymentStatus?: OrderPaymentStatus
  /** Ngày sự kiện từ / đến "YYYY-MM-DD" (gồm cả hai đầu) */
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

/** Body của POST /vendors/me/orders/:id/payments. */
export interface RecordPaymentBody {
  installmentId: string
  amount: number
  /** ISO thời điểm nhận */
  paidAt: string
  method: OrderPaymentMethod
  proofFile: VendorFile | null
  note: string | null
}

/** Body của POST /vendors/me/orders/:id/adjustments. */
export interface ProposeAdjustmentBody {
  reason: string
  after: OrderContent
  /** Sửa lại phương án khách yêu cầu sửa */
  revisionOf: string | null
}

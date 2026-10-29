/*
 * Đơn dịch vụ phía NCC, đúng theo docs/database.md (Orders, OrderItems, OrderRevisions, OrderRevisionChanges,
 * Payments, Invoices) và hợp đồng docs/api/orders.md (phần NCC). Tên trường, giá trị enum viết đúng như CSDL.
 *
 * Thay mô hình cũ (phiên bản v1/v2, đợt thanh toán tùy chỉnh, phương án điều chỉnh) đã bỏ.
 * Kiểu Order phía cặp đôi ở types/order.ts giữ nguyên.
 */
import type { CategoryRef } from './catalog'

/** Trạng thái đơn (Orders.Status). Nhãn và màu ở features/vendorOrders/constants.ts. */
export const ORDER_STATUSES = ['Draft', 'Pending', 'NeedRevision', 'Deposited', 'Completed', 'Expired', 'Cancelled'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Đơn vị tính (OrderItems.Unit): Gói (số lượng mặc định 1), Bàn (số lượng tùy chỉnh). */
export const ORDER_UNITS = ['Gói', 'Bàn'] as const
export type OrderUnit = (typeof ORDER_UNITS)[number]

/** Một hạng mục báo giá (OrderItems). `amount` = quantity × unitPrice, backend tính. */
export interface OrderItem {
  id: string
  itemName: string
  unit: OrderUnit
  quantity: number
  unitPrice: number
  amount: number
}

/** Thanh toán đặt cọc qua VNPay (Payments), mỗi đơn một dòng, tạo lúc gửi đơn. */
export interface OrderPayment {
  status: 'Unpaid' | 'Paid'
  paidDate: string | null
  transactionCode: string | null
}

/** Lý do NCC hủy đơn đã cọc (Orders.CancelReason): khách mất cọc, hoặc NCC hoàn cọc ngoài hệ thống. */
export const CANCEL_REASONS = ['CUSTOMER_REQUEST', 'VENDOR_UNABLE'] as const
export type CancelReason = (typeof CANCEL_REASONS)[number]

export const REVISION_CHANGE_TYPES = ['Item', 'Quantity', 'EventDate', 'Other'] as const
/** Nội dung khách muốn đổi (OrderRevisionChanges.ChangeType). Danh sách đầy đủ chưa chốt (CSDL mục 15). */
export type RevisionChangeType = (typeof REVISION_CHANGE_TYPES)[number]

/** Lịch sử yêu cầu và lần chỉnh sửa của đơn (OrderRevisions). */
export interface OrderRevision {
  id: string
  revisionType: 'BeforeDeposit' | 'AfterDeposit'
  /**
   * BeforeDeposit: lời nhắn của khách (null khi NCC tự sửa). AfterDeposit: yêu cầu của khách (Requested/Rejected),
   * hoặc "Nội dung thay đổi" do NCC ghi khi chỉnh sửa (Applied), khách thấy
   */
  requestNote: string | null
  changes: RevisionChangeType[]
  oldTotalAmount: number
  /** null khi chưa áp dụng */
  newTotalAmount: number | null
  /**
   * Requested: khách yêu cầu, chờ NCC (trước cọc: đơn NeedRevision; sau cọc: đơn vẫn Deposited). Applied: NCC đã sửa.
   * Rejected: NCC từ chối yêu cầu sau cọc, đơn giữ nguyên.
   */
  status: 'Requested' | 'Applied' | 'Rejected'
  createdDate: string
  appliedDate: string | null
}

export type InvoiceType = 'DepositReceipt' | 'FinalInvoice'

/** Giấy xác nhận cọc hoặc hóa đơn cuối (Invoices), mỗi loại tối đa một cho mỗi đơn. */
export interface Invoice {
  id: string
  invoiceCode: string
  type: InvoiceType
  createdDate: string
}

/** Đơn dịch vụ (Orders) kèm hạng mục, thanh toán cọc, lịch sử chỉnh sửa, chứng từ. */
export interface Order {
  id: string
  /** Mã hiển thị, ví dụ "DH26100004", không đổi dù sửa nhiều lần */
  orderCode: string
  conversationId: string
  /** Chỉ BE trả (phía khách): id hồ sơ NCC để mở trang dịch vụ, và tên NCC hiện trên thẻ đơn */
  serviceId?: string
  vendorName?: string
  /** Lĩnh vực của NCC (trang Kế hoạch của khách hiện đơn dưới hạng mục này) */
  category?: CategoryRef
  status: OrderStatus
  customerName: string
  customerPhone: string
  /** Ngày diễn ra sự kiện "YYYY-MM-DD" */
  eventDate: string
  items: OrderItem[]
  totalAmount: number
  /** Tỷ lệ cọc (%), lớn hơn 0 và nhỏ hơn 100 */
  depositPercent: number
  /** Tiền cọc, backend tính, làm tròn đến 100.000đ */
  depositAmount: number
  /** Hạn cọc (ISO), 1 ngày sau lúc gửi đơn; null khi Draft */
  depositDueDate: string | null
  /** Ghi chú gửi khách */
  note: string | null
  /** null khi Draft */
  payment: OrderPayment | null
  /** Mới nhất trước */
  revisions: OrderRevision[]
  invoices: Invoice[]
  completedDate: string | null
  /** NCC hủy đơn đã cọc (trước ngày sự kiện): ngày hủy và lý do (ghi chú khi hủy chỉ nằm trong tin hệ thống, không lưu) */
  cancelledDate: string | null
  cancelReason: CancelReason | null
  createdDate: string
}

/** Một hạng mục NCC nhập (số tiền do backend tính). */
export interface OrderItemInput {
  itemName: string
  unit: OrderUnit
  quantity: number
  unitPrice: number
}

/** Nội dung đơn NCC nhập (body tạo, lưu nháp, gửi, sửa). Không có totalAmount, depositAmount. */
export interface OrderContent {
  customerName: string
  customerPhone: string
  eventDate: string
  note: string | null
  depositPercent: number
  items: OrderItemInput[]
}

export interface OrderListQuery {
  q?: string
  status?: OrderStatus
  /** Ngày sự kiện từ / đến "YYYY-MM-DD" (gồm cả hai đầu) */
  from?: string
  to?: string
  conversationId?: string
  /** Ngày cọc (Payments.PaidDate, giờ VN) từ / đến "YYYY-MM-DD", gồm cả hai đầu: đơn đã cọc trong khoảng này, mọi trạng thái */
  depositFrom?: string
  depositTo?: string
  page?: number
  pageSize?: number
}

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
  /** Sảnh (gói) của đơn, Trung tâm tổ chức sự kiện (docs/LICH_BAN_SANH.md); null với dịch vụ khác và đơn cũ */
  package?: { id: string; name: string } | null
  status: OrderStatus
  customerName: string
  customerPhone: string
  /** Ngày diễn ra sự kiện "YYYY-MM-DD" */
  eventDate: string
  /** Ngày cưới của khách "YYYY-MM-DD" (chỉ BE thật trả): ngày thực hiện không được sau ngày này */
  weddingDate?: string | null
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
  /** Sảnh (gói) của đơn: bắt buộc khi Trung tâm tổ chức sự kiện gửi / sửa đơn; dịch vụ khác để null */
  packageId: string | null
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

/** Ai làm việc chi tiết của đơn (docs/TIMELINE.md mục 8): khách, NCC hoặc cả hai. */
export type TaskOwner = 'CUSTOMER' | 'VENDOR' | 'BOTH'

/** Một việc trong "Tiến độ đơn" (GET /vendors/me/orders/:id/tasks). */
export interface OrderTask {
  id: string
  title: string
  /** "YYYY-MM-DD" */
  dueDate: string
  isDone: boolean
  completedDate: string | null
  owner: TaskOwner
  /** NCC được tick việc này (VENDOR, BOTH) */
  canTick: boolean
  overdue: boolean
}

/** Tóm tắt tiến độ một đơn. overdueVendor: việc của NCC (hoặc hai bên) chưa xong và quá hạn = "Trễ tiến độ". */
export interface OrderProgress {
  /** Tổng số việc của đơn và số đã xong (thanh tiến độ) */
  total: number
  done: number
  /** Việc chưa xong gần hạn nhất của NCC (NCC làm hoặc hai bên); null khi NCC không còn việc nào */
  next: { due: string; title: string } | null
  open: number
  overdueVendor: number
  overdueCustomer: number
  dueSoonVendor: number
}

export interface OrderTasks {
  items: OrderTask[]
  progress: OrderProgress
}

/** Một việc trên Bảng việc (GET /vendors/me/orders/tasks): việc của đơn đang thực hiện kèm thông tin đơn để gom theo khách / đơn. */
export interface BoardTask extends OrderTask {
  orderId: string
  orderCode: string
  customerName: string
  /** "YYYY-MM-DD" ngày thực hiện của đơn */
  eventDate: string
}

/** Một mục trên lịch làm việc của NCC (GET /vendors/me/orders/calendar). */
export type CalendarItem =
  | { kind: 'ORDER'; id: string; orderId: string; orderCode: string; customerName: string; title: string; date: string; status: OrderStatus; isDone: boolean }
  | { kind: 'TASK'; id: string; orderId: string; orderCode: string; customerName: string; title: string; date: string; isDone: boolean; owner: TaskOwner; canTick: boolean; overdue: boolean }

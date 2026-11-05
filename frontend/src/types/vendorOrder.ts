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
  /** Gói dịch vụ của dòng (quy trình của gói sinh việc chi tiết khi cọc); null: không gắn gói */
  packageId?: string | null
  packageName?: string | null
}

/** Đợt 2 (phần còn lại, tiền mặt trả trực tiếp cho NCC): Received khi NCC đã ghi nhận nhận đủ; NotApplicable khi đơn chưa cọc / hết hạn / đã hủy. */
export interface RestPayment {
  /** Tổng − cọc */
  amount: number
  status: 'Pending' | 'Received' | 'NotApplicable'
  /** ISO, khi Received */
  receivedDate: string | null
}

/** Thanh toán đặt cọc qua VietQR (Payments), mỗi đơn một dòng, tạo lúc gửi đơn. */
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
  /** Dấu vân tay nội dung đơn: gửi lại khi lưu để backend chặn lưu đè nếu đơn đã đổi ở nơi khác (409 ORDER_STALE) */
  version?: string
  /** Mã hiển thị, ví dụ "DH26100004", không đổi dù sửa nhiều lần */
  orderCode: string
  conversationId: string
  /** Chỉ BE trả (phía khách): id hồ sơ NCC để mở trang dịch vụ, và tên NCC hiện trên thẻ đơn */
  serviceId?: string
  vendorName?: string
  /** Lĩnh vực của NCC (trang Kế hoạch của khách hiện đơn dưới hạng mục này) */
  category?: CategoryRef
  /** Sảnh (gói) của đơn, Trung tâm tiệc cưới (docs/LICH_BAN_SANH.md); null với dịch vụ khác và đơn cũ */
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
  /** Đợt 2 (tiền mặt): trạng thái ghi nhận của NCC */
  restPayment: RestPayment
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
  /** Số khách của đơn tiệc (sau lần đổi số khách gần nhất); null với đơn cũ / dịch vụ khác */
  guestCount?: number | null
  /** Khách yêu cầu hủy đơn đã cọc, chờ NCC xác nhận; null khi không có */
  cancelRequest?: { requestedDate: string; note: string | null } | null
  /** Yêu cầu đổi số khách, mới nhất trước */
  guestChanges?: GuestChange[]
}

/** Yêu cầu đổi số khách của đơn tiệc đã cọc (docs/api/orders.md) */
export interface GuestChange {
  id: string
  oldGuestCount: number | null
  newGuestCount: number
  oldTables: number
  newTables: number
  oldAmount: number
  newAmount: number
  /** Cọc bổ sung = 10% phần tăng; 0 khi giảm (không hoàn cọc) */
  extraDeposit: number
  /** AwaitingVendor: chờ NCC xác nhận; AwaitingDeposit: chờ nộp cọc bổ sung; Applied: đã áp dụng; Rejected: bị từ chối */
  status: 'AwaitingVendor' | 'AwaitingDeposit' | 'Applied' | 'Rejected'
  note: string | null
  createdDate: string
  appliedDate: string | null
}

/** Xem trước đổi số khách */
export interface GuestChangeQuote {
  oldTables: number
  newTables: number
  chargedTables: number
  oldAmount: number
  newAmount: number
  extraDeposit: number
  /** Hạn cuối gửi yêu cầu (YYYY-MM-DD) */
  deadline: string
}

/** Một hạng mục NCC nhập (số tiền do backend tính). */
export interface OrderItemInput {
  /** Id dòng hiện có (order_items.id), chỉ khi sửa sau cọc: backend giữ gói của dòng theo id, không theo tên */
  id?: string | null
  itemName: string
  unit: OrderUnit
  quantity: number
  unitPrice: number
  /** Gói dịch vụ của dòng (phải là gói của NCC); bỏ trống thì không gắn gói */
  packageId?: string | null
}

/** Nội dung đơn NCC nhập (body tạo, lưu nháp, gửi, sửa). Không có totalAmount, depositAmount. */
export interface OrderContent {
  customerName: string
  customerPhone: string
  eventDate: string
  note: string | null
  depositPercent: number
  items: OrderItemInput[]
  /** Sảnh (gói) của đơn: bắt buộc khi Trung tâm tiệc cưới gửi / sửa đơn; dịch vụ khác để null */
  packageId: string | null
}

/** Số liệu 4 thẻ đầu trang Quản lý đơn hàng, backend tính trên toàn bộ đơn của NCC (GET /vendors/me/orders/counts → tiles). */
export interface OrderTilesData {
  /** Đơn Chờ cọc, và trong đó số đơn hạn cọc còn dưới 24 giờ */
  pending: number
  expiringSoon: number
  /** Chờ chỉnh sửa + Đã cọc có yêu cầu chỉnh sửa của khách đang chờ */
  needsAction: number
  /** Đã cọc, ngày thực hiện trong 30 ngày tới, và tổng giá trị */
  upcoming: number
  upcomingValue: number
  /** Đã cọc, đã qua ngày thực hiện (NCC bấm được Hoàn tất), và trong đó số đơn chưa nhận tiền mặt */
  dueToComplete: number
  dueRestPending: number
}

/** Số đơn theo từng trạng thái (không theo bộ lọc) kèm số liệu 4 thẻ. */
export type OrderCounts = Record<OrderStatus, number> & { tiles: OrderTilesData }

export interface OrderListQuery {
  q?: string
  /** Một trạng thái, hoặc nhiều trạng thái ngăn bằng dấu phẩy ("Expired,Cancelled") */
  status?: string
  /** Chỉ đơn cần NCC xử lý (Chờ chỉnh sửa, hoặc Đã cọc có yêu cầu chỉnh sửa đang chờ) */
  needsAction?: boolean
  /** Chỉ đơn Đã cọc / Hoàn thành mà đợt 2 (tiền mặt) chưa ghi nhận */
  restPending?: boolean
  /** Ngày sự kiện từ / đến "YYYY-MM-DD" (gồm cả hai đầu) */
  from?: string
  to?: string
  conversationId?: string
  page?: number
  pageSize?: number
}

/** Ai làm việc chi tiết của đơn: khách, NCC hoặc cả hai (chỉ để hiển thị: NCC đổi được trạng thái mọi việc của đơn mình). */
export type TaskOwner = 'CUSTOMER' | 'VENDOR' | 'BOTH'

/** Todo: NCC đang làm; Waiting: chờ khách; Done: xong. */
export type TaskStatus = 'Todo' | 'Waiting' | 'Done'

/** Một việc trong "Tiến độ đơn" (GET /vendors/me/orders/:id/tasks). */
export interface OrderTask {
  id: string
  title: string
  /** "YYYY-MM-DD" */
  dueDate: string
  isDone: boolean
  completedDate: string | null
  owner: TaskOwner
  status: TaskStatus
  /** NCC đổi được trạng thái việc này (luôn true với mọi việc của đơn mình) */
  canTick: boolean
  overdue: boolean
  /** Việc lấy từ gói của NCC */
  isPackageTask: boolean
  /** Việc của gói có mốc trước ngày thực hiện: ngày chốt / đổi phải trước ngày thực hiện (không chọn trùng hoặc sau) */
  beforeEvent?: boolean
  /** Việc RIÊNG của đơn do NCC thêm ('ORD:'), không thuộc gói */
  isCustomOrderTask: boolean
  /** Việc "Thanh toán phần còn lại": sang Done = ghi nhận đã nhận đủ tiền mặt (có hộp xác nhận) */
  isRestPayment: boolean
  /** Ngày dự kiến (PLANNED) hay đã chốt với khách (CONFIRMED) */
  dateStatus: 'PLANNED' | 'CONFIRMED'
  confirmedAt: string | null
  /** Đã chốt trước ngày thực hiện nhưng ngày chốt nằm sau ngày thực hiện hiện tại: cần chốt lại với khách */
  needsRecheck: boolean
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

/** Kết quả đổi trạng thái / chốt / đổi ngày: đúng việc vừa cập nhật (không trả cả danh sách). */
export interface TaskItemResult {
  item: OrderTask
}

/** Việc riêng của đơn vừa thêm; addedToPackage: đã thêm luôn vào quy trình của gói (chỉ áp cho đơn sau). */
export interface AddTaskResult extends TaskItemResult {
  addedToPackage: boolean
}

/** Nội dung thêm việc riêng cho đơn (POST /vendors/me/orders/:id/tasks). */
export interface NewOrderTaskInput {
  title: string
  note: string | null
  owner: TaskOwner
  /** "YYYY-MM-DD", từ hôm nay đến ngày thực hiện + 120; việc được chốt ngày luôn */
  date: string
  addToPackage: boolean
}

/** Kết quả ghi nhận / bỏ ghi nhận tiền mặt đợt 2: đợt 2 của đơn và id việc "Thanh toán phần còn lại". */
export interface RestResult {
  restPayment: RestPayment
  taskId: string | null
}

export interface OrderTasks {
  items: OrderTask[]
  progress: OrderProgress
  /** Ngày thực hiện của đơn "YYYY-MM-DD" (giới hạn trên của ô đổi ngày = ngày này + 120) */
  eventDate?: string
  /** Số tiền đợt 2 của đơn (tổng − cọc), để hỏi xác nhận đã nhận tiền mặt */
  restAmount?: number
  /** Đơn có gói dịch vụ (hiện checkbox "Thêm vào quy trình của gói" khi thêm việc) */
  hasPackage?: boolean
}

/** Một việc trên Bảng việc (GET /vendors/me/orders/tasks): việc của đơn đang thực hiện kèm thông tin đơn để gom theo khách / đơn. */
export interface BoardTask extends OrderTask {
  orderId: string
  orderCode: string
  customerName: string
  /** "YYYY-MM-DD" ngày thực hiện của đơn */
  eventDate: string
  /** Tên gói của NCC gắn với đơn (sảnh và gói của các dòng) */
  packageNames: string[]
  /** Số tiền đợt 2 của đơn (tổng − cọc) */
  restAmount: number
}

/** Một mục trên lịch làm việc của NCC (GET /vendors/me/orders/calendar). */
export type CalendarItem =
  | { kind: 'ORDER'; id: string; orderId: string; orderCode: string; customerName: string; title: string; date: string; status: OrderStatus; isDone: boolean }
  | { kind: 'TASK'; id: string; orderId: string; orderCode: string; customerName: string; title: string; date: string; eventDate: string; isRestPayment: boolean; isPackageTask: boolean; isCustomOrderTask: boolean; beforeEvent?: boolean; isDone: boolean; status: TaskStatus; dateStatus: 'PLANNED' | 'CONFIRMED'; owner: TaskOwner; canTick: boolean; overdue: boolean }

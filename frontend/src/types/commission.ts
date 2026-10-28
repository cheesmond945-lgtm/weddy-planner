/*
 * Hoa hồng NCC trả WebPlan theo kỳ tháng. Hợp đồng: docs/api/commissions.md (bản nháp).
 * CHỜ ĐỐI CHIẾU docs/database.md và docs/state-diagrams.md: tên trường, trạng thái đang suy từ prototype NCC
 * (màn Tài chính & đối soát) và các quyết định của nhóm (tỷ lệ theo lĩnh vực, tính theo đơn hoàn thành).
 *
 * Bảng kê do backend tính từ các đơn đã hoàn thành.
 */
import type { CategoryRef } from './catalog'
/** Cách thu của một khoản thanh toán trong đơn */
type OrderPaymentMethod = 'VNPAY' | 'BANK_TRANSFER' | 'CASH'
import type { VendorFile } from './vendor'

/**
 * Trạng thái bảng kê. Nhãn ở features/commissions/constants.ts.
 * OPEN: kỳ hiện tại, chưa chốt (tạm tính). Các trạng thái còn lại: kỳ đã chốt.
 */
export const COMMISSION_STATUSES = ['OPEN', 'UNPAID', 'PARTIALLY_PAID', 'PENDING_CONFIRMATION', 'PAID'] as const
export type CommissionStatus = (typeof COMMISSION_STATUSES)[number]

/** Một khoản thu của đơn được tính trong dòng hoa hồng. */
export interface CommissionPaymentRef {
  paymentId: string
  installmentName: string
  paidAt: string
  method: OrderPaymentMethod
  amount: number
}

/**
 * Một dòng bảng kê.
 * ORDER: đơn hoàn thành (ngày sự kiện trong kỳ), tính trên tổng đã thu tới ngày chốt.
 * SUPPLEMENT: khoản thu sau ngày chốt của một đơn đã tính ở kỳ trước, cộng vào kỳ của tháng thu.
 */
export interface CommissionLine {
  id: string
  kind: 'ORDER' | 'SUPPLEMENT'
  orderId: string
  orderCode: string
  customerName: string
  eventDate: string
  /** Ngày đơn hoàn thành (YYYY-MM-DD, giờ VN): NCC xác nhận thu đủ hoặc hệ thống tự hoàn thành */
  completedDate?: string | null
  category: CategoryRef
  /** Tỷ lệ áp dụng, số nguyên phần trăm (lưu lại để đổi tỷ lệ sau không ảnh hưởng kỳ cũ) */
  rate: number
  /** Số tiền làm căn cứ: tổng các khoản thu của dòng */
  baseAmount: number
  commissionAmount: number
  payments: CommissionPaymentRef[]
  /** SUPPLEMENT: kỳ đã tính đơn này */
  originPeriod: string | null
}

export const COMMISSION_PAYMENT_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED'] as const
export type CommissionPaymentStatus = (typeof COMMISSION_PAYMENT_STATUSES)[number]

/** Một lần NCC gửi minh chứng đã chuyển tiền hoa hồng; Admin xác nhận thì số còn trả mới giảm. */
export interface CommissionPayment {
  id: string
  amount: number
  /** null khi Admin ghi nhận thanh toán (hệ thống không lưu minh chứng NCC gửi) */
  proofFile: VendorFile | null
  /** Ghi chú đối chiếu của NCC (mã giao dịch, ngân hàng…) */
  note: string | null
  submittedAt: string
  status: CommissionPaymentStatus
  reviewedAt: string | null
  /** Ghi chú của Admin khi xác nhận / từ chối */
  reviewNote: string | null
}

/** Thông tin chuyển khoản cho WebPlan (BE cấu hình). */
export interface CommissionTransferInfo {
  accountName: string
  bankName: string
  accountNumber: string
  /** Nội dung chuyển khoản: "<mã bảng kê> — <tên NCC>" */
  content: string
}

/** Tóm tắt bảng kê (danh sách đối soát). */
export interface CommissionStatementSummary {
  id: string
  /** Mã bảng kê, ví dụ "DS092026" */
  code: string
  /** Kỳ "YYYY-MM" */
  period: string
  status: CommissionStatus
  /** Số đơn hoàn thành trong kỳ (không gồm dòng bổ sung) */
  orderCount: number
  supplementCount: number
  /** Tổng khoản thu làm căn cứ */
  baseAmount: number
  commissionAmount: number
  /** Đã được Admin xác nhận */
  paidAmount: number
  /** Đang chờ Admin xác nhận */
  pendingAmount: number
  /** Ngày chốt kỳ "YYYY-MM-DD" (cuối tháng) */
  closingDate: string
  /** Hạn thanh toán "YYYY-MM-DD" (ngày 20 tháng sau) */
  dueDate: string
  /** Đã quá hạn mà còn phải trả */
  isOverdue: boolean
  /** Đã thanh toán sau hạn bao nhiêu ngày; null: chưa trả hoặc trả đúng hạn */
  lateDays: number | null
}

export interface CommissionStatement extends CommissionStatementSummary {
  lines: CommissionLine[]
  payments: CommissionPayment[]
  transfer: CommissionTransferInfo
}

/** Body của POST /vendors/me/commissions/:id/payments. */
export interface SubmitCommissionPaymentBody {
  amount: number
  proofFile: VendorFile
  note: string | null
}

/** Kết quả ghi nhận sau khi quay về từ VNPay. */
export interface CommissionPaymentResult {
  status: 'PAID' | 'FAILED'
  /** Mã bảng kê (DSMMYYYY) khi PAID */
  statementId?: string
  transactionCode?: string | null
  message: string
}

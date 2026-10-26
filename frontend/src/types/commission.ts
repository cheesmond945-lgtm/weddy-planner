/*
 * Hoa hồng NCC trả WebPlan, đúng theo docs/database.md (Commissions, CommissionStatements, mục 9.8) và hợp đồng
 * docs/api/commissions.md. Tên trường như CSDL.
 *
 * Hoa hồng chỉ phát sinh khi đơn Completed. Mỗi NCC mỗi tháng một bảng kê, nộp một lần (VNPay) trước ngày 25 tháng sau.
 * "Đang tạm tính" (kỳ của tháng hiện tại) và "Quá hạn" không lưu trong CSDL, giao diện tính từ ngày hiện tại (features/commissions/calc.ts).
 */

/** CommissionStatements.Status */
export type StatementStatus = 'Unpaid' | 'Paid'

/** Bảng kê hoa hồng của một tháng (CommissionStatements). */
export interface CommissionStatement {
  id: string
  /** Tháng đối soát "YYYY-MM" (CSDL lưu ngày đầu tháng) */
  periodMonth: string
  /** Số đơn Completed trong tháng, cộng dồn */
  totalOrders: number
  /** Tổng hoa hồng phải nộp, cộng dồn */
  totalAmount: number
  /** Hạn nộp "YYYY-MM-DD": ngày 25 tháng sau */
  dueDate: string
  status: StatementStatus
  /** Chỉ có khi đã nộp */
  paidDate: string | null
  /** Mã giao dịch VNPay, chỉ có khi đã nộp */
  transactionCode: string | null
  createdDate: string
}

/** Hoa hồng của một đơn (Commissions) kèm thông tin đơn để hiển thị. */
export interface CommissionLine {
  id: string
  orderId: string
  orderCode: string
  customerName: string
  /** Lúc đơn hoàn thành (ISO) */
  completedDate: string
  /** Giá trị đơn lúc hoàn thành (Commissions.OrderAmount) */
  orderAmount: number
  /** Tỷ lệ áp dụng (%), chụp từ loại dịch vụ lúc đó (Commissions.Rate) */
  rate: number
  /** Commissions.Amount = OrderAmount × Rate / 100 */
  amount: number
}

/** Phản hồi của GET /vendors/me/commissions: tỷ lệ hiện tại của NCC và các bảng kê, mới nhất trước. */
export interface CommissionOverview {
  /** Tỷ lệ hiện hành theo loại dịch vụ của NCC; null khi NCC chưa chọn loại dịch vụ */
  rate: { percent: number; categoryName: string } | null
  statements: CommissionStatement[]
}

/** Kết quả bắt đầu nộp. Dữ liệu thật: trả paymentUrl để chuyển sang VNPay. Dữ liệu giả: nộp xong ngay, trả bảng kê đã Paid. */
export interface PayStatementResult {
  paymentUrl: string | null
  statement: CommissionStatement | null
}

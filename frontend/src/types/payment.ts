/** Thông tin để khách chuyển khoản VietQR (docs/api/payments.md). */
export interface PayInfo {
  /** Ảnh mã QR (img.vietqr.io), đã điền sẵn số tiền và nội dung */
  qrUrl: string
  amount: number
  /** Nội dung chuyển khoản bắt buộc: EVERLY + mã đơn (cọc) hoặc EVHH + mã bảng kê (hoa hồng) */
  content: string
  bankBin: string
  accountNo: string
  accountName: string
  expiresAt: string
}

/** Kết quả kiểm tra với SePay: PENDING = chưa thấy tiền về. */
export interface PayCheckResult {
  status: 'PAID' | 'PENDING' | 'FAILED'
  message: string
}

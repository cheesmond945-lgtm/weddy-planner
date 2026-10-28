import type { CommissionPaymentResult, CommissionStatement, CommissionStatementSummary, SubmitCommissionPaymentBody } from '@/types/commission'
import type { PayInfo } from '@/types/payment'
import { http } from './client'

/**
 * Hoa hồng NCC trả WebPlan. Hợp đồng: docs/api/commissions.md.
 * Tệp minh chứng upload trước qua vendorsApi.uploadFile('PAYMENT_PROOF').
 */
export const commissionsApi = {
  list: (): Promise<CommissionStatementSummary[]> => (http.get('/vendors/me/commissions')),

  get: (id: string): Promise<CommissionStatement> => (http.get(`/vendors/me/commissions/${id}`)),

  /** Mã QR VietQR cho hoa hồng (số tiền lấy từ bảng kê, nội dung EVHH + mã bảng kê) */
  pay: (id: string): Promise<PayInfo> => http.post(`/vendors/me/commissions/${id}/pay`),

  /** Backend hỏi SePay đã nhận đủ hoa hồng chưa và ghi nhận nếu đã nhận */
  check: (id: string): Promise<CommissionPaymentResult> => http.post(`/vendors/me/commissions/${id}/check`),

  submitPayment: (id: string, body: SubmitCommissionPaymentBody): Promise<CommissionStatement> =>
    http.post(`/vendors/me/commissions/${id}/payments`, body),

}

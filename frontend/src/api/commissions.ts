import type { CommissionPaymentResult, CommissionStatement, CommissionStatementSummary, SubmitCommissionPaymentBody } from '@/types/commission'
import { http } from './client'

/**
 * Hoa hồng NCC trả WebPlan. Hợp đồng: docs/api/commissions.md.
 * Tệp minh chứng upload trước qua vendorsApi.uploadFile('PAYMENT_PROOF').
 */
export const commissionsApi = {
  list: (): Promise<CommissionStatementSummary[]> => (http.get('/vendors/me/commissions')),

  get: (id: string): Promise<CommissionStatement> => (http.get(`/vendors/me/commissions/${id}`)),

  /** Bắt đầu thanh toán hoa hồng qua VNPay: trả URL để chuyển trình duyệt tới (cổng VNPay thật, hoặc trang giả lập khi chưa cấu hình). */
  pay: (id: string): Promise<{ mode: 'LIVE' | 'SIMULATE'; paymentUrl: string }> => http.post(`/vendors/me/commissions/${id}/pay`),

  /** Gửi kết quả quay về từ VNPay (các tham số vnp_* trên URL) để backend kiểm tra và ghi nhận. */
  confirmPayment: (params: Record<string, string>): Promise<CommissionPaymentResult> => http.post('/vendors/me/commissions/vnpay/confirm', params),

  /** Thông tin lượt thanh toán cho trang VNPay giả lập. */
  intent: (ref: string): Promise<{ code: string; amount: number; vendorName: string; expiresAt: string }> => http.get(`/vendors/me/commissions/vnpay/intent/${ref}`),

  submitPayment: (id: string, body: SubmitCommissionPaymentBody): Promise<CommissionStatement> =>
    http.post(`/vendors/me/commissions/${id}/payments`, body),

}

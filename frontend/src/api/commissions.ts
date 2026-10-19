import { mockVendorCommissions } from '@/mocks/vendorCommissions'
import { authStore } from '@/store/auth'
import type { CommissionStatement, CommissionStatementSummary, SubmitCommissionPaymentBody } from '@/types/commission'
import { ApiError, http } from './client'
import { USE_MOCK, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 300) => mockDelay(null, ms).then(() => fn(mockUserId()))

/**
 * Hoa hồng NCC trả WebPlan. Hợp đồng: docs/api/commissions.md.
 * Tệp minh chứng upload trước qua vendorsApi.uploadFile('PAYMENT_PROOF').
 */
export const commissionsApi = {
  list: (): Promise<CommissionStatementSummary[]> => (USE_MOCK ? mock((u) => mockVendorCommissions.list(u)) : http.get('/vendors/me/commissions')),

  get: (id: string): Promise<CommissionStatement> => (USE_MOCK ? mock((u) => mockVendorCommissions.get(u, id)) : http.get(`/vendors/me/commissions/${id}`)),

  submitPayment: (id: string, body: SubmitCommissionPaymentBody): Promise<CommissionStatement> =>
    USE_MOCK ? mock((u) => mockVendorCommissions.submitPayment(u, id, body), 500) : http.post(`/vendors/me/commissions/${id}/payments`, body),

  /** CHỈ CÓ KHI VITE_USE_MOCK=true: giả lập Admin xác nhận / từ chối (phía Admin làm sau). */
  simulateReview: (id: string, decision: 'CONFIRMED' | 'REJECTED'): Promise<CommissionStatement> => {
    if (!USE_MOCK) return Promise.reject(new ApiError(400, 'BAD_REQUEST', 'Chỉ dùng được với dữ liệu giả.'))
    return mock((u) => mockVendorCommissions.review(u, id, decision), 400)
  },
}

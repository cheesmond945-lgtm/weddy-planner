import { mockVendorCommissions } from '@/mocks/vendorCommissions'
import { authStore } from '@/store/auth'
import type { CommissionLine, CommissionOverview, PayStatementResult } from '@/types/commission'
import { ApiError, http } from './client'
import { isMock, mockDelay } from './mock'

function mockUserId() {
  const user = authStore.getSession()?.user
  if (!user) throw new ApiError(401, 'UNAUTHORIZED', 'Bạn cần đăng nhập.')
  return user.id
}

const mock = <T>(fn: (userId: string) => T, ms = 300) => mockDelay(null, ms).then(() => fn(mockUserId()))

/** Hoa hồng NCC trả WebPlan. Hợp đồng: docs/api/commissions.md. */
export const commissionsApi = {
  list: (): Promise<CommissionOverview> => (isMock('commissions') ? mock((u) => mockVendorCommissions.list(u)) : http.get('/vendors/me/commissions')),

  /** Hoa hồng từng đơn của một bảng kê. */
  lines: (statementId: string): Promise<CommissionLine[]> =>
    isMock('commissions') ? mock((u) => mockVendorCommissions.lines(u, statementId)) : http.get(`/vendors/me/commissions/${statementId}/lines`),

  /** Nộp một lần cho cả bảng kê. Dữ liệu thật: trả paymentUrl (VNPay). Dữ liệu giả: nộp thành công ngay. */
  pay: (statementId: string): Promise<PayStatementResult> =>
    isMock('commissions') ? mock((u) => mockVendorCommissions.pay(u, statementId), 700) : http.post(`/vendors/me/commissions/${statementId}/pay`),
}


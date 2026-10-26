import { ApiError } from '@/api/client'
import type { CommissionLine, CommissionOverview, CommissionStatement, PayStatementResult } from '@/types/commission'
import { COMMISSION_RATE, mockVendorOrders, type StoredStatement } from './vendorOrders'
import { mockVendors } from './vendors'

/*
 * Bảng kê hoa hồng giả phía NCC. Dữ liệu (Commissions, CommissionStatements) do mocks/vendorOrders.ts tạo khi đơn chuyển sang
 * Completed, cùng kho với đơn hàng. Ở đây chỉ đọc ra đúng hình dạng API và xử lý "nộp một lần qua VNPay".
 */

const toStatement = (s: StoredStatement): CommissionStatement => ({
  id: s.id,
  periodMonth: s.periodMonth.slice(0, 7),
  totalOrders: s.totalOrders,
  totalAmount: s.totalAmount,
  dueDate: s.dueDate,
  status: s.status,
  paidDate: s.paidDate,
  transactionCode: s.transactionCode,
  createdDate: s.createdDate,
})

export const mockVendorCommissions = {
  list(userId: string): CommissionOverview {
    const { statements } = mockVendorOrders.commissionData(userId)
    // NCC chưa có hồ sơ thì coi như Nhà hàng, giống tỷ lệ mặc định khi tạo hoa hồng
    const profile = mockVendors.getMyProfile(userId)
    const category = profile.verifiedCategory ?? profile.category ?? { slug: 'nha-hang', name: 'Nhà hàng' }
    return {
      rate: { percent: COMMISSION_RATE[category.slug] ?? COMMISSION_RATE['nha-hang'], categoryName: category.name },
      statements: [...statements].sort((a, b) => b.periodMonth.localeCompare(a.periodMonth)).map(toStatement),
    }
  },

  lines(userId: string, statementId: string): CommissionLine[] {
    const { statements, commissions, orders } = mockVendorOrders.commissionData(userId)
    if (!statements.some((s) => s.id === statementId)) throw new ApiError(404, 'COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.')
    return commissions
      .filter((c) => c.statementId === statementId)
      .map((c) => {
        const o = orders.find((x) => x.id === c.orderId)
        return {
          id: c.id,
          orderId: c.orderId,
          orderCode: o?.orderCode ?? '',
          customerName: o?.customerName ?? '',
          completedDate: o?.completedDate ?? c.createdDate,
          orderAmount: c.orderAmount,
          rate: c.rate,
          amount: c.amount,
        }
      })
      .sort((a, b) => b.completedDate.localeCompare(a.completedDate))
  },

  /** Nộp cả bảng kê (mô phỏng VNPay thành công): Unpaid thành Paid, ghi PaidDate, mã giao dịch. */
  pay(userId: string, statementId: string): PayStatementResult {
    return { paymentUrl: null, statement: toStatement(mockVendorOrders.payStatement(userId, statementId)) }
  },
}

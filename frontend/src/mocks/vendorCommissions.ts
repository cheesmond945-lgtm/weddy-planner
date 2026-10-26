import { ApiError } from '@/api/client'
import { buildStatements } from '@/features/commissions/calc'
import { canSubmitProof, remainingOf } from '@/features/commissions/constants'
import { now } from '@/lib/clock'
import { authStore } from '@/store/auth'
import type { CommissionPayment, CommissionStatement, CommissionStatementSummary, SubmitCommissionPaymentBody } from '@/types/commission'
import { mockVendorOrders } from './vendorOrders'
import { mockVendors } from './vendors'

/*
 * Bảng kê hoa hồng giả phía NCC. Bảng kê và dòng hoa hồng do mocks/vendorOrders.ts tạo khi đơn Completed (CommissionStatements,
 * Commissions). GIAI ĐOẠN TẠM: các lần NCC gửi minh chứng thanh toán còn theo mô hình cũ và lưu riêng ở đây;
 * bước 2 viết lại theo CSDL (Unpaid/Paid, nộp một lần qua VNPay, không minh chứng).
 */
const STORAGE_KEY = 'weddy.mock.vendorCommissions'

/** Tài khoản nhận như prototype NCC: không dùng để chuyển tiền thật. */
const TRANSFER = { accountName: 'WEBPLAN DEMO', bankName: 'Ngân hàng mẫu', accountNumber: 'DEMO-000000 · Không dùng chuyển tiền' }

function seed(): Record<string, CommissionPayment[]> {
  return {}
}

function load(): Record<string, Record<string, CommissionPayment[]>> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, Record<string, CommissionPayment[]>>
  } catch {
    return {}
  }
}

function withPayments<T>(userId: string, fn: (byPeriod: Record<string, CommissionPayment[]>) => T): T {
  const all = load()
  all[userId] ??= seed()
  const result = fn(all[userId])
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  } catch {
    // bỏ qua
  }
  return result
}

function statements(userId: string, byPeriod: Record<string, CommissionPayment[]>): CommissionStatement[] {
  const profile = mockVendors.getMyProfile(userId)
  // Giai đoạn mock: NCC chưa có hồ sơ thì coi như Nhà hàng (đúng với tỷ lệ mặc định trong mocks/vendorOrders.ts)
  const category = profile.verifiedCategory ?? profile.category ?? { id: 'cat-nha-hang', slug: 'nha-hang', name: 'Nhà hàng' }
  const vendorName = profile.businessName ?? authStore.getSession()?.user.name ?? 'Nhà cung cấp'
  return buildStatements({ source: mockVendorOrders.commissionData(userId), category, vendorName, payments: byPeriod, transfer: TRANSFER, now: now() })
}

function find(list: CommissionStatement[], id: string) {
  const s = list.find((x) => x.id === id)
  if (!s) throw new ApiError(404, 'COMMISSION_STATEMENT_NOT_FOUND', 'Không tìm thấy bảng kê.')
  return s
}

export const mockVendorCommissions = {
  list(userId: string): CommissionStatementSummary[] {
    return withPayments(userId, (byPeriod) => statements(userId, byPeriod).map(({ lines: _l, payments: _p, transfer: _t, ...summary }) => summary))
  },

  get(userId: string, id: string): CommissionStatement {
    return withPayments(userId, (byPeriod) => find(statements(userId, byPeriod), id))
  },

  /** NCC gửi minh chứng đã chuyển tiền hoa hồng cho một kỳ đã chốt. */
  submitPayment(userId: string, id: string, body: SubmitCommissionPaymentBody): CommissionStatement {
    return withPayments(userId, (byPeriod) => {
      const s = find(statements(userId, byPeriod), id)
      if (s.status === 'OPEN') throw new ApiError(409, 'COMMISSION_PERIOD_OPEN', 'Kỳ hiện tại chưa chốt, chưa thanh toán được.')
      if (!canSubmitProof(s)) throw new ApiError(409, 'COMMISSION_NOT_PAYABLE', 'Kỳ này đã thanh toán đủ hoặc đang có minh chứng chờ xác nhận.')
      if (!(body.amount > 0) || body.amount > remainingOf(s)) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Số tiền phải lớn hơn 0 và không vượt số còn phải trả.')
      }
      if (!body.proofFile) throw new ApiError(400, 'VALIDATION_ERROR', 'Cần tải tệp minh chứng.')
      byPeriod[s.period] = [
        ...(byPeriod[s.period] ?? []),
        {
          id: `cp-${Date.now().toString(36)}`,
          amount: body.amount,
          proofFile: body.proofFile,
          note: body.note?.trim() || null,
          submittedAt: new Date().toISOString(),
          status: 'PENDING',
          reviewedAt: null,
          reviewNote: null,
        },
      ]
      return find(statements(userId, byPeriod), id)
    })
  },

  /** CHỈ CÓ TRONG MOCK: giả lập Admin xác nhận / từ chối minh chứng đang chờ. */
  review(userId: string, id: string, decision: 'CONFIRMED' | 'REJECTED'): CommissionStatement {
    return withPayments(userId, (byPeriod) => {
      const s = find(statements(userId, byPeriod), id)
      const p = (byPeriod[s.period] ?? []).find((x) => x.status === 'PENDING')
      if (!p) throw new ApiError(409, 'CONFLICT', 'Không có minh chứng đang chờ xác nhận.')
      p.status = decision
      p.reviewedAt = new Date().toISOString()
      p.reviewNote = decision === 'REJECTED' ? 'Không tìm thấy giao dịch tương ứng, vui lòng kiểm tra và gửi lại minh chứng.' : null
      return find(statements(userId, byPeriod), id)
    })
  },
}

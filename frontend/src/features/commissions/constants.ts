import type { BadgeTone } from '@/components/Badge'
import type { CommissionPaymentStatus, CommissionStatus } from '@/types/commission'

/**
 * Tỷ lệ hoa hồng theo lĩnh vực (slug danh mục), số nguyên phần trăm, theo quyết định của nhóm.
 * Lĩnh vực không có trong bảng dùng DEFAULT_COMMISSION_RATE. Sau này Admin cấu hình, BE trả về.
 */
export const COMMISSION_RATES: Record<string, number> = {
  'nha-hang': 8,
  'chup-anh': 12,
  'trang-phuc': 12,
}
export const DEFAULT_COMMISSION_RATE = 10

export const commissionRateOf = (categorySlug: string | null | undefined) =>
  (categorySlug && COMMISSION_RATES[categorySlug]) || DEFAULT_COMMISSION_RATE

/** Hạn thanh toán: ngày 20 của tháng sau kỳ (như prototype NCC: kỳ 09/2026 hạn 20/10/2026). */
export const COMMISSION_DUE_DAY = 20

export const COMMISSION_STATUS: Record<CommissionStatus, { label: string; tone: BadgeTone }> = {
  OPEN: { label: 'Đang tạm tính', tone: 'info' },
  UNPAID: { label: 'Chưa thanh toán', tone: 'warn' },
  PARTIALLY_PAID: { label: 'Chưa thanh toán đủ', tone: 'wait' },
  PENDING_CONFIRMATION: { label: 'Chờ xác nhận', tone: 'info' },
  PAID: { label: 'Đã thanh toán', tone: 'done' },
}

export const COMMISSION_PAYMENT_STATUS: Record<CommissionPaymentStatus, { label: string; tone: BadgeTone }> = {
  PENDING: { label: 'Chờ xác nhận', tone: 'info' },
  CONFIRMED: { label: 'Đã xác nhận', tone: 'done' },
  REJECTED: { label: 'Bị từ chối', tone: 'warn' },
}

/** "2026-09" -> "09/2026" */
export const formatPeriod = (period: string) => {
  const [y, m] = period.split('-')
  return `${m}/${y}`
}

/** "2026-09" -> "DS092026" (mã bảng kê như prototype) */
export const statementCode = (period: string) => {
  const [y, m] = period.split('-')
  return `DS${m}${y}`
}

/** Còn phải trả của kỳ (không tính khoản đang chờ xác nhận). */
export const remainingOf = (s: { commissionAmount: number; paidAmount: number }) => Math.max(0, s.commissionAmount - s.paidAmount)

/** Được gửi minh chứng khi kỳ đã chốt, còn phải trả và không có lần gửi đang chờ. */
export const canSubmitProof = (s: { status: CommissionStatus; commissionAmount: number; paidAmount: number; pendingAmount: number }) =>
  s.status !== 'OPEN' && remainingOf(s) > 0 && s.pendingAmount === 0

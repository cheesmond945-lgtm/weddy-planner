import type { CategoryRef } from '@/types/catalog'
import type {
  CommissionLine,
  CommissionPayment,
  CommissionPaymentRef,
  CommissionStatement,
  CommissionStatus,
  CommissionTransferInfo,
} from '@/types/commission'
import type { Order } from '@/types/vendorOrder'
import { COMMISSION_DUE_DAY, remainingOf, statementCode } from './constants'

/*
 * Dựng bảng kê hoa hồng theo kỳ tháng (giờ Việt Nam) từ dữ liệu CSDL: CommissionStatements (mỗi NCC mỗi tháng, hạn nộp ngày 25 tháng sau)
 * và Commissions (một dòng cho mỗi đơn Completed, kỳ = tháng của CompletedDate, tỷ lệ chụp từ loại dịch vụ).
 * GIAI ĐOẠN TẠM: giao diện hoa hồng còn theo mô hình cũ (minh chứng, một phần); bước 2 viết lại theo CSDL.
 */

const VN_OFFSET = 7 * 3600_000

/** ISO thời điểm -> kỳ "YYYY-MM" theo giờ Việt Nam. */
export const periodOfInstant = (iso: string) => new Date(Date.parse(iso) + VN_OFFSET).toISOString().slice(0, 7)

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Ngày chốt (cuối tháng) và hạn thanh toán (ngày 25 tháng sau) của kỳ. */
export function periodDates(period: string) {
  const [y, m] = period.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  return { closingDate: ymd(y, m, lastDay), dueDate: ymd(next.y, next.m, COMMISSION_DUE_DAY) }
}

/** Dữ liệu hoa hồng từ CSDL (hoặc dữ liệu giả cùng hình dạng). */
export interface CommissionSource {
  statements: { id: string; periodMonth: string; dueDate: string; totalOrders: number; totalAmount: number; transactionCode: string | null; status: 'Unpaid' | 'Paid'; paidDate: string | null; createdDate: string }[]
  commissions: { id: string; orderId: string; statementId: string; orderAmount: number; rate: number; amount: number }[]
  orders: Order[]
}

function statusOf(period: string, current: string, amount: number, paid: number, pending: number): CommissionStatus {
  if (period === current) return 'OPEN'
  if (paid >= amount && amount > 0) return 'PAID'
  if (pending > 0) return 'PENDING_CONFIRMATION'
  return paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'
}

interface BuildInput {
  source: CommissionSource
  category: CategoryRef
  vendorName: string
  /** Các lần gửi minh chứng theo kỳ (mô hình cũ, bước 2 bỏ) */
  payments: Record<string, CommissionPayment[]>
  transfer: Omit<CommissionTransferInfo, 'content'>
  now: Date
}

/** Bảng kê mọi kỳ có phát sinh (luôn có kỳ hiện tại), mới nhất trước. */
export function buildStatements({ source, category, vendorName, payments, transfer, now }: BuildInput): CommissionStatement[] {
  const current = periodOfInstant(now.toISOString())
  const today = new Date(now.getTime() + VN_OFFSET).toISOString().slice(0, 10)
  const stored = new Map(source.statements.map((s) => [s.periodMonth.slice(0, 7), s]))
  const periods = [...new Set([current, ...stored.keys(), ...Object.keys(payments)])].filter((p) => p <= current).sort().reverse()

  return periods.map((period) => {
    const st = stored.get(period)
    const own: CommissionLine[] = source.commissions
      .filter((c) => c.statementId === st?.id)
      .flatMap((c) => {
        const o = source.orders.find((x) => x.id === c.orderId)
        if (!o) return []
        const refs: CommissionPaymentRef[] = []
        if (o.payment?.status === 'Paid' && o.payment.paidDate) {
          refs.push({ paymentId: `dep-${o.id}`, installmentName: 'Đợt 1 – Đặt cọc', paidAt: o.payment.paidDate, method: 'VNPAY', amount: o.depositAmount })
        }
        if (o.completedDate) {
          refs.push({ paymentId: `final-${o.id}`, installmentName: 'Đợt 2 – Thanh toán còn lại', paidAt: o.completedDate, method: 'CASH', amount: o.totalAmount - o.depositAmount })
        }
        return [
          {
            id: c.id,
            kind: 'ORDER' as const,
            orderId: o.id,
            orderCode: o.orderCode,
            customerName: o.customerName,
            eventDate: o.eventDate,
            category,
            rate: c.rate,
            baseAmount: c.orderAmount,
            commissionAmount: c.amount,
            payments: refs,
            originPeriod: null,
          },
        ]
      })
    const commissionAmount = own.reduce((s, l) => s + l.commissionAmount, 0)
    // Bảng kê đã nộp (CSDL: Paid) tính là đã thanh toán đủ; kỳ chưa nộp xét theo minh chứng (mô hình cũ)
    const subs: CommissionPayment[] = [...(payments[period] ?? [])]
    if (st?.status === 'Paid') {
      subs.push({
        id: `vnp-${st.id}`,
        amount: commissionAmount,
        proofFile: null,
        note: st.transactionCode ? `Mã giao dịch ${st.transactionCode}` : null,
        submittedAt: st.paidDate ?? st.createdDate,
        status: 'CONFIRMED',
        reviewedAt: st.paidDate,
        reviewNote: null,
      })
    }
    const paidAmount = subs.filter((p) => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0)
    const pendingAmount = subs.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0)
    const { closingDate, dueDate: defaultDue } = periodDates(period)
    const dueDate = st?.dueDate ?? defaultDue
    const status = statusOf(period, current, commissionAmount, paidAmount, pendingAmount)
    const code = statementCode(period)
    return {
      id: code,
      code,
      period,
      status,
      orderCount: own.length,
      supplementCount: 0,
      baseAmount: own.reduce((s, l) => s + l.baseAmount, 0),
      commissionAmount,
      paidAmount,
      pendingAmount,
      closingDate,
      dueDate,
      isOverdue: status !== 'OPEN' && status !== 'PAID' && today > dueDate && remainingOf({ commissionAmount, paidAmount }) > 0,
      lines: own.sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
      payments: subs.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
      transfer: { ...transfer, content: `${code} — ${vendorName}` },
    }
  })
}

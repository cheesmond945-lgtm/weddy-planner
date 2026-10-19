import { currentContent } from '@/features/serviceOrders/calc'
import type { CategoryRef } from '@/types/catalog'
import type {
  CommissionLine,
  CommissionPayment,
  CommissionPaymentRef,
  CommissionStatement,
  CommissionStatus,
  CommissionTransferInfo,
} from '@/types/commission'
import type { OrderPayment, ServiceOrder } from '@/types/serviceOrder'
import { COMMISSION_DUE_DAY, commissionRateOf, remainingOf, statementCode } from './constants'

/*
 * Lập bảng kê hoa hồng theo kỳ tháng (giờ Việt Nam), theo quyết định của nhóm:
 * - Đơn đã xác nhận có ngày sự kiện trong tháng là "đơn hoàn thành" của kỳ tháng đó.
 * - Hoa hồng của đơn = tỷ lệ lĩnh vực × tổng các khoản đã thu tới ngày chốt kỳ (cuối tháng).
 * - Khoản thu sau ngày chốt của đơn đã tính: dòng "bổ sung" ở kỳ của tháng thu. Bảng kê đã chốt không đổi.
 * BE làm tương tự (job chốt kỳ ở backend/src/jobs); hàm thuần, dữ liệu giả dùng lại.
 */

const VN_OFFSET = 7 * 3600_000

/** ISO thời điểm -> kỳ "YYYY-MM" theo giờ Việt Nam. */
export const periodOfInstant = (iso: string) => new Date(Date.parse(iso) + VN_OFFSET).toISOString().slice(0, 7)

/** Ngày "YYYY-MM-DD" -> kỳ "YYYY-MM". */
export const periodOfDay = (day: string) => day.slice(0, 7)

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

/** Ngày chốt (cuối tháng) và hạn thanh toán (ngày 20 tháng sau) của kỳ. */
export function periodDates(period: string) {
  const [y, m] = period.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const next = m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 }
  return {
    closingDate: ymd(y, m, lastDay),
    dueDate: ymd(next.y, next.m, COMMISSION_DUE_DAY),
    /** Thời điểm chốt: 00:00 ngày 1 tháng sau, giờ Việt Nam */
    closesAt: new Date(Date.UTC(next.y, next.m - 1, 1) - VN_OFFSET).toISOString(),
  }
}

const refOf = (p: OrderPayment): CommissionPaymentRef => ({
  paymentId: p.id,
  installmentName: p.installmentName,
  paidAt: p.paidAt,
  method: p.method,
  amount: p.amount,
})

/** Các dòng hoa hồng của mọi kỳ tới kỳ hiện tại. */
export function commissionLines(orders: ServiceOrder[], category: CategoryRef, now: Date): (CommissionLine & { period: string })[] {
  const current = periodOfInstant(now.toISOString())
  const rate = commissionRateOf(category.slug)
  const out: (CommissionLine & { period: string })[] = []

  for (const o of orders) {
    const content = currentContent(o)
    if (o.status !== 'CONFIRMED' || !content?.eventDate) continue
    const period = periodOfDay(content.eventDate)
    if (period > current) continue

    const { closesAt } = periodDates(period)
    const inMain = o.payments.filter((p) => p.paidAt < closesAt)
    const late = o.payments.filter((p) => p.paidAt >= closesAt)
    const base = { orderId: o.id, orderCode: o.code, customerName: content.customerName, eventDate: content.eventDate, category, rate }

    const mainBase = inMain.reduce((s, p) => s + p.amount, 0)
    if (mainBase > 0) {
      out.push({
        ...base,
        id: `${o.id}-${period}`,
        period,
        kind: 'ORDER',
        baseAmount: mainBase,
        commissionAmount: Math.round((mainBase * rate) / 100),
        payments: inMain.map(refOf),
        originPeriod: null,
      })
    }

    // Khoản thu sau ngày chốt: gộp theo tháng thu
    const byMonth = new Map<string, OrderPayment[]>()
    for (const p of late) {
      const m = periodOfInstant(p.paidAt)
      if (m <= current) byMonth.set(m, [...(byMonth.get(m) ?? []), p])
    }
    for (const [m, ps] of byMonth) {
      const amount = ps.reduce((s, p) => s + p.amount, 0)
      out.push({
        ...base,
        id: `${o.id}-${m}-sup`,
        period: m,
        kind: 'SUPPLEMENT',
        baseAmount: amount,
        commissionAmount: Math.round((amount * rate) / 100),
        payments: ps.map(refOf),
        originPeriod: period,
      })
    }
  }
  return out
}

function statusOf(period: string, current: string, amount: number, paid: number, pending: number): CommissionStatus {
  if (period === current) return 'OPEN'
  if (paid >= amount) return 'PAID'
  if (pending > 0) return 'PENDING_CONFIRMATION'
  return paid > 0 ? 'PARTIALLY_PAID' : 'UNPAID'
}

interface BuildInput {
  orders: ServiceOrder[]
  category: CategoryRef
  vendorName: string
  /** Các lần gửi minh chứng theo kỳ */
  payments: Record<string, CommissionPayment[]>
  transfer: Omit<CommissionTransferInfo, 'content'>
  now: Date
}

/** Bảng kê mọi kỳ có phát sinh (luôn có kỳ hiện tại), mới nhất trước. */
export function buildStatements({ orders, category, vendorName, payments, transfer, now }: BuildInput): CommissionStatement[] {
  const current = periodOfInstant(now.toISOString())
  const today = new Date(now.getTime() + VN_OFFSET).toISOString().slice(0, 10)
  const lines = commissionLines(orders, category, now)
  const periods = [...new Set([current, ...lines.map((l) => l.period), ...Object.keys(payments)])].filter((p) => p <= current).sort().reverse()

  return periods.map((period) => {
    const own = lines.filter((l) => l.period === period).map(({ period: _, ...l }) => l)
    const subs = payments[period] ?? []
    const commissionAmount = own.reduce((s, l) => s + l.commissionAmount, 0)
    const paidAmount = subs.filter((p) => p.status === 'CONFIRMED').reduce((s, p) => s + p.amount, 0)
    const pendingAmount = subs.filter((p) => p.status === 'PENDING').reduce((s, p) => s + p.amount, 0)
    const { closingDate, dueDate } = periodDates(period)
    const status = statusOf(period, current, commissionAmount, paidAmount, pendingAmount)
    const code = statementCode(period)
    return {
      id: code,
      code,
      period,
      status,
      orderCount: own.filter((l) => l.kind === 'ORDER').length,
      supplementCount: own.filter((l) => l.kind === 'SUPPLEMENT').length,
      baseAmount: own.reduce((s, l) => s + l.baseAmount, 0),
      commissionAmount,
      paidAmount,
      pendingAmount,
      closingDate,
      dueDate,
      isOverdue: status !== 'OPEN' && status !== 'PAID' && today > dueDate && remainingOf({ commissionAmount, paidAmount }) > 0,
      lines: own.sort((a, b) => a.eventDate.localeCompare(b.eventDate)),
      payments: [...subs].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
      transfer: { ...transfer, content: `${code} — ${vendorName}` },
    }
  })
}

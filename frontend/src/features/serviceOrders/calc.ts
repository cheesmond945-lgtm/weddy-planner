import { formatDate } from '@/lib/date'
import { formatMoney, formatNumber } from '@/lib/format'
import type { OrderContent, OrderInstallment, OrderLine, OrderPaymentStatus, ServiceOrder } from '@/types/serviceOrder'
import { PAYMENT_METHOD_LABEL } from './constants'

/* Tính toán trên nội dung đơn, theo prototype NCC. Hàm thuần, dùng cả ở giao diện và dữ liệu giả. */

/** "2026-12-20" -> "20/12/2026"; trống thì "—". */
export const formatDay = (s: string | null | undefined) => (s ? formatDate(s) : '—')

/** ISO -> "14:32 · 18/10" (giờ máy người dùng, như prototype). */
export function formatStamp(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export const lineAmount = (l: Pick<OrderLine, 'quantity' | 'unitPrice'>) => (l.quantity > 0 && l.unitPrice >= 0 ? Math.round(l.quantity * l.unitPrice) : 0)

/** Dòng trống hoàn toàn (bỏ qua khi tính, kiểm tra, gửi). */
export const isBlankLine = (l: OrderLine) => !l.name.trim() && !l.unit.trim() && !l.quantity && !l.unitPrice

export const filledLines = (lines: OrderLine[]) => lines.filter((l) => !isBlankLine(l))

export const totalOf = (lines: OrderLine[]) => lines.reduce((s, l) => s + lineAmount(l), 0)

export const scheduledOf = (insts: OrderInstallment[]) => insts.reduce((s, i) => s + (Math.round(i.amount) || 0), 0)

export const newLine = (): OrderLine => ({ id: uid('l'), packageId: null, name: '', unit: '', quantity: 0, unitPrice: 0, isPolicyFee: false })

/** Đợt mới: đợt đầu là đặt cọc (VietQR); đợt sau nhận phần còn thiếu. */
/**
 * Đợt mới: đợt đầu là đặt cọc (VietQR). Nếu các đợt hiện có đều theo tỷ lệ và chưa đủ 100% thì đợt mới nhận phần %
 * còn lại, ngược lại nhận phần tiền còn thiếu.
 */
export function newInstallment(index: number, total: number, current: OrderInstallment[]): OrderInstallment {
  const allRated = current.length > 0 && current.every((i) => i.rate !== null)
  const restRate = Math.max(0, 100 - current.reduce((s, i) => s + (i.rate ?? 0), 0))
  const inst: OrderInstallment = {
    id: uid('i'),
    name: index === 0 ? 'Đợt 1 – Đặt cọc' : `Đợt ${index + 1}`,
    rate: allRated && restRate > 0 ? restRate : null,
    amount: index === 0 ? 0 : Math.max(0, total - scheduledOf(current)),
    dueDate: '',
    method: index === 0 ? 'VIETQR' : 'BANK_TRANSFER',
    note: null,
  }
  return inst
}

/** Đổi tỷ lệ (số nguyên %) thì tính lại số tiền. */
export const withRate = (i: OrderInstallment, rate: number | null, total: number): OrderInstallment => ({
  ...i,
  rate,
  amount: rate === null ? i.amount : Math.round((total * rate) / 100),
})

/** Nhập số tiền trực tiếp: bỏ tỷ lệ (tỷ lệ chỉ là số nguyên, không suy ngược từ số tiền). */
export const withAmount = (i: OrderInstallment, amount: number): OrderInstallment => ({ ...i, amount, rate: null })

/**
 * Tính lại số tiền các đợt theo tỷ lệ. Khi mọi đợt có tỷ lệ và cộng đủ 100%, đợt cuối nhận phần tiền lẻ còn lại
 * để tổng các đợt luôn bằng tổng đơn. Đợt trong `locked` (đã có khoản thu) giữ nguyên.
 */
export function rebalance(insts: OrderInstallment[], total: number, locked: string[] = []): OrderInstallment[] {
  const out = insts.map((i) => (i.rate === null || locked.includes(i.id) ? i : withRate(i, i.rate, total)))
  const last = out[out.length - 1]
  const allRated = out.every((i) => i.rate !== null)
  if (last && allRated && out.reduce((s, i) => s + (i.rate ?? 0), 0) === 100 && !locked.includes(last.id)) {
    out[out.length - 1] = { ...last, amount: Math.max(0, total - scheduledOf(out.slice(0, -1))) }
  }
  return out
}

export function emptyContent(customer?: { name: string; phone: string }): OrderContent {
  return {
    customerName: customer?.name ?? '',
    customerPhone: customer?.phone ?? '',
    eventDate: '',
    note: null,
    lines: [newLine()],
    installments: [
      { id: 'deposit', name: 'Đợt 1 – Đặt cọc', rate: 30, amount: 0, dueDate: '', method: 'VIETQR', note: null },
      { id: 'final', name: 'Đợt 2 – Thanh toán còn lại', rate: 70, amount: 0, dueDate: '', method: 'CASH', note: null },
    ],
  }
}

/** Gọn nội dung trước khi gửi: bỏ dòng trống, ghi chú rỗng thành null. */
export const cleanContent = (c: OrderContent): OrderContent => ({ ...c, note: c.note?.trim() || null, lines: filledLines(c.lines) })

export const currentVersion = (o: Pick<ServiceOrder, 'versions'>) => o.versions[o.versions.length - 1] ?? null

/** Nội dung đang hiện hành: phiên bản mới nhất, chưa gửi thì bản nháp. */
export const currentContent = (o: Pick<ServiceOrder, 'versions' | 'draft'>) => currentVersion(o)?.content ?? o.draft?.content ?? null

/** Tên dòng đầu và số dòng còn lại (dòng tóm tắt trên thẻ đơn). */
export function headlineOf(c: OrderContent) {
  const lines = filledLines(c.lines)
  return { name: lines[0]?.name ?? 'Chưa có hạng mục', more: Math.max(0, lines.length - 1) }
}

/** Trạng thái thanh toán tính từ các khoản đã thu (BE tính). */
export function paymentStatusOf(o: Pick<ServiceOrder, 'status' | 'payments' | 'versions' | 'draft'>): OrderPaymentStatus {
  const paid = o.payments.reduce((s, p) => s + p.amount, 0)
  if (o.status !== 'CONFIRMED' && !paid) return 'UNPAID'
  const content = currentContent(o)
  const total = content ? totalOf(content.lines) : 0
  const deposit = content?.installments[0]
  const depositPaid = !!deposit && o.payments.filter((p) => p.installmentId === deposit.id).reduce((s, p) => s + p.amount, 0) >= deposit.amount
  if (paid > total) return 'OVERPAID'
  if (paid === total && total > 0) return 'PAID'
  if (depositPaid) return 'DEPOSIT_PAID'
  return paid > 0 ? 'PARTIALLY_PAID' : 'AWAITING_DEPOSIT'
}

/** Danh sách thay đổi giữa hai nội dung (khi gửi lại, như prototype). */
export function diffContent(a: OrderContent, b: OrderContent): string[] {
  const out: string[] = []
  if (a.customerName !== b.customerName) out.push(`Tên khách: ${a.customerName} → ${b.customerName}`)
  if (a.customerPhone !== b.customerPhone) out.push(`Số điện thoại: ${a.customerPhone} → ${b.customerPhone}`)
  if (a.eventDate !== b.eventDate) out.push(`Ngày sự kiện: ${formatDay(a.eventDate)} → ${formatDay(b.eventDate)}`)
  if ((a.note ?? '') !== (b.note ?? '')) out.push('Ghi chú gửi khách đã cập nhật')

  const key = (l: OrderLine) => l.name.trim().toLowerCase()
  const before = filledLines(a.lines)
  const after = filledLines(b.lines)
  for (const l of after) {
    const old = before.find((x) => key(x) === key(l))
    if (!old) {
      out.push(`Thêm hạng mục: ${l.name} (${formatNumber(l.quantity)} ${l.unit} × ${formatMoney(l.unitPrice)})`)
      continue
    }
    if (old.quantity !== l.quantity) out.push(`${l.name}: số lượng ${formatNumber(old.quantity)} → ${formatNumber(l.quantity)} ${l.unit}`)
    if (old.unitPrice !== l.unitPrice) out.push(`${l.name}: đơn giá ${formatMoney(old.unitPrice)} → ${formatMoney(l.unitPrice)}`)
    if (old.unit !== l.unit) out.push(`${l.name}: đơn vị ${old.unit} → ${l.unit}`)
  }
  for (const l of before) if (!after.some((x) => key(x) === key(l))) out.push(`Bỏ hạng mục: ${l.name}`)

  const ta = totalOf(a.lines)
  const tb = totalOf(b.lines)
  if (ta !== tb) out.push(`Tổng tiền: ${formatMoney(ta)} → ${formatMoney(tb)}`)

  for (let i = 0; i < Math.max(a.installments.length, b.installments.length); i++) {
    const x = a.installments[i]
    const y = b.installments[i]
    if (!x) out.push(`Thêm ${y.name}: ${formatMoney(y.amount)} · ${PAYMENT_METHOD_LABEL[y.method]}`)
    else if (!y) out.push(`Bỏ ${x.name}`)
    else {
      if (x.amount !== y.amount) out.push(`${y.name}: ${formatMoney(x.amount)} → ${formatMoney(y.amount)}`)
      if (x.method !== y.method) out.push(`${y.name}: phương thức ${PAYMENT_METHOD_LABEL[x.method]} → ${PAYMENT_METHOD_LABEL[y.method]}`)
      if (x.dueDate !== y.dueDate) out.push(`${y.name}: hạn ${formatDay(x.dueDate)} → ${formatDay(y.dueDate)}`)
      if (x.name !== y.name) out.push(`Đổi tên đợt: ${x.name} → ${y.name}`)
    }
  }
  return out
}

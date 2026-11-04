/*
 * Nhãn đợt 2 (phần còn lại, tiền mặt trả trực tiếp cho NCC) từ order.restPayment (backend: việc PAY:<orderId> Done = NCC đã nhận).
 * Dùng chung cho thẻ đơn, bảng đơn, lịch thanh toán của cả hai phía.
 */
import type { Order } from '@/types/vendorOrder'

/** Đơn Đã cọc mà NCC đã ghi nhận đủ tiền mặt đợt 2: hiện nhãn "Đã thanh toán đủ" (đơn vẫn Đã cọc, chỉ sang Hoàn thành sau ngày thực hiện). */
export const isPaidInFull = (o: Pick<Order, 'status' | 'restPayment'>) => o.status === 'Deposited' && o.restPayment?.status === 'Received'

export type Viewer = 'VENDOR' | 'COUPLE'
export type RestTone = 'ok' | 'wait' | 'warn' | 'none'

/** "2027-01-08T03:00:00.000Z" -> "08/01" theo giờ Việt Nam. */
export function vnDayMonth(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000).toISOString()
  return `${d.slice(8, 10)}/${d.slice(5, 7)}`
}

/**
 * NCC: "Đã nhận dd/mm" / "Chưa nhận" (đơn Completed: cùng chữ, màu cam) / "Không thu" (đã hủy).
 * Khách: "Đã thanh toán dd/mm" / "Chưa thanh toán (trả trực tiếp cho NCC)".
 */
export function restLabel(o: Pick<Order, 'status' | 'restPayment'>, viewer: Viewer): { text: string; tone: RestTone } {
  const r = o.restPayment
  if (!r || r.status === 'NotApplicable') return o.status === 'Cancelled' ? { text: 'Không thu', tone: 'none' } : { text: '—', tone: 'none' }
  if (r.status === 'Received') {
    const day = r.receivedDate ? ` ${vnDayMonth(r.receivedDate)}` : ''
    return { text: viewer === 'VENDOR' ? `Đã nhận${day}` : `Đã thanh toán${day}`, tone: 'ok' }
  }
  // Cùng chữ "Chưa nhận"; đơn đã hoàn thành mà chưa nhận chỉ khác màu (cam)
  if (viewer === 'VENDOR') return { text: 'Chưa nhận', tone: o.status === 'Completed' ? 'warn' : 'wait' }
  return { text: 'Chưa thanh toán (trả trực tiếp cho NCC)', tone: 'wait' }
}

export const REST_TONE_CLASS: Record<RestTone, string> = {
  ok: 'font-semibold text-sage',
  wait: 'font-semibold text-gold-ink',
  warn: 'font-semibold text-orange-600',
  none: 'text-muted-foreground',
}

import { formatMoney } from '@/lib/format'
import type { OrderContent } from '@/types/serviceOrder'
import { filledLines, scheduledOf, totalOf } from './calc'

/** Lỗi theo ô: customerName, customerPhone, eventDate, lines, allocation, line:<id>:name|quantity|unitPrice, inst:<id>:name|amount|rate|dueDate. */
export type OrderErrors = Record<string, string>

// Quy tắc và câu báo lỗi lấy theo prototype NCC (kiểm tra đơn trước khi gửi)
const PHONE_RE = /^[0-9 +().-]{9,15}$/

/** Kiểm tra trước khi gửi đơn cho khách. Lưu nháp không kiểm tra (như prototype). */
export function validateOrder(c: OrderContent): OrderErrors {
  const e: OrderErrors = {}
  if (!c.customerName.trim()) e.customerName = 'Nhập tên khách hàng.'
  if (!PHONE_RE.test(c.customerPhone.trim())) e.customerPhone = 'Nhập số điện thoại hợp lệ (9–15 chữ số).'
  if (!c.eventDate) e.eventDate = 'Chọn ngày diễn ra sự kiện.'

  const lines = filledLines(c.lines)
  for (const l of lines) {
    if (!l.name.trim()) e[`line:${l.id}:name`] = 'Nhập hạng mục.'
    if (!(l.quantity > 0)) e[`line:${l.id}:quantity`] = 'Số lượng > 0.'
    if (!(l.unitPrice >= 0)) e[`line:${l.id}:unitPrice`] = 'Đơn giá không âm.'
  }
  const total = totalOf(c.lines)
  if (!lines.length) e.lines = 'Cần ít nhất một dòng báo giá hợp lệ.'
  else if (total <= 0) e.lines = 'Tổng giá trị đơn phải lớn hơn 0.'

  for (const i of c.installments) {
    if (!i.name.trim()) e[`inst:${i.id}:name`] = 'Nhập tên đợt.'
    if (!(Math.round(i.amount) > 0)) e[`inst:${i.id}:amount`] = 'Số tiền > 0.'
    else if (i.amount > total) e[`inst:${i.id}:amount`] = 'Không vượt tổng đơn.'
    if (i.rate !== null && (!Number.isInteger(i.rate) || i.rate < 0 || i.rate > 100)) e[`inst:${i.id}:rate`] = 'Tỷ lệ là số nguyên 0–100%.'
    if (!i.dueDate) e[`inst:${i.id}:dueDate`] = 'Chọn hạn.'
  }
  const diff = total - scheduledOf(c.installments)
  if (total > 0 && diff !== 0) {
    e.allocation = diff > 0 ? `Các đợt thanh toán còn thiếu ${formatMoney(diff)}.` : `Các đợt thanh toán đang vượt tổng đơn ${formatMoney(-diff)}.`
  }
  return e
}

/**
 * Kiểm tra phương án điều chỉnh (như prototype NCC): các dòng báo giá hợp lệ, và khi tổng mới không thấp hơn
 * số đã thu thì các đợt phải cộng đủ tổng mới. Đợt đã thu giữ nguyên nên không kiểm tra lại.
 */
export function validateAdjustment(after: OrderContent, lockedIds: string[]): OrderErrors {
  const all = validateOrder(after)
  const e: OrderErrors = {}
  for (const [k, v] of Object.entries(all)) {
    if (k === 'lines' || k.startsWith('line:')) e[k] = v
    if (k.startsWith('inst:') && !lockedIds.some((id) => k.startsWith(`inst:${id}:`)) && !k.endsWith(':amount')) e[k] = v
  }
  const total = totalOf(after.lines)
  const lockedSum = after.installments.filter((i) => lockedIds.includes(i.id)).reduce((s, i) => s + i.amount, 0)
  if (total >= lockedSum && scheduledOf(after.installments) !== total) {
    e.allocation = `Các đợt chưa thanh toán phải cộng đủ ${formatMoney(total - lockedSum)}.`
  }
  return e
}

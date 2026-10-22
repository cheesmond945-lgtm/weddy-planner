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

  // Đơn gồm 2 đợt (khớp CSDL): đặt cọc theo tỷ lệ % và phần còn lại
  const deposit = c.installments[0]
  if (!deposit || deposit.rate === null || !Number.isInteger(deposit.rate) || deposit.rate < 1 || deposit.rate > 99) {
    e[`inst:${deposit?.id}:rate`] = 'Tỷ lệ đặt cọc là số nguyên từ 1 đến 99%.'
  }
  if (!deposit?.dueDate) e[`inst:${deposit?.id}:dueDate`] = 'Chọn hạn đặt cọc.'
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

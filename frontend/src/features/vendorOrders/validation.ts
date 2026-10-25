import { formatMoney } from '@/lib/format'
import { filledItems, totalOf, type OrderFormValues } from './calc'

/** Lỗi theo ô: customerName, customerPhone, eventDate, depositPercent, items, item:<i>:itemName|quantity|unitPrice. */
export type OrderErrors = Record<string, string>

// Quy tắc theo docs/api/orders.md (backend kiểm tra lại)
const PHONE_RE = /^[0-9 +().-]{9,15}$/

/** Lưu nháp: chỉ bắt buộc ngày sự kiện (cột NOT NULL, backend không tự đặt ngày hôm nay). */
export function validateDraft(v: OrderFormValues): OrderErrors {
  const e: OrderErrors = {}
  if (!v.eventDate) e.eventDate = 'Chọn ngày diễn ra sự kiện để lưu nháp.'
  return e
}

/** Gửi đơn, gửi lại, sửa sau cọc: đủ trường bắt buộc. `minTotal`: tiền đã cọc khi sửa sau cọc. */
export function validateOrder(v: OrderFormValues, opts: { minTotal?: number } = {}): OrderErrors {
  const e: OrderErrors = {}
  if (!v.customerName.trim()) e.customerName = 'Nhập tên khách hàng.'
  if (!PHONE_RE.test(v.customerPhone.trim())) e.customerPhone = 'Nhập số điện thoại hợp lệ (9–15 chữ số).'
  if (!v.eventDate) e.eventDate = 'Chọn ngày diễn ra sự kiện.'
  if (!(v.depositPercent > 0 && v.depositPercent < 100) || !Number.isInteger(v.depositPercent)) e.depositPercent = 'Tỷ lệ cọc là số nguyên từ 1 đến 99 (%).'

  const rows = v.items.map((it, index) => ({ it, index })).filter(({ it }) => filledItems([it]).length)
  if (!rows.length) e.items = 'Thêm ít nhất một hạng mục báo giá.'
  for (const { it, index } of rows) {
    if (!it.itemName.trim()) e[`item:${index}:itemName`] = 'Nhập hạng mục.'
    if (!(Number.isInteger(it.quantity) && it.quantity > 0)) e[`item:${index}:quantity`] = 'Số lượng là số nguyên > 0.'
    if (!(it.unitPrice >= 0)) e[`item:${index}:unitPrice`] = 'Đơn giá không âm.'
  }
  const total = totalOf(filledItems(v.items))
  if (rows.length && total <= 0) e.items ??= 'Tổng giá trị đơn phải lớn hơn 0.'
  if (opts.minTotal !== undefined && rows.length && total < opts.minTotal) e.items ??= `Tổng mới không được nhỏ hơn tiền đã cọc (${formatMoney(opts.minTotal)}).`
  return e
}

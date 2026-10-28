import { todayVN } from '@/lib/clock'
import { DEPOSIT_PERCENT_MIN, isDepositTooLarge } from '@/lib/deposit'
import { formatMoney } from '@/lib/format'
import { filledItems, totalOf, type OrderFormValues } from './calc'

/** Lỗi theo ô: customerName, customerPhone, eventDate, depositPercent, items, item:<i>:itemName|quantity|unitPrice. */
export type OrderErrors = Record<string, string>

// Quy tắc theo docs/api/orders.md (backend kiểm tra lại)
const PHONE_RE = /^[0-9 +().-]{9,15}$/

/** Ngày sự kiện hợp lệ: đủ "YYYY-MM-DD", năm 4 chữ số (ô ngày của trình duyệt cho gõ năm 5 chữ số, giá trị thành "55555-05-12"). */
const eventDateError = (date: string) => {
  if (!date) return 'Chọn ngày diễn ra sự kiện.'
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) ? undefined : 'Ngày diễn ra sự kiện không hợp lệ (năm gồm 4 chữ số).'
}

/** Lưu nháp: chỉ bắt buộc ngày sự kiện (cột NOT NULL, backend không tự đặt ngày hôm nay). */
export function validateDraft(v: OrderFormValues): OrderErrors {
  const e: OrderErrors = {}
  const date = eventDateError(v.eventDate)
  if (date) e.eventDate = v.eventDate ? date : 'Chọn ngày diễn ra sự kiện để lưu nháp.'
  return e
}

/**
 * Gửi đơn, gửi lại, sửa sau cọc: đủ trường bắt buộc. `minTotal`: tiền đã cọc khi sửa sau cọc.
 * `changeNote`: nội dung thay đổi khi sửa sau cọc (bắt buộc, khách sẽ thấy); không truyền thì không kiểm.
 * Ngày sự kiện phải từ hôm nay trở đi (giờ VN, theo đồng hồ giả lập); `originalEventDate`: ngày đang có của đơn, giữ nguyên thì không kiểm.
 * `deposit` = false (sửa sau cọc, tiền cọc đã khóa): bỏ kiểm "tổng đơn quá nhỏ để đặt cọc".
 */
export function validateOrder(v: OrderFormValues, opts: { minTotal?: number; changeNote?: string; originalEventDate?: string; deposit?: boolean } = {}): OrderErrors {
  const e: OrderErrors = {}
  if (opts.changeNote !== undefined && !opts.changeNote.trim()) e.changeNote = 'Ghi nội dung thay đổi để khách biết đơn đã đổi gì.'
  if (!v.customerName.trim()) e.customerName = 'Nhập tên khách hàng.'
  if (!PHONE_RE.test(v.customerPhone.trim())) e.customerPhone = 'Nhập số điện thoại hợp lệ (9–15 chữ số).'
  const date = eventDateError(v.eventDate)
  if (date) e.eventDate = date
  else if (v.eventDate !== opts.originalEventDate && v.eventDate < todayVN()) e.eventDate = 'Ngày diễn ra sự kiện phải từ hôm nay trở đi.'
  // Sửa sau cọc (deposit = false): tỷ lệ đã khóa, đơn cũ có thể dưới mức tối thiểu nên không kiểm
  if (opts.deposit !== false && (!(v.depositPercent >= DEPOSIT_PERCENT_MIN && v.depositPercent < 100) || !Number.isInteger(v.depositPercent))) {
    e.depositPercent = `Tỷ lệ cọc là số nguyên từ ${DEPOSIT_PERCENT_MIN} đến 99 (%).`
  }

  const rows = v.items.map((it, index) => ({ it, index })).filter(({ it }) => filledItems([it]).length)
  if (!rows.length) e.items = 'Thêm ít nhất một hạng mục báo giá.'
  for (const { it, index } of rows) {
    if (!it.itemName.trim()) e[`item:${index}:itemName`] = 'Nhập hạng mục.'
    if (!(Number.isInteger(it.quantity) && it.quantity > 0)) e[`item:${index}:quantity`] = 'Số lượng là số nguyên > 0.'
    if (!(it.unitPrice >= 0)) e[`item:${index}:unitPrice`] = 'Đơn giá không âm.'
  }
  const total = totalOf(filledItems(v.items))
  if (opts.deposit !== false && rows.length && isDepositTooLarge(total, v.depositPercent) && !e.depositPercent) e.deposit = 'Tổng đơn quá nhỏ để đặt cọc.'
  if (rows.length && total <= 0) e.items ??= 'Tổng giá trị đơn phải lớn hơn 0.'
  if (opts.minTotal !== undefined && rows.length && total < opts.minTotal) e.items ??= `Tổng mới không được nhỏ hơn tiền đã cọc (${formatMoney(opts.minTotal)}).`
  return e
}

import { now } from '@/lib/clock'
import { paths } from '@/routes/paths'
import type { Order, OrderContent, OrderItemInput, OrderUnit } from '@/types/vendorOrder'
import { DEPOSIT_ROUNDING } from './constants'

/** Hạng mục đang nhập trong form: có thêm `key` để React theo dõi dòng. */
export interface FormItem extends OrderItemInput {
  key: string
}

/** Giá trị đang sửa trên form đơn. */
export interface OrderFormValues extends Omit<OrderContent, 'items'> {
  items: FormItem[]
}

let seq = 0
export const newItemKey = () => `it-${Date.now().toString(36)}-${++seq}`

/** Dòng hạng mục trống. Đơn vị "Gói" thì số lượng mặc định 1. */
export const newItem = (unit: OrderUnit = 'Gói'): FormItem => ({ key: newItemKey(), itemName: '', unit, quantity: 1, unitPrice: 0 })

export const isBlankItem = (i: OrderItemInput) => i.itemName.trim() === '' && !(i.unitPrice > 0)

/** Các dòng đã nhập (bỏ dòng trống). */
export const filledItems = <T extends OrderItemInput>(items: T[]) => items.filter((i) => i.itemName.trim() !== '' || i.unitPrice > 0)

export const itemAmount = (i: OrderItemInput) => (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0)
export const totalOf = (items: OrderItemInput[]) => items.reduce((s, i) => s + itemAmount(i), 0)

/** Tiền cọc ước tính = tổng × tỷ lệ / 100, làm tròn gần nhất đến 100.000đ, không vượt tổng. Số chính thức do backend tính. */
export const depositEstimate = (total: number, percent: number) =>
  percent > 0 && percent < 100 ? Math.min(total, Math.round((total * percent) / 100 / DEPOSIT_ROUNDING) * DEPOSIT_ROUNDING) : 0

const withKeys = (items: OrderItemInput[]): FormItem[] => (items.length ? items.map((i) => ({ ...i, key: newItemKey() })) : [newItem()])

/** Đơn mới: điền sẵn tên và số điện thoại khách; ngày sự kiện NCC tự nhập. */
export function emptyValues(customer: { name: string; phone: string }): OrderFormValues {
  return { customerName: customer.name, customerPhone: customer.phone, eventDate: '', note: null, depositPercent: 30, items: [newItem()] }
}

/** Nội dung hiện tại của đơn (để sửa). */
export function valuesOfOrder(o: Order): OrderFormValues {
  return {
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    eventDate: o.eventDate,
    note: o.note,
    depositPercent: o.depositPercent,
    items: withKeys(o.items.map(({ itemName, unit, quantity, unitPrice }) => ({ itemName, unit, quantity, unitPrice }))),
  }
}

/** "Tạo đơn mới từ đơn này" (đơn hết hạn): chép hạng mục và ghi chú, mã đơn mới, ngày sự kiện nhập lại. */
export function valuesFromOrder(o: Order): OrderFormValues {
  return { ...valuesOfOrder(o), eventDate: '' }
}

/** Bỏ `key`, gọn dòng trống: nội dung gửi lên API. */
export function toContent(v: OrderFormValues): OrderContent {
  return {
    customerName: v.customerName.trim(),
    customerPhone: v.customerPhone.trim(),
    eventDate: v.eventDate,
    note: v.note?.trim() || null,
    depositPercent: v.depositPercent,
    items: filledItems(v.items).map(({ itemName, unit, quantity, unitPrice }) => ({ itemName: itemName.trim(), unit, quantity, unitPrice })),
  }
}

/** Hai giá trị form có cùng nội dung không (bỏ khoảng trắng thừa, dòng trống). */
export const sameValues = (a: OrderFormValues, b: OrderFormValues) => JSON.stringify(toContent(a)) === JSON.stringify(toContent(b))

/** Trang Quản lý đơn hàng, mở sẵn đơn. */
export const orderPageHref = (orderId: string) => `${paths.vendor.orders}?order=${encodeURIComponent(orderId)}`

/** ISO -> "14:32 · 18/10" (giờ máy người dùng). */
export function formatStamp(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())} · ${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

/** "Hạn cọc: 21:00 26/10 · còn 5 giờ" (đã quá hạn thì "quá hạn"). */
export function depositDeadline(iso: string) {
  const due = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  const left = due.getTime() - now().getTime()
  const when = `${p(due.getHours())}:${p(due.getMinutes())} ${p(due.getDate())}/${p(due.getMonth() + 1)}`
  if (left <= 0) return `Hạn cọc: ${when} · đã quá hạn`
  const hours = Math.floor(left / 3_600_000)
  const minutes = Math.floor((left % 3_600_000) / 60_000)
  return `Hạn cọc: ${when} · còn ${hours > 0 ? `${hours} giờ` : `${Math.max(1, minutes)} phút`}`
}

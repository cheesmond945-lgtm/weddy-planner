import { now, todayVN } from '@/lib/clock'
import { formatDate, toISODate } from '@/lib/date'
import { paths } from '@/routes/paths'
import type { Order, OrderContent, OrderItemInput, OrderRevision, OrderUnit } from '@/types/vendorOrder'
import { CHANGE_LABEL, DEPOSIT_ROUNDING } from './constants'

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

/** "Tạo lại đơn" (đơn hết hạn): chép hạng mục và ghi chú, mã đơn mới, ngày sự kiện nhập lại. */
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

/** ISO -> "26/10" (giờ máy người dùng). */
export function formatDM(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}`
}

/** ISO -> "dd/MM/yyyy" (giờ máy người dùng). */
export const formatDay = (iso: string) => formatDate(toISODate(new Date(iso)))

/** ISO -> "14:32 18/10/2026". */
export function formatDayTime(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())} ${formatDay(iso)}`
}

/** Yêu cầu chỉnh sửa của khách đang chờ NCC (trước cọc, hoặc sau cọc). */
export const openRevision = (o: Pick<Order, 'revisions'>): OrderRevision | undefined => o.revisions.find((r) => r.status === 'Requested')

/** "Đổi số lượng, Đổi ngày thực hiện" */
export const changesLabel = (r: Pick<OrderRevision, 'changes'>) => r.changes.map((c) => CHANGE_LABEL[c]).join(', ')

/** Đã qua ngày diễn ra sự kiện (giờ Việt Nam): được đánh dấu hoàn thành. */
export const eventPassed = (o: Pick<Order, 'eventDate'>) => todayVN() > o.eventDate

/** Mốc hệ thống tự hoàn thành: hết ngày EventDate + 7. */
export const autoCompleteDay = (o: Pick<Order, 'eventDate'>) => {
  const [y, m, d] = o.eventDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10)
}

/** Dòng gợi ý việc cần làm cho NCC (docs/api/THE_DON_HANG.md mục 4). */
export function orderHint(o: Order): { text: string; tone: 'info' | 'warn' | 'ok' } {
  const req = openRevision(o)
  switch (o.status) {
    case 'Draft':
      return { text: 'Bản nháp, khách chưa thấy.', tone: 'info' }
    case 'Pending':
      return { text: o.depositDueDate ? `Chờ khách thanh toán cọc · hạn ${depositDeadline(o.depositDueDate).replace('Hạn cọc: ', '').split(' · ')[0]}` : 'Chờ khách thanh toán cọc.', tone: 'info' }
    case 'NeedRevision':
      return { text: `Khách yêu cầu: ${req ? [changesLabel(req), req.requestNote].filter(Boolean).join(' · ') : 'chỉnh sửa đơn'}`, tone: 'warn' }
    case 'Expired':
      return { text: 'Đơn hết hạn vì khách chưa cọc.', tone: 'info' }
    case 'Deposited':
      return {
        text: req
          ? `Khách yêu cầu chỉnh sửa: ${[changesLabel(req), req.requestNote].filter(Boolean).join(' · ')}`
          : eventPassed(o)
            ? 'Đã qua ngày thực hiện. Bấm Hoàn tất khi đã xong dịch vụ.'
            : `Đã nhận cọc. Thực hiện ngày ${formatDate(o.eventDate)}.`,
        tone: req || eventPassed(o) ? 'warn' : 'ok',
      }
    case 'Completed':
      return { text: `Đã hoàn thành ngày ${o.completedDate ? formatDay(o.completedDate) : ''}. Đã tính hoa hồng.`, tone: 'ok' }
    case 'Cancelled':
      return { text: `Khách đã hủy đơn ngày ${o.cancelledDate ? formatDay(o.cancelledDate) : ''}.`, tone: 'warn' }
  }
}

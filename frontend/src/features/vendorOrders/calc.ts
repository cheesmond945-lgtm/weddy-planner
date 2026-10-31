import { now, todayVN } from '@/lib/clock'
import { formatDate } from '@/lib/date'
import { paths } from '@/routes/paths'
import type { Order, OrderContent, OrderItemInput, OrderRevision, OrderUnit } from '@/types/vendorOrder'
import { CANCEL_REASON, CHANGE_LABEL } from './constants'

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

const withKeys = (items: OrderItemInput[]): FormItem[] => (items.length ? items.map((i) => ({ ...i, key: newItemKey() })) : [newItem()])

/** Đơn mới: điền sẵn tên, số điện thoại và ngày thực hiện = ngày cưới của khách (NCC đổi được, nhưng không được sau ngày cưới). */
export function emptyValues(customer: { name: string; phone: string; weddingDate?: string | null }): OrderFormValues {
  return { customerName: customer.name, customerPhone: customer.phone, eventDate: customer.weddingDate ?? '', note: null, depositPercent: 30, items: [newItem()], packageId: null }
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
    packageId: o.package?.id ?? null,
  }
}

/**
 * "Tạo lại đơn" (đơn hết hạn, đã hủy): giữ nguyên thông tin đơn cũ, mã đơn mới. Ngày sự kiện đã qua hoặc sau ngày cưới của khách
 * thì thay bằng ngày cưới (còn ở phía sau), không có thì để trống cho NCC nhập lại.
 */
export function valuesFromOrder(o: Order): OrderFormValues {
  const v = valuesOfOrder(o)
  const today = todayVN()
  const wedding = o.weddingDate && o.weddingDate > today ? o.weddingDate : ''
  const ok = v.eventDate >= today && (!o.weddingDate || v.eventDate <= o.weddingDate)
  return { ...v, eventDate: ok ? v.eventDate : wedding }
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
    packageId: v.packageId ?? null,
  }
}

/** Hai giá trị form có cùng nội dung không (bỏ khoảng trắng thừa, dòng trống). */
export const sameValues = (a: OrderFormValues, b: OrderFormValues) => JSON.stringify(toContent(a)) === JSON.stringify(toContent(b))

/** Trang Quản lý đơn hàng, mở sẵn đơn. */
export const orderPageHref = (orderId: string) => `${paths.vendor.orders}?order=${encodeURIComponent(orderId)}`

const VN_FORMAT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })

/** Các phần ngày giờ của một thời điểm theo giờ Việt Nam (Asia/Ho_Chi_Minh), không phụ thuộc múi giờ máy người dùng. */
function vn(iso: string) {
  const o: Record<string, string> = {}
  for (const part of VN_FORMAT.formatToParts(new Date(iso))) o[part.type] = part.value
  return { y: o.year, mo: o.month, d: o.day, h: o.hour === '24' ? '00' : o.hour, mi: o.minute }
}

/** ISO -> "14:32 · 18/10" (giờ Việt Nam). */
export function formatStamp(iso: string) {
  const t = vn(iso)
  return `${t.h}:${t.mi} · ${t.d}/${t.mo}`
}

/** "Hạn cọc: 21:00 26/10 · còn 5 giờ" (đã quá hạn thì "quá hạn"). */
export function depositDeadline(iso: string) {
  const t = vn(iso)
  const left = new Date(iso).getTime() - now().getTime()
  const when = `${t.h}:${t.mi} ${t.d}/${t.mo}`
  if (left <= 0) return `Hạn cọc: ${when} · đã quá hạn`
  const hours = Math.floor(left / 3_600_000)
  const minutes = Math.floor((left % 3_600_000) / 60_000)
  return `Hạn cọc: ${when} · còn ${hours > 0 ? `${hours} giờ` : `${Math.max(1, minutes)} phút`}`
}

/** ISO -> "26/10" (giờ Việt Nam). */
export function formatDM(iso: string) {
  const t = vn(iso)
  return `${t.d}/${t.mo}`
}

/** ISO -> "dd/MM/yyyy" (giờ Việt Nam). */
export function formatDay(iso: string) {
  const t = vn(iso)
  return `${t.d}/${t.mo}/${t.y}`
}

/** ISO -> "14:32 18/10/2026" (giờ Việt Nam). */
export function formatDayTime(iso: string) {
  const t = vn(iso)
  return `${t.h}:${t.mi} ${t.d}/${t.mo}/${t.y}`
}

/** Yêu cầu chỉnh sửa của khách đang chờ NCC: trước cọc (đơn NeedRevision) hoặc sau cọc (đơn vẫn Deposited, AfterDeposit). */
export const openRevision = (o: Pick<Order, 'revisions'>): OrderRevision | undefined => o.revisions.find((r) => r.status === 'Requested')

/**
 * Khách được gửi yêu cầu chỉnh sửa: đơn chờ cọc; hoặc đơn đã cọc, còn trước ngày thực hiện, chưa có yêu cầu đang chờ
 * (tiền cọc giữ nguyên, NCC áp dụng bằng "Chỉnh sửa" hoặc từ chối).
 */
export const canRequestRevision = (o: Pick<Order, 'status' | 'eventDate' | 'revisions'>) =>
  o.status === 'Pending' || (o.status === 'Deposited' && todayVN() < o.eventDate && !openRevision(o))

/** "Đổi số lượng, Đổi ngày thực hiện" */
export const changesLabel = (r: Pick<OrderRevision, 'changes'>) => r.changes.map((c) => CHANGE_LABEL[c]).join(', ')

/** NCC hủy được đơn đã cọc khi hôm nay (giờ Việt Nam) còn trước ngày diễn ra sự kiện. */
export const canCancel = (o: Pick<Order, 'status' | 'eventDate'>) => o.status === 'Deposited' && todayVN() < o.eventDate

/** Đã qua ngày diễn ra sự kiện (giờ Việt Nam): được đánh dấu hoàn thành. */
export const eventPassed = (o: Pick<Order, 'eventDate'>) => todayVN() > o.eventDate

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
      if (req) return { text: `Khách yêu cầu chỉnh sửa (tiền cọc giữ nguyên): ${[changesLabel(req), req.requestNote].filter(Boolean).join(' · ')}`, tone: 'warn' }
      return {
        text: eventPassed(o) ? 'Đã qua ngày thực hiện. Bấm Hoàn tất khi đã xong dịch vụ.' : `Đã nhận cọc. Thực hiện ngày ${formatDate(o.eventDate)}.`,
        tone: eventPassed(o) ? 'warn' : 'ok',
      }
    case 'Completed':
      return { text: `Đã hoàn thành ngày ${o.completedDate ? formatDay(o.completedDate) : ''}. Đã tính hoa hồng.`, tone: 'ok' }
    case 'Cancelled':
      return {
        text: `NCC đã hủy đơn ngày ${o.cancelledDate ? formatDay(o.cancelledDate) : ''}${o.cancelReason ? ` · Lý do: ${CANCEL_REASON[o.cancelReason].label}` : ''}.`,
        tone: 'warn',
      }
  }
}

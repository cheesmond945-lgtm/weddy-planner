/*
 * Chữ tóm tắt cho thẻ đơn phía khách (hàm thuần, có test): dòng hạng mục, chip hạn cọc, lý do ngắn của đơn hết hạn / hủy.
 * Thông tin đầy đủ (đơn giá từng dòng, sảnh, hai đợt thanh toán...) nằm trong màn "Xem chi tiết".
 */

interface ItemLike {
  itemName: string
  unit: string
  quantity: number
}

export interface ItemsSummary {
  /** Tên hạng mục đầu (bên trái, cắt "…" nếu dài) */
  name: string
  /** " + N hạng mục khác" khi đơn nhiều hạng mục, luôn hiện đủ; rỗng nếu chỉ một */
  more: string
  /** Số lượng + đơn vị của hạng mục đầu, vd "30 bàn" (bên phải, thẳng cột với số tiền); rỗng khi nhiều hạng mục */
  qty: string
}

/** Tách dòng hạng mục thành 2 cột: "Sảnh Vàng Cánh Bướm" | "30 bàn"; nhiều dòng: "<dòng đầu> + N hạng mục khác" | (trống). */
export function itemsSummaryParts(items: readonly ItemLike[]): ItemsSummary {
  if (!items.length) return { name: 'Chưa có hạng mục', more: '', qty: '' }
  const [first, ...rest] = items
  if (rest.length) return { name: first.itemName, more: ` + ${rest.length} hạng mục khác`, qty: '' }
  return { name: first.itemName, more: '', qty: `${first.quantity} ${first.unit.toLocaleLowerCase('vi')}` }
}

/** Cả dòng ở dạng một chuỗi ("Sảnh Vàng Cánh Bướm · 30 bàn"), dùng cho chữ thay thế / thông báo. */
export function itemsSummary(items: readonly ItemLike[]): string {
  const p = itemsSummaryParts(items)
  return `${p.name}${p.more}${p.qty ? ` · ${p.qty}` : ''}`
}

const VN = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour12: false, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const vnParts = (d: Date) => {
  const o: Record<string, string> = {}
  for (const p of VN.formatToParts(d)) o[p.type] = p.value
  return { day: o.day, month: o.month, minute: o.minute, hour: o.hour === '24' ? '00' : o.hour }
}

export interface DepositChip {
  text: string
  /** Còn dưới 6 giờ (hoặc đã quá hạn): chip đổi sang màu cảnh báo */
  urgent: boolean
  overdue: boolean
}

/** "Hạn đặt cọc còn 5 giờ (21:30 05/11)". `nowMs` để test. */
export function depositChip(dueIso: string, nowMs: number): DepositChip {
  const due = new Date(dueIso)
  const t = vnParts(due)
  const when = `${t.hour}:${t.minute} ${t.day}/${t.month}`
  const left = due.getTime() - nowMs
  if (left <= 0) return { text: `Đã quá hạn đặt cọc (${when})`, urgent: true, overdue: true }
  const hours = Math.floor(left / 3_600_000)
  const minutes = Math.max(1, Math.floor((left % 3_600_000) / 60_000))
  return { text: `Hạn đặt cọc còn ${hours > 0 ? `${hours} giờ` : `${minutes} phút`} (${when})`, urgent: left < 6 * 3_600_000, overdue: false }
}

/** Lý do ngắn trên dòng thu gọn của đơn hết hạn / đã hủy. */
export function endedReason(status: string, cancelReason?: string | null): string {
  if (status === 'Expired') return 'Quá hạn đặt cọc'
  if (cancelReason === 'VENDOR_UNABLE') return 'NCC không thể thực hiện, NCC hoàn cọc'
  if (!cancelReason) return 'Bạn đã hủy khi chưa đặt cọc'
  return 'Theo yêu cầu của bạn, cọc không hoàn'
}

interface DepositedLike {
  status: string
  eventDate: string
  cancelRequest?: { requestedDate: string } | null
  restPayment?: { status: 'Pending' | 'Received' | 'NotApplicable' } | null
  revisions: readonly { status: string; changes: readonly string[] }[]
}

/**
 * Nhãn trạng thái phía khách cho đơn đã cọc, thay "Đã đặt cọc" khi chữ đó dễ hiểu nhầm (null: giữ nhãn mặc định):
 * - khách đã gửi yêu cầu hủy, chờ NCC xác nhận (tối đa 24 giờ rồi hệ thống tự hủy): "Chờ NCC xác nhận hủy";
 * - đang có yêu cầu đổi ngày thực hiện chưa xử lý (vd khách dời ngày cưới): "Chờ NCC đổi ngày";
 * - đã qua ngày thực hiện, chưa thanh toán phần còn lại: "Chờ thanh toán phần còn lại";
 * - đã qua ngày thực hiện, đã thanh toán đủ: "Chờ NCC hoàn tất" (hệ thống tự hoàn thành sau 7 ngày).
 * `today`: "YYYY-MM-DD" giờ Việt Nam.
 */
export function depositedStatusLabel(o: DepositedLike, today: string): { label: string; tone: 'warn' | 'wait' } | null {
  if (o.status !== 'Deposited') return null
  if (o.cancelRequest) return { label: 'Chờ NCC xác nhận hủy', tone: 'warn' }
  if (o.revisions.some((r) => r.status === 'Requested' && r.changes.includes('EventDate'))) return { label: 'Chờ NCC đổi ngày', tone: 'warn' }
  if (today <= o.eventDate) return null
  return o.restPayment?.status === 'Pending' ? { label: 'Chờ thanh toán phần còn lại', tone: 'wait' } : { label: 'Chờ NCC hoàn tất', tone: 'wait' }
}

/** Yêu cầu hủy của khách quá từng này giờ mà NCC chưa đồng ý thì hệ thống tự hủy (khớp backend order-cancel.ts). */
export const CANCEL_REQUEST_AUTO_HOURS = 24

/**
 * Thời điểm hệ thống tự hủy đơn có yêu cầu hủy: 24 giờ sau lúc gửi, hoặc 0 giờ ngày thực hiện (giờ Việt Nam) nếu sớm hơn.
 * `requestedDate`: ISO lúc khách gửi; `eventDate`: "YYYY-MM-DD". Trả ISO.
 */
export function autoCancelAt(requestedDate: string, eventDate: string): string {
  const after = new Date(requestedDate).getTime() + CANCEL_REQUEST_AUTO_HOURS * 3_600_000
  const eventStart = new Date(`${eventDate}T00:00:00+07:00`).getTime()
  return new Date(Math.min(after, eventStart)).toISOString()
}

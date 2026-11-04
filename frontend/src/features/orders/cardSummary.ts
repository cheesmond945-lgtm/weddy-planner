/*
 * Chữ tóm tắt cho thẻ đơn phía khách (hàm thuần, có test): dòng hạng mục, chip hạn cọc, lý do ngắn của đơn hết hạn / hủy.
 * Thông tin đầy đủ (đơn giá từng dòng, sảnh, hai đợt thanh toán...) nằm trong màn "Xem chi tiết".
 */

interface ItemLike {
  itemName: string
  unit: string
  quantity: number
}

/** "Sảnh Vàng Cánh Bướm · 30 bàn"; gói số lượng 1 thì chỉ tên; nhiều dòng: "<dòng đầu> + N hạng mục khác". */
export function itemsSummary(items: readonly ItemLike[]): string {
  if (!items.length) return 'Chưa có hạng mục'
  const [first, ...rest] = items
  const qty = first.quantity > 1 || first.unit === 'Bàn' ? ` · ${first.quantity} ${first.unit.toLocaleLowerCase('vi')}` : ''
  const head = `${first.itemName}${qty}`
  return rest.length ? `${head} + ${rest.length} hạng mục khác` : head
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
  return 'Theo yêu cầu của bạn, cọc không hoàn'
}

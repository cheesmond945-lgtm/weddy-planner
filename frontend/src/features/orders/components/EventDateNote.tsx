import { formatDate } from '@/lib/date'
import type { Order } from '@/types/order'

/**
 * Dòng nhắc dưới "Ngày thực hiện" của thẻ đơn phía khách khi ngày thực hiện khác ngày cưới của khách (docs/TIMELINE.md mục 7).
 * Sau ngày cưới là lệch thật (đơn cũ hoặc khách đã đổi ngày cưới): đơn chưa cọc thì chưa cọc được. Trước ngày cưới chỉ nhắc nhẹ.
 * Chỉ với đơn còn hiệu lực (Pending, NeedRevision, Deposited) và khi backend trả ngày cưới.
 */
export function EventDateNote({ order }: { order: Pick<Order, 'status' | 'eventDate' | 'weddingDate'> }) {
  const { status, eventDate, weddingDate } = order
  if (!weddingDate || eventDate === weddingDate || !['Pending', 'NeedRevision', 'Deposited'].includes(status)) return null
  const after = eventDate > weddingDate
  const text = !after
    ? `Khác ngày cưới của bạn (${formatDate(weddingDate)}).`
    : status === 'Deposited'
      ? `Sau ngày cưới của bạn (${formatDate(weddingDate)}). Nhắn nhà cung cấp trong chat để đổi ngày thực hiện.`
      : `Sau ngày cưới của bạn (${formatDate(weddingDate)}) nên bạn chưa đặt cọc được. Bấm "Yêu cầu chỉnh sửa" và chọn "Đổi ngày thực hiện".`
  return <div className={after ? 'border-b border-dashed border-line py-1.5 text-[12.5px] text-warn' : 'border-b border-dashed border-line py-1.5 text-[12.5px] text-muted-foreground'}>{text}</div>
}

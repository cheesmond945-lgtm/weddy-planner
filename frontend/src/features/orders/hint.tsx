import type { ReactNode } from 'react'
import { changesLabel, openRevision } from '@/features/vendorOrders/calc'
import { formatMoney } from '@/lib/format'
import type { Order } from '@/types/order'

/** Yêu cầu đang chờ NCC: "Đã gửi yêu cầu…" + nhắc lại nội dung. */
function requestHint(o: Order, title: string): ReactNode {
  const r = openRevision(o)
  return (
    <>
      <b className="font-semibold">{title}</b>
      {r && (
        <>
          <br />
          <span className="text-muted-foreground">Nội dung: {[changesLabel(r), r.requestNote ? `"${r.requestNote}"` : ''].filter(Boolean).join(' · ')}</span>
        </>
      )}
    </>
  )
}

/** Dòng gợi ý phía khách theo trạng thái (docs/THE_DON_PHIA_KHACH.md mục 2); Pending không có ô gợi ý. Dùng ở thẻ đơn trong chat và trang Kế hoạch. */
export function hintOf(o: Order): ReactNode {
  switch (o.status) {
    case 'NeedRevision':
      return requestHint(o, 'Đã gửi yêu cầu chỉnh sửa, chờ NCC cập nhật.')
    case 'Deposited':
      if (openRevision(o)) return requestHint(o, 'Đã gửi yêu cầu chỉnh sửa, chờ NCC xử lý. Tiền cọc giữ nguyên.')
      return 'Đã đặt cọc. Muốn đổi, bấm Yêu cầu chỉnh sửa (tiền cọc giữ nguyên). Muốn hủy đơn, bạn nhắn NCC ngay trong chat.'
    case 'Completed':
      return 'Đơn đã hoàn thành.'
    case 'Expired':
      return 'Đơn đã hết hạn đặt cọc. Nhắn NCC nếu bạn vẫn muốn đặt.'
    case 'Cancelled':
      return o.cancelReason === 'VENDOR_UNABLE'
        ? 'NCC đã hủy đơn vì không thể thực hiện. NCC sẽ hoàn cọc cho bạn.'
        : `Đơn đã hủy theo yêu cầu của bạn. Khoản cọc ${formatMoney(o.depositAmount)} không được hoàn.`
    default:
      return null
  }
}

/** Màu ô gợi ý: đang chờ NCC (vàng), đã hủy (cam), còn lại (xanh). */
export const hintTone = (o: Order) =>
  o.status === 'NeedRevision' || openRevision(o) ? 'bg-[color-mix(in_srgb,var(--gold)_14%,var(--surface))]' : o.status === 'Cancelled' ? 'bg-warn-soft text-warn' : 'bg-sage-soft text-sage'

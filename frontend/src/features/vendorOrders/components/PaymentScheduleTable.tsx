import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order } from '@/types/vendorOrder'
import { useAuth } from '@/store/auth'
import { formatDay, formatDayTime } from '../calc'
import { restLabel, type Viewer } from '../restPayment'

const th = 'px-2.5 py-2 text-left align-bottom text-[11px] leading-tight font-medium tracking-[0.03em] text-muted-foreground uppercase'
const td = 'px-2.5 py-2.5 align-top text-[13px] leading-snug [overflow-wrap:anywhere]'

/** Phần trăm gọn: 30 -> "30%", 33.5 -> "33.5%". */
const pct = (n: number) => `${Math.round(n * 100) / 100}%`

interface State {
  text: string
  ok?: boolean
  /** Chưa nhận / chưa thanh toán: nhấn màu vàng */
  warn?: boolean
}

/** Trạng thái đợt 1 theo Payments và trạng thái đơn. */
function depositState(o: Order): State {
  if (o.payment?.status === 'Paid' && o.payment.paidDate) return { text: `Đã cọc ${formatDayTime(o.payment.paidDate)}`, ok: true }
  if (o.status === 'Draft') return { text: 'Chưa gửi đơn' }
  if (o.status === 'Expired') return { text: 'Hết hạn, chưa cọc' }
  return { text: 'Chưa cọc' }
}

/** Trạng thái đợt 2 theo ghi nhận của NCC (việc PAY Done), không còn suy từ trạng thái đơn. */
function restState(o: Order, viewer: Viewer): State {
  if (o.status === 'Cancelled') return { text: 'Không thu (khách đã hủy)' }
  const l = restLabel(o, viewer)
  if (l.tone === 'ok') return { text: viewer === 'VENDOR' ? l.text.replace('Đã nhận', 'Đã nhận tiền ·') : l.text, ok: true }
  return { text: l.text, warn: l.tone !== 'none' }
}

interface Row {
  name: string
  percent: string
  amount: string
  due: string
  method: string
  state: State
}

/**
 * Lịch thanh toán 2 đợt cố định, chỉ để xem (CSDL mục 9.6): Đợt 1 đặt cọc qua VietQR, Đợt 2 phần còn lại tiền mặt
 * ngoài hệ thống. Đây là lịch yêu cầu thanh toán, không phải tiền đã thu.
 * Màn rộng: bảng cố định độ rộng cột, chữ tự xuống dòng nên không cuộn ngang. Điện thoại: mỗi đợt một thẻ dọc.
 */
export function PaymentScheduleTable({ order: o }: { order: Order }) {
  const { user } = useAuth()
  const viewer: Viewer = user?.role === 'VENDOR' ? 'VENDOR' : 'COUPLE'
  const rest = o.totalAmount - o.depositAmount
  // Khách không thấy tỷ lệ cọc: tổng đổi sau cọc thì tỷ lệ không còn khớp số tiền cọc đã khóa, dễ gây thắc mắc; NCC vẫn thấy
  const showPct = viewer === 'VENDOR'
  const rows: Row[] = [
    {
      name: 'Đợt 1 · Đặt cọc',
      percent: pct(o.depositPercent),
      amount: formatMoney(o.depositAmount),
      due: o.depositDueDate ? formatDayTime(o.depositDueDate) : '12 giờ sau khi gửi đơn',
      method: 'VietQR (trực tuyến)',
      state: depositState(o),
    },
    {
      name: 'Đợt 2 · Thanh toán phần còn lại',
      percent: pct(100 - o.depositPercent),
      amount: formatMoney(rest),
      due: `Hạn chót: ${formatDate(o.eventDate)} (ngày cưới)${viewer === 'COUPLE' ? '. Bạn có thể trả sớm hơn.' : ''}`,
      method: 'Trả trực tiếp cho NCC',
      state: restState(o, viewer),
    },
  ]

  return (
    <div className="overflow-hidden rounded-md border border-line">
      {/* Màn rộng: bảng */}
      <table className="w-full table-fixed border-collapse max-md:hidden">
        <colgroup>
          <col className={showPct ? 'w-[19%]' : 'w-[22%]'} />
          {showPct && <col className="w-[9%]" />}
          <col className={showPct ? 'w-[16%]' : 'w-[18%]'} />
          <col className={showPct ? 'w-[19%]' : 'w-[22%]'} />
          <col className={showPct ? 'w-[18%]' : 'w-[18%]'} />
          <col className={showPct ? 'w-[19%]' : 'w-[20%]'} />
        </colgroup>
        <thead className="bg-surface-2">
          <tr>
            <th className={th}>Đợt</th>
            {showPct && <th className={th}>Tỷ lệ</th>}
            <th className={th}>Số tiền</th>
            <th className={th}>Hạn</th>
            <th className={th}>Phương thức</th>
            <th className={th}>Trạng thái</th>
          </tr>
        </thead>
        <tbody className="[&_tr+tr]:border-t [&_tr+tr]:border-line">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className={cn(td, 'font-semibold')}>{r.name}</td>
              {showPct && <td className={cn(td, 'tabular-nums')}>{r.percent}</td>}
              <td className={cn(td, 'font-semibold tabular-nums')}>{r.amount}</td>
              <td className={td}>{r.due}</td>
              <td className={td}>{r.method}</td>
              <td className={cn(td, r.state.ok && 'font-semibold text-sage', r.state.warn && 'font-semibold text-gold-ink')}>{r.state.text}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Điện thoại: mỗi đợt một thẻ dọc */}
      <ul className="divide-y divide-line md:hidden">
        {rows.map((r) => (
          <li key={r.name} className="px-3.5 py-3">
            <p className="mb-2 font-semibold">{r.name}</p>
            <dl className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
              {showPct && (
                <>
                  <dt className="text-muted-foreground">Tỷ lệ</dt>
                  <dd className="tabular-nums">{r.percent}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Số tiền</dt>
              <dd className="font-semibold tabular-nums">{r.amount}</dd>
              <dt className="text-muted-foreground">Hạn</dt>
              <dd>{r.due}</dd>
              <dt className="text-muted-foreground">Phương thức</dt>
              <dd>{r.method}</dd>
              <dt className="text-muted-foreground">Trạng thái</dt>
              <dd className={cn(r.state.ok && 'font-semibold text-sage', r.state.warn && 'font-semibold text-gold-ink')}>{r.state.text}</dd>
            </dl>
          </li>
        ))}
      </ul>

      <p className="border-t border-line bg-surface-2 px-3 py-2 text-[12.5px] text-muted-foreground">
        Hệ thống chỉ ghi nhận khoản cọc qua VietQR.{o.completedDate ? ` Hoàn thành ngày ${formatDay(o.completedDate)}.` : ''}
      </p>
    </div>
  )
}

import { AlertCircle, CheckCircle2, Circle } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order } from '@/types/vendorOrder'
import { formatDM } from '../calc'
import { vnDayMonth } from '../restPayment'

const pct = (n: number) => `${Math.round(n * 100) / 100}%`

/** Chữ trạng thái đợt 1: đã cọc thì "CK dd/mm" (chuyển khoản), chưa thì theo trạng thái đơn. */
function depositText(o: Order, paid: boolean) {
  if (paid) return `CK ${formatDM(o.payment!.paidDate!)}`
  if (o.status === 'Draft') return 'Chưa gửi'
  if (o.status === 'Expired') return 'Hết hạn'
  return 'Chưa cọc'
}

/**
 * Cột / ô "Thanh toán": hai dòng gọn, cùng cỡ chữ nhỏ, căn trái.
 *   Đợt 1: ✓ xanh / ○ xám · "Đợt 1 · 800.000đ (10%)" · xám "CK dd/mm" hoặc "Chưa cọc".
 *   Đợt 2: icon · "Đợt 2 · <tổng − cọc>đ" · xám "Tiền mặt" · trạng thái:
 *     Đã nhận dd/mm (✓ xanh) | Chưa nhận (○ vàng, đơn Deposited) | Chưa nhận (! cam, đơn Completed) | — (chưa cọc / hết hạn / đã hủy).
 * `onReceive` có thì chữ "Chưa nhận" bấm được (mở hộp xác nhận đã nhận tiền mặt).
 */
export function PaymentLines({ order: o, onReceive, className }: { order: Order; onReceive?: () => void; className?: string }) {
  const paid = o.payment?.status === 'Paid' && !!o.payment.paidDate
  const rest = o.restPayment
  const amount = rest?.amount ?? Math.max(0, o.totalAmount - o.depositAmount)
  const row = 'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] leading-snug'

  let restIcon = <Circle aria-hidden className="size-3.5 flex-none text-muted-foreground/60" />
  let restStatus: React.ReactNode = <span className="text-muted-foreground">—</span>
  if (rest?.status === 'Received') {
    restIcon = <CheckCircle2 aria-hidden className="size-3.5 flex-none text-sage" />
    restStatus = <span className="font-medium text-sage">Đã nhận{rest.receivedDate ? ` ${vnDayMonth(rest.receivedDate)}` : ''}</span>
  } else if (rest?.status === 'Pending') {
    // Cùng chữ "Chưa nhận", chỉ khác màu: vàng khi đơn đang thực hiện, cam khi đơn đã hoàn thành
    const completed = o.status === 'Completed'
    const tone = completed ? 'text-orange-600' : 'text-gold-ink'
    restIcon = completed ? <AlertCircle aria-hidden className="size-3.5 flex-none text-orange-600" /> : <Circle aria-hidden className="size-3.5 flex-none text-gold-ink" />
    restStatus = onReceive ? (
      <button
        type="button"
        onClick={(e) => {
          // Bấm "Chưa nhận" mở hộp xác nhận, không mở chi tiết đơn của dòng
          e.stopPropagation()
          onReceive()
        }}
        onKeyDown={(e) => e.stopPropagation()} className={cn('cursor-pointer font-medium hover:underline hover:underline-offset-2', tone)}>
        Chưa nhận
      </button>
    ) : (
      <span className={cn('font-medium', tone)}>Chưa nhận</span>
    )
  }

  return (
    <span className={cn('grid gap-1 text-left', className)}>
      <span className={row}>
        {paid ? <CheckCircle2 aria-hidden className="size-3.5 flex-none text-sage" /> : <Circle aria-hidden className="size-3.5 flex-none text-muted-foreground/60" />}
        <span className="font-medium whitespace-nowrap tabular-nums">
          Đợt 1 · {formatMoney(o.depositAmount)} ({pct(o.depositPercent)})
        </span>
        <span className={cn('whitespace-nowrap', paid ? 'text-muted-foreground' : 'text-muted-foreground')}>{depositText(o, paid)}</span>
      </span>
      <span className={row}>
        {restIcon}
        <span className="font-medium whitespace-nowrap tabular-nums">Đợt 2 · {formatMoney(amount)}</span>
        <span className="whitespace-nowrap text-muted-foreground">Trả trực tiếp</span>
        <span className="whitespace-nowrap">{restStatus}</span>
      </span>
    </span>
  )
}

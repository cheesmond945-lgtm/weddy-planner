import { CheckCircle2, Circle } from 'lucide-react'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Order } from '@/types/vendorOrder'

/**
 * Cột / ô "Thanh toán" ở danh sách đơn: chỉ hai dòng "Đợt 1 · số tiền" và "Đợt 2 · số tiền", mỗi dòng một biểu tượng:
 * ✓ xanh là đợt đó đã thu, ○ xám là chưa. Ngày thu, phương thức, tỷ lệ cọc nằm trong trang chi tiết đơn.
 */
export function PaymentLines({ order: o, className }: { order: Order; className?: string }) {
  const depositPaid = o.payment?.status === 'Paid' && !!o.payment.paidDate
  const rest = o.restPayment
  const restPaid = rest?.status === 'Received'
  const restAmount = rest?.amount ?? Math.max(0, o.totalAmount - o.depositAmount)

  const line = (paid: boolean, label: string, amount: number) => (
    <span className="flex items-center gap-1.5 text-[13px] leading-snug">
      {paid ? <CheckCircle2 aria-label="Đã thu" className="size-3.5 flex-none text-sage" /> : <Circle aria-label="Chưa thu" className="size-3.5 flex-none text-muted-foreground/60" />}
      <span className="font-medium whitespace-nowrap tabular-nums">
        {label} · {formatMoney(amount)}
      </span>
    </span>
  )

  return (
    <span className={cn('grid gap-1 text-left', className)}>
      {line(depositPaid, 'Đợt 1', o.depositAmount)}
      {line(restPaid, 'Đợt 2', restAmount)}
    </span>
  )
}

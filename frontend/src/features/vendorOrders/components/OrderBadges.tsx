import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/Badge'
import type { OrderStatus } from '@/types/vendorOrder'
import { ORDER_STATUS } from '../constants'
import { useOrderProgress } from '../hooks'

/** Nhãn có chấm hoặc dấu tích (badge trong prototype NCC). */
export function StatusBadge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <Badge tone={tone} className={className}>
      {tone === 'done' ? <Check className="size-3" /> : <i aria-hidden className="size-1.5 rounded-full bg-current opacity-75" />}
      {children}
    </Badge>
  )
}

/** "Chờ thanh toán cọc", "Đã đặt cọc"… theo 7 trạng thái của CSDL. `compact` (trong bảng): "Chờ thanh toán cọc" rút gọn thành "Chờ cọc". */
export function OrderStatusBadge({ status, className, compact }: { status: OrderStatus; className?: string; compact?: boolean }) {
  const { label, tone } = ORDER_STATUS[status]
  return (
    <StatusBadge tone={tone} className={className}>
      {compact && status === 'Pending' ? 'Chờ cọc' : label}
    </StatusBadge>
  )
}

/**
 * "Trễ tiến độ N": đơn đang thực hiện có việc của NCC (hoặc hai bên) quá hạn trên timeline (docs/TIMELINE.md mục 8.3).
 * Không hiện khi không trễ; dùng chung một truy vấn tiến độ cho mọi đơn trong danh sách.
 */
export function LateProgressBadge({ orderId, status, className }: { orderId: string; status: OrderStatus; className?: string }) {
  const { data } = useOrderProgress()
  const late = status === 'Deposited' ? (data?.[orderId]?.overdueVendor ?? 0) : 0
  if (!late) return null
  return (
    <Badge tone="warn" className={className}>
      Trễ tiến độ · {late}
    </Badge>
  )
}

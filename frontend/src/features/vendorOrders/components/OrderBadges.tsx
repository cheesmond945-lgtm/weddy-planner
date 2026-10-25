import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/Badge'
import type { OrderStatus } from '@/types/vendorOrder'
import { ORDER_STATUS } from '../constants'

/** Nhãn có chấm hoặc dấu tích (badge trong prototype NCC). */
export function StatusBadge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <Badge tone={tone} className={className}>
      {tone === 'done' ? <Check className="size-3" /> : <i aria-hidden className="size-1.5 rounded-full bg-current opacity-75" />}
      {children}
    </Badge>
  )
}

/** "Chờ thanh toán cọc", "Đã đặt cọc"… theo 7 trạng thái của CSDL. */
export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { label, tone } = ORDER_STATUS[status]
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}

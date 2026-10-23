import { Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge, type BadgeTone } from '@/components/Badge'
import type { ServiceOrder } from '@/types/serviceOrder'
import { orderStatusLabel } from '../constants'

/** Nhãn có chấm hoặc dấu tích (badge trong prototype NCC). */
export function StatusBadge({ tone, children }: { tone: BadgeTone; children: ReactNode }) {
  return (
    <Badge tone={tone}>
      {tone === 'done' ? <Check className="size-3" /> : <i aria-hidden className="size-1.5 rounded-full bg-current opacity-75" />}
      {children}
    </Badge>
  )
}

/** "Chờ khách xác nhận", "Đã xác nhận · Đã nhận cọc"… */
export function OrderStatusBadge({ order }: { order: Pick<ServiceOrder, 'status' | 'paymentStatus'> }) {
  const { label, tone } = orderStatusLabel(order)
  return <StatusBadge tone={tone}>{label}</StatusBadge>
}

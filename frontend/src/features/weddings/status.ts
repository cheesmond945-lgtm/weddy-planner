import type { BadgeTone } from '@/components/Badge'
import type { OrderStatus } from '@/types/order'
import type { PlanItemStatus } from '@/types/wedding'

// Nhãn tiếng Việt của enum (STATUS và oBadge trong prototype)
export const PLAN_STATUS: Record<PlanItemStatus, { label: string; tone: BadgeTone }> = {
  PLANNED: { label: 'Dự kiến', tone: 'neutral' },
  DISCUSSING: { label: 'Đang trao đổi', tone: 'talk' },
  AWAITING_DEPOSIT: { label: 'Chờ thanh toán cọc', tone: 'wait' },
  CONFIRMED: { label: 'Đã chốt', tone: 'done' },
}

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  SENT: { label: 'Chờ thanh toán cọc', tone: 'wait' },
  REVISION_REQUESTED: { label: 'Đang chỉnh sửa', tone: 'talk' },
  PAID: { label: 'Đã cọc', tone: 'done' },
}

import type { BadgeTone } from '@/components/Badge'
import type { PlanItemStatus } from '@/types/wedding'

// Nhãn tiếng Việt của enum (STATUS và oBadge trong prototype)
export const PLAN_STATUS: Record<PlanItemStatus, { label: string; tone: BadgeTone }> = {
  PLANNED: { label: 'Dự kiến', tone: 'neutral' },
  DISCUSSING: { label: 'Đang trao đổi', tone: 'talk' },
  AWAITING_DEPOSIT: { label: 'Chờ thanh toán cọc', tone: 'wait' },
  // Cùng chữ với trạng thái đơn ("Đã đặt cọc") để người dùng chỉ phải hiểu một bộ từ
  CONFIRMED: { label: 'Đã đặt cọc', tone: 'done' },
  COMPLETED: { label: 'Hoàn thành', tone: 'done' },
}

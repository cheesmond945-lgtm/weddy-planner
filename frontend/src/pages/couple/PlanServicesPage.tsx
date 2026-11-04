import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { ReviseOrderDialog } from '@/features/orders/components/ReviseOrderDialog'
import { useMyOrders } from '@/features/orders/hooks'
import { usePlanContext } from '@/features/weddings/components/PlanHub'
import { PlanSlots } from '@/features/weddings/components/PlanSlots'
import { usePlan } from '@/features/weddings/hooks'
import type { Order } from '@/types/order'

/**
 * Subtab Dịch vụ của Kế hoạch (5.1): dịch vụ đã chọn theo từng hạng mục và các đơn dịch vụ NCC đã gửi
 * cho hạng mục đó. Đơn mới, đơn đổi trạng thái hiện ngay nhờ realtime.
 */
export default function PlanServicesPage() {
  const { wedding } = usePlanContext()
  const plan = usePlan()
  const orders = useMyOrders()
  const [revising, setRevising] = useState<Order | null>(null)

  return (
    // Cùng bộ giao diện với tab Tổng quan / Ngân sách (plan-theme: nút xanh rêu, thẻ giấy, tiêu đề Playfair)
    <div className="plan-theme services-page">
      {plan.isPending ? (
        <div className="h-[360px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" />
      ) : plan.isError ? (
        <EmptyState
          title="Không tải được kế hoạch"
          description={plan.error.message}
          action={
            <Button variant="outline" onClick={() => plan.refetch()}>
              Thử lại
            </Button>
          }
        />
      ) : (
        <PlanSlots categorySlugs={plan.data.categorySlugs} items={plan.data.items} hasWedding orders={orders.data ?? []} onRevise={setRevising} guestCount={wedding.guestCount ?? 0} />
      )}
      <ReviseOrderDialog order={revising} onClose={() => setRevising(null)} />
    </div>
  )
}

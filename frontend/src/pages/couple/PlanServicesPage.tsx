import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { ReviseOrderDialog } from '@/features/orders/components/ReviseOrderDialog'
import { useMyOrders } from '@/features/orders/hooks'
import { usePlanContext } from '@/features/weddings/components/PlanHub'
import { PlanSlots } from '@/features/weddings/components/PlanSlots'
import { useBudget, usePlan } from '@/features/weddings/hooks'
import type { Order } from '@/types/order'

/**
 * Subtab Dịch vụ của Kế hoạch (5.1): dịch vụ đã chọn theo từng hạng mục và các đơn dịch vụ NCC đã gửi
 * cho hạng mục đó. Đơn mới, đơn đổi trạng thái hiện ngay nhờ realtime.
 */
export default function PlanServicesPage() {
  const { wedding } = usePlanContext()
  const plan = usePlan()
  const orders = useMyOrders()
  // Hạng mục tự lo (tiệc tự lo, dịch vụ bỏ khỏi phần chia ở tab Ngân sách): hiện "Tự lo" thay cho ô chưa chọn dịch vụ
  const budget = useBudget()
  const ownSlugs = (budget.data?.categories ?? []).filter((c) => c.status === 'OWN_VENUE' || c.status === 'EXCLUDED').map((c) => c.slug)
  const [revising, setRevising] = useState<Order | null>(null)

  return (
    // Cùng bộ giao diện với tab Tổng quan / Ngân sách (plan-theme: nút xanh rêu, thẻ giấy, tiêu đề Playfair)
    <div className="plan-theme services-page">
      {/* Lỗi tải đơn: báo rõ (không thì nút Thanh toán cọc và các dòng đơn biến mất mà không ai biết) */}
      {orders.isError && (
        <p role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-warn/40 bg-warn-soft px-4 py-3 text-sm text-warn">
          Chưa tải được đơn hàng: {orders.error.message}
          <Button variant="outline" size="sm" onClick={() => orders.refetch()}>
            Thử lại
          </Button>
        </p>
      )}
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
        <PlanSlots categorySlugs={plan.data.categorySlugs} items={plan.data.items} hasWedding orders={orders.data ?? []} onRevise={setRevising} guestCount={wedding.guestCount ?? 0} ownSlugs={ownSlugs} />
      )}
      <ReviseOrderDialog order={revising} onClose={() => setRevising(null)} />
    </div>
  )
}

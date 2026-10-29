import { useState } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { ReviseOrderDialog } from '@/features/orders/components/ReviseOrderDialog'
import { useMyOrders } from '@/features/orders/hooks'
import { PlanSlots } from '@/features/weddings/components/PlanSlots'
import { WeddingInfoCard } from '@/features/weddings/components/WeddingInfoCard'
import { usePlan, useWedding } from '@/features/weddings/hooks'
import type { Order } from '@/types/order'

/**
 * Trang Kế hoạch của tôi (5.1): thông tin đám cưới, dịch vụ đã chọn theo từng hạng mục và các đơn dịch vụ NCC đã gửi
 * cho hạng mục đó. Đơn mới, đơn đổi trạng thái hiện ngay nhờ realtime.
 */
export default function PlanPage() {
  const wedding = useWedding()
  const plan = usePlan()
  const orders = useMyOrders()
  const [revising, setRevising] = useState<Order | null>(null)

  return (
    <>
      <PageTitle
        title="Kế hoạch của tôi"
        description="Thông tin đám cưới, dịch vụ bạn đã chọn và đơn dịch vụ nhà cung cấp gửi cho từng hạng mục. Cọc qua VNPay trong 24 giờ, phần còn lại trả tiền mặt cho nhà cung cấp."
      />
      {wedding.isPending || plan.isPending ? (
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
        <>
          <WeddingInfoCard wedding={wedding.data ?? null} />
          <PlanSlots categorySlugs={plan.data.categorySlugs} items={plan.data.items} hasWedding={!!wedding.data} orders={orders.data ?? []} onRevise={setRevising} />
        </>
      )}
      <ReviseOrderDialog order={revising} onClose={() => setRevising(null)} />
    </>
  )
}

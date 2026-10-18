import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { PlanSlots } from '@/features/weddings/components/PlanSlots'
import { WeddingInfoCard } from '@/features/weddings/components/WeddingInfoCard'
import { usePlan, useWedding } from '@/features/weddings/hooks'

/** Trang Kế hoạch của tôi (5.1). */
export default function PlanPage() {
  const wedding = useWedding()
  const plan = usePlan()

  return (
    <>
      <PageTitle title="Kế hoạch của tôi" description="Thông tin đám cưới và các dịch vụ bạn đã chọn cho từng hạng mục." />
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
          <PlanSlots categorySlugs={plan.data.categorySlugs} items={plan.data.items} hasWedding={!!wedding.data} />
        </>
      )}
    </>
  )
}

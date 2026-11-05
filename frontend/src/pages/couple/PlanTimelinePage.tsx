import { usePlanContext } from '@/features/weddings/components/PlanHub'
import { TimelineView } from '@/features/weddings/components/TimelineView'

/** Subtab Timeline của Kế hoạch của tôi (cạnh Tổng quan). Chưa có thông tin đám cưới thì trang Kế hoạch đã hiện form thiết lập. */
export default function PlanTimelinePage() {
  const { wedding } = usePlanContext()
  return (
    // Cùng bộ giao diện với các tab khác của Kế hoạch (plan-theme: nút xanh rêu, thẻ giấy)
    <div className="plan-theme">
      <TimelineView wedding={wedding} />
    </div>
  )
}

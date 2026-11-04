import { usePlanContext } from '@/features/weddings/components/PlanHub'
import { TimelineView } from '@/features/weddings/components/TimelineView'

/** Subtab Timeline của Kế hoạch của tôi (cạnh Tổng quan). Chưa có thông tin đám cưới thì trang Kế hoạch đã hiện form thiết lập. */
export default function PlanTimelinePage() {
  const { wedding } = usePlanContext()
  return <TimelineView wedding={wedding} />
}

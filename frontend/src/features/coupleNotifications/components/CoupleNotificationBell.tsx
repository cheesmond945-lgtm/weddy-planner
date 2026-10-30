import { AlarmClock, ClipboardList, ListChecks, type LucideIcon } from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'
import { paths } from '@/routes/paths'
import type { VendorNotification } from '@/types/vendor'
import { useCoupleNotifications, useReadAllCoupleNotifications, useReadCoupleNotification } from '../hooks'

const ICON: Record<string, LucideIcon> = {
  OrderSent: ClipboardList,
  OrderCompleted: ClipboardList,
  OrderCancelled: ClipboardList,
  TaskUpdated: ListChecks,
  TaskDueSoon: AlarmClock,
  TaskOverdue: AlarmClock,
  TaskDigest: AlarmClock,
}

/** Thông báo đơn hàng dẫn tới kế hoạch của cặp đôi; thông báo việc (cập nhật, sắp hạn, quá hạn) dẫn tới timeline. */
const targetOf = (n: VendorNotification) => (n.type.startsWith('Task') ? paths.timeline : paths.plan)

/** Chuông thông báo ở header phía cặp đôi. */
export function CoupleNotificationBell() {
  const { data } = useCoupleNotifications()
  const read = useReadCoupleNotification()
  const readAll = useReadAllCoupleNotifications()
  return (
    <NotificationBell data={data} icons={ICON} targetOf={targetOf} onRead={(id) => read.mutate(id)} onReadAll={() => readAll.mutate()} readAllPending={readAll.isPending} />
  )
}

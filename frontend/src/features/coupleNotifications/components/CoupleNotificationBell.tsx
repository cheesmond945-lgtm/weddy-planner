import { AlarmClock, ClipboardList, ListChecks, MessageCircle, type LucideIcon } from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'
import { paths } from '@/routes/paths'
import type { VendorNotification } from '@/types/vendor'
import { useCoupleNotifications, useReadAllCoupleNotifications, useReadCoupleNotification } from '../hooks'

const ICON: Record<string, LucideIcon> = {
  NewMessage: MessageCircle,
  OrderSent: ClipboardList,
  OrderRevisionRejected: ClipboardList,
  OrderAdjustment: ClipboardList,
  RestPaymentReceived: ClipboardList,
  OrderCompleted: ClipboardList,
  OrderCancelled: ClipboardList,
  TaskUpdated: ListChecks,
  TaskWaiting: ListChecks,
  TaskScheduled: ListChecks,
  TaskDueSoon: AlarmClock,
  TaskOverdue: AlarmClock,
  TaskDigest: AlarmClock,
}

/** Tin nhắn mở đúng cuộc trò chuyện; đơn hàng dẫn tới tab Dịch vụ của kế hoạch; việc (cập nhật, hẹn ngày, sắp hạn, quá hạn) dẫn tới timeline; loại khác chỉ để đọc. */
function targetOf(n: VendorNotification): string | null {
  if (n.type === 'NewMessage') return n.refId ? `${paths.chat}?c=${encodeURIComponent(n.refId)}` : paths.chat
  if (n.type.startsWith('Task')) return paths.timeline
  if (n.type.startsWith('Order') || n.type === 'RestPaymentReceived') return paths.planTab.services
  return null
}

/** Chuông thông báo ở header phía cặp đôi. */
export function CoupleNotificationBell() {
  const { data } = useCoupleNotifications()
  const read = useReadCoupleNotification()
  const readAll = useReadAllCoupleNotifications()
  return (
    <NotificationBell data={data} icons={ICON} targetOf={targetOf} onRead={(id) => read.mutate(id)} onReadAll={() => readAll.mutate()} readAllPending={readAll.isPending} />
  )
}

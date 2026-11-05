import { AlarmClock, ClipboardCheck, ClipboardList, MessageCircle, Package, Wallet, type LucideIcon } from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'
import { orderPageHref } from '@/features/vendorOrders/calc'
import { paths } from '@/routes/paths'
import type { VendorNotification } from '@/types/vendor'
import { useReadAllVendorNotifications, useReadVendorNotification, useVendorNotifications } from '../hooks'

const ICON: Record<string, LucideIcon> = {
  VendorApproved: ClipboardCheck,
  VendorNeedRevision: ClipboardCheck,
  PackageApproved: Package,
  PackageNeedRevision: Package,
  CommissionPaid: Wallet,
  CommissionDueSoon: Wallet,
  CommissionOverdue: Wallet,
  OrderDeposited: ClipboardList,
  OrderCancelled: ClipboardList,
  OrderCompleted: ClipboardList,
  OrderAutoCompleteSoon: ClipboardList,
  OrderRevisionRequested: ClipboardList,
  OrderExpired: ClipboardList,
  OrderAdjustment: ClipboardList,
  RestPaymentReceived: ClipboardList,
  NewMessage: MessageCircle,
  WeddingDateChanged: ClipboardList,
  TaskDueSoon: AlarmClock,
  TaskOverdue: AlarmClock,
}

/** Trang xử lý mà thông báo dẫn tới; null = chỉ để đọc. */
function targetOf(n: VendorNotification): string | null {
  if (n.type === 'NewMessage') return n.refId ? `${paths.vendor.chat}?c=${encodeURIComponent(n.refId)}` : paths.vendor.chat
  if (n.type.startsWith('Vendor')) return paths.vendor.profile
  if (n.type.startsWith('Package')) return n.refId ? paths.vendor.package(n.refId) : paths.vendor.catalog
  if (n.type.startsWith('Commission')) return paths.vendor.commissions
  if (n.type === 'Availability' || n.refType === 'Availability') return paths.vendor.catalog
  if (n.refType === 'Order') return orderPageHref(n.refId ?? '')
  if (n.type.startsWith('Order') || n.type === 'WeddingDateChanged' || n.type === 'RestPaymentReceived') return paths.vendor.orders
  if (n.type.startsWith('Task')) return paths.vendor.calendar
  return null
}

/** Chuông thông báo ở header NCC. */
export function VendorNotificationBell() {
  const { data } = useVendorNotifications()
  const read = useReadVendorNotification()
  const readAll = useReadAllVendorNotifications()
  return (
    <NotificationBell data={data} icons={ICON} targetOf={targetOf} onRead={(id) => read.mutate(id)} onReadAll={() => readAll.mutate()} readAllPending={readAll.isPending} />
  )
}

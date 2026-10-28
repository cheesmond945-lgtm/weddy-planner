import { ClipboardCheck, ClipboardList, Package, Wallet, type LucideIcon } from 'lucide-react'
import { NotificationBell } from '@/components/NotificationBell'
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
}

/** Trang xử lý mà thông báo dẫn tới. */
function targetOf(n: VendorNotification) {
  if (n.type.startsWith('Vendor')) return paths.vendor.profile
  if (n.type.startsWith('Package')) return n.refId ? paths.vendor.package(n.refId) : paths.vendor.catalog
  if (n.type.startsWith('Commission')) return paths.vendor.commissions
  if (n.type.startsWith('Order')) return paths.vendor.orders
  return paths.vendor.dashboard
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

import { ClipboardCheck, Inbox, Lock, Package, Wallet, type LucideIcon } from 'lucide-react'
import { NotificationBell as Bell } from '@/components/NotificationBell'
import { paths } from '@/routes/paths'
import type { AdminNotification } from '@/types/admin'
import { useAdminNotifications, useReadAllNotifications, useReadNotification } from '../hooks'

const ICON: Record<string, LucideIcon> = { NewConsultationRequest: Inbox, VendorSubmitted: ClipboardCheck, VendorUpdated: ClipboardCheck, PackageSubmitted: Package, CommissionReceived: Wallet, CommissionOverdue: Wallet, CommissionLockable: Lock }

/** Trang và bộ lọc mà thông báo dẫn tới, để Admin xử lý ngay. */
function targetOf(n: AdminNotification) {
  switch (n.type) {
    case 'NewConsultationRequest':
      // Chuyển đúng bộ lọc theo trạng thái hiện tại của yêu cầu (đã liên hệ hay chưa, kết quả đánh giá, lĩnh vực) và làm nổi bật yêu cầu đó
      return n.refId && n.consultation
        ? `${paths.admin.consultationRequests}?lh=${n.consultation.isContacted ? 'YES' : 'NO'}&dg=${n.consultation.qualification}&linhvuc=${n.consultation.categorySlug}&mo=${n.refId}`
        : paths.admin.consultationRequests
    case 'VendorSubmitted':
    case 'VendorUpdated':
      return n.refId ? paths.admin.vendor(n.refId) : paths.admin.vendors
    case 'PackageSubmitted':
      return n.refId ? paths.admin.package(n.refId) : paths.admin.catalog
    case 'CommissionReceived':
    case 'CommissionOverdue':
      return n.refId ? paths.admin.payment(n.refId) : paths.admin.payments
    // Quá hạn đủ ngày theo điều khoản: Admin khóa tài khoản ở mục Người dùng
    case 'CommissionLockable':
      return paths.admin.users
    default:
      return paths.admin.dashboard
  }
}

/** Chuông thông báo ở header Admin. */
export function NotificationBell() {
  const { data } = useAdminNotifications()
  const read = useReadNotification()
  const readAll = useReadAllNotifications()
  return (
    <Bell data={data} icons={ICON} targetOf={targetOf} onRead={(id) => read.mutate(id)} onReadAll={() => readAll.mutate()} readAllPending={readAll.isPending} />
  )
}

import { Boxes, CreditCard, Inbox, LayoutDashboard, Percent, ReceiptText, Store, Users } from 'lucide-react'
import { paths } from '@/routes/paths'
import { DashboardLayout, type DashboardNavItem } from './DashboardLayout'

const NAV: DashboardNavItem[] = [
  { to: paths.admin.dashboard, label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: paths.admin.consultationRequests, label: 'Yêu cầu tư vấn', icon: Inbox },
  { to: paths.admin.vendors, label: 'Nhà cung cấp', icon: Store },
  { to: paths.admin.catalog, label: 'Dịch vụ và gói', icon: Boxes },
  { to: paths.admin.orders, label: 'Đơn dịch vụ', icon: ReceiptText },
  { to: paths.admin.payments, label: 'Thanh toán', icon: CreditCard },
  { to: paths.admin.commissions, label: 'Hoa hồng', icon: Percent },
  { to: paths.admin.users, label: 'Người dùng', icon: Users },
]

export function AdminLayout() {
  return <DashboardLayout area="Quản trị" nav={NAV} />
}

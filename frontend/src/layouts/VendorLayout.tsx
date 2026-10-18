import { Boxes, LayoutDashboard, MessageCircle, Percent, ReceiptText, Store } from 'lucide-react'
import { paths } from '@/routes/paths'
import { DashboardLayout, type DashboardNavItem } from './DashboardLayout'

const NAV: DashboardNavItem[] = [
  { to: paths.vendor.dashboard, label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: paths.vendor.profile, label: 'Hồ sơ NCC', icon: Store },
  { to: paths.vendor.catalog, label: 'Dịch vụ và gói', icon: Boxes },
  { to: paths.vendor.orders, label: 'Đơn dịch vụ', icon: ReceiptText },
  { to: paths.vendor.chat, label: 'Tin nhắn', icon: MessageCircle },
  { to: paths.vendor.commissions, label: 'Hoa hồng', icon: Percent },
]

export function VendorLayout() {
  return <DashboardLayout area="Nhà cung cấp" nav={NAV} />
}

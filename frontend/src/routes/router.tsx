import { createBrowserRouter } from 'react-router'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { CoupleLayout } from '@/layouts/CoupleLayout'
import { VendorLayout } from '@/layouts/VendorLayout'
import ForbiddenPage from '@/pages/ForbiddenPage'
import NotFoundPage from '@/pages/NotFoundPage'
import DepositTermsPreviewPage from '@/pages/preview/DepositTermsPreviewPage'
import TermsPreviewPage from '@/pages/preview/TermsPreviewPage'
import AdminAccountPage from '@/pages/admin/AdminAccountPage'
import AdminCatalogPage from '@/pages/admin/AdminCatalogPage'
import AdminCommissionsPage from '@/pages/admin/AdminCommissionsPage'
import AdminConsultationRequestsPage from '@/pages/admin/AdminConsultationRequestsPage'
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage'
import AdminOrdersPage from '@/pages/admin/AdminOrdersPage'
import AdminPackageDetailPage from '@/pages/admin/AdminPackageDetailPage'
import AdminPaymentDetailPage from '@/pages/admin/AdminPaymentDetailPage'
import AdminPaymentsPage from '@/pages/admin/AdminPaymentsPage'
import AdminUsersPage from '@/pages/admin/AdminUsersPage'
import AdminVendorDetailPage from '@/pages/admin/AdminVendorDetailPage'
import AdminVendorsPage from '@/pages/admin/AdminVendorsPage'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import SetPasswordPage from '@/pages/auth/SetPasswordPage'
import ChatPage from '@/pages/couple/ChatPage'
import ComparePage from '@/pages/couple/ComparePage'
import DealPage from '@/pages/couple/DealPage'
import FavoritesPage from '@/pages/couple/FavoritesPage'
import PlanPage from '@/pages/couple/PlanPage'
import ServiceDetailPage from '@/pages/couple/ServiceDetailPage'
import ServicesPage from '@/pages/couple/ServicesPage'
import TimelinePage from '@/pages/couple/TimelinePage'
import VendorCatalogPage from '@/pages/vendor/VendorCatalogPage'
import VendorChatPage from '@/pages/vendor/VendorChatPage'
import VendorCommissionsPage from '@/pages/vendor/VendorCommissionsPage'
import VendorDashboardPage from '@/pages/vendor/VendorDashboardPage'
import VendorOrdersPage from '@/pages/vendor/VendorOrdersPage'
import VendorPackagePage from '@/pages/vendor/VendorPackagePage'
import VendorProfilePage from '@/pages/vendor/VendorProfilePage'
import VendorAccountPage from '@/pages/vendor/VendorAccountPage'
import { RequireRole } from './RequireRole'
import { paths } from './paths'

export const router = createBrowserRouter([
  // TẠM THỜI: xem thử điều khoản, xóa sau
  { path: '/preview/terms', element: <TermsPreviewPage /> },
  { path: '/preview/deposit-terms', element: <DepositTermsPreviewPage /> },
  // Phía cặp đôi
  {
    element: <CoupleLayout />,
    children: [
      // Ai cũng xem được (như prototype)
      { path: paths.services, element: <ServicesPage /> },
      { path: '/services/:serviceId', element: <ServiceDetailPage /> },
      // Cần đăng nhập với role cặp đôi
      {
        element: <RequireRole roles={['COUPLE']} unauthenticated="dialog" />,
        children: [
          { path: paths.timeline, element: <TimelinePage /> },
          { path: paths.favorites, element: <FavoritesPage /> },
          { path: paths.compare, element: <ComparePage /> },
          { path: paths.plan, element: <PlanPage /> },
          { path: '/plan/deal/:dealId', element: <DealPage /> },
          { path: paths.chat, element: <ChatPage /> },
        ],
      },
    ],
  },

  // Xác thực
  {
    element: <AuthLayout />,
    children: [
      { path: paths.login, element: <LoginPage /> },
      { path: paths.register, element: <RegisterPage /> },
      { path: paths.setPassword, element: <SetPasswordPage /> },
    ],
  },

  // NCC
  {
    element: <RequireRole roles={['VENDOR']} />,
    children: [
      {
        element: <VendorLayout />,
        children: [
          { path: paths.vendor.dashboard, element: <VendorDashboardPage /> },
          { path: paths.vendor.profile, element: <VendorProfilePage /> },
          { path: paths.vendor.account, element: <VendorAccountPage /> },
          { path: paths.vendor.catalog, element: <VendorCatalogPage /> },
          { path: paths.vendor.packageNew, element: <VendorPackagePage /> },
          { path: '/vendor/catalog/:packageId', element: <VendorPackagePage /> },
          { path: paths.vendor.orders, element: <VendorOrdersPage /> },
          { path: paths.vendor.chat, element: <VendorChatPage /> },
          { path: paths.vendor.commissions, element: <VendorCommissionsPage /> },
        ],
      },
    ],
  },

  // Admin
  {
    element: <RequireRole roles={['ADMIN']} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: paths.admin.dashboard, element: <AdminDashboardPage /> },
          { path: paths.admin.consultationRequests, element: <AdminConsultationRequestsPage /> },
          { path: paths.admin.vendors, element: <AdminVendorsPage /> },
          { path: '/admin/vendors/:id', element: <AdminVendorDetailPage /> },
          { path: paths.admin.catalog, element: <AdminCatalogPage /> },
          { path: '/admin/catalog/:id', element: <AdminPackageDetailPage /> },
          { path: paths.admin.orders, element: <AdminOrdersPage /> },
          { path: paths.admin.payments, element: <AdminPaymentsPage /> },
          { path: '/admin/payments/:id', element: <AdminPaymentDetailPage /> },
          { path: paths.admin.commissions, element: <AdminCommissionsPage /> },
          { path: paths.admin.users, element: <AdminUsersPage /> },
          { path: paths.admin.account, element: <AdminAccountPage /> },
        ],
      },
    ],
  },

  { path: paths.forbidden, element: <ForbiddenPage /> },
  { path: '*', element: <NotFoundPage /> },
])

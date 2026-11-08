import type { ComponentType } from 'react'
import { createBrowserRouter } from 'react-router'
import { AdminLayout } from '@/layouts/AdminLayout'
import { AuthLayout } from '@/layouts/AuthLayout'
import { CoupleLayout } from '@/layouts/CoupleLayout'
import { VendorLayout } from '@/layouts/VendorLayout'
import { RedirectKeepSearch } from './RedirectKeepSearch'
import { GuestOrRole, RequireRole } from './RequireRole'
import { paths } from './paths'

/** Mỗi trang là một chunk riêng, chỉ tải khi người dùng vào trang đó (giảm bundle đầu). */
type PageModule = { default: ComponentType }
const page = (load: () => Promise<PageModule>) => async () => ({ Component: (await load()).default })

export const router = createBrowserRouter([
  // TẠM THỜI: xem thử điều khoản, xóa sau
  { path: '/preview/terms', lazy: page(() => import('@/pages/preview/TermsPreviewPage')) },
  { path: '/preview/deposit-terms', lazy: page(() => import('@/pages/preview/DepositTermsPreviewPage')) },
  // Phía cặp đôi (NCC, Admin đã đăng nhập không vào được, chuyển về trang quản lý)
  {
    element: <GuestOrRole roles={['COUPLE']} />,
    children: [
      {
        element: <CoupleLayout />,
        children: [
          // Ai cũng xem được (như prototype)
          { path: paths.services, lazy: page(() => import('@/pages/couple/ServicesPage')) },
          { path: '/services/:serviceId', lazy: page(() => import('@/pages/couple/ServiceDetailPage')) },
          // Cần đăng nhập với role cặp đôi
          {
            element: <RequireRole roles={['COUPLE']} />,
            children: [
              { path: paths.favorites, lazy: page(() => import('@/pages/couple/FavoritesPage')) },
              { path: paths.compare, lazy: page(() => import('@/pages/couple/ComparePage')) },
              // Kế hoạch của tôi: mỗi subtab một route con, reload hay dán link vẫn đúng tab
              {
                path: paths.plan,
                lazy: page(() => import('@/pages/couple/PlanLayoutPage')),
                children: [
                  // /plan: trang khung tự chuyển sang tab đầu tiên được xem
                  { index: true, element: null },
                  { path: paths.planTab.overview, lazy: page(() => import('@/pages/couple/PlanOverviewPage')) },
                  { path: paths.planTab.timeline, lazy: page(() => import('@/pages/couple/PlanTimelinePage')) },
                  { path: paths.planTab.services, lazy: page(() => import('@/pages/couple/PlanServicesPage')) },
                  { path: paths.planTab.budget, lazy: page(() => import('@/pages/couple/PlanBudgetPage')) },
                ],
              },
              // Link cũ /timeline (trang Lập Timeline trước đây) sang tab Timeline của Kế hoạch
              { path: '/timeline', element: <RedirectKeepSearch to={paths.timeline} /> },
              { path: paths.chat, lazy: page(() => import('@/pages/couple/ChatPage')) },
              { path: paths.account, lazy: page(() => import('@/pages/couple/CoupleAccountPage')) },
            ],
          },
        ],
      },
    ],
  },

  // Xác thực
  {
    element: <AuthLayout />,
    children: [
      { path: paths.login, lazy: page(() => import('@/pages/auth/LoginPage')) },
      { path: paths.register, lazy: page(() => import('@/pages/auth/RegisterPage')) },
      { path: paths.forgotPassword, lazy: page(() => import('@/pages/auth/ForgotPasswordPage')) },
      { path: paths.setPassword, lazy: page(() => import('@/pages/auth/SetPasswordPage')) },
    ],
  },

  // NCC
  {
    element: <RequireRole roles={['VENDOR']} />,
    children: [
      {
        element: <VendorLayout />,
        children: [
          { path: paths.vendor.dashboard, lazy: page(() => import('@/pages/vendor/VendorDashboardPage')) },
          { path: paths.vendor.profile, lazy: page(() => import('@/pages/vendor/VendorProfilePage')) },
          { path: paths.vendor.account, lazy: page(() => import('@/pages/vendor/VendorAccountPage')) },
          { path: paths.vendor.catalog, lazy: page(() => import('@/pages/vendor/VendorCatalogPage')) },
          { path: paths.vendor.packageNew, lazy: page(() => import('@/pages/vendor/VendorPackagePage')) },
          { path: '/vendor/catalog/:packageId', lazy: page(() => import('@/pages/vendor/VendorPackagePage')) },
          { path: paths.vendor.orders, lazy: page(() => import('@/pages/vendor/VendorOrdersPage')) },
          { path: '/vendor/orders/:orderId', lazy: page(() => import('@/pages/vendor/VendorOrderDetailPage')) },
          { path: paths.vendor.calendar, lazy: page(() => import('@/pages/vendor/VendorCalendarPage')) },
          { path: paths.vendor.chat, lazy: page(() => import('@/pages/vendor/VendorChatPage')) },
          { path: paths.vendor.commissions, lazy: page(() => import('@/pages/vendor/VendorCommissionsPage')) },
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
          { path: paths.admin.dashboard, lazy: page(() => import('@/pages/admin/AdminDashboardPage')) },
          { path: paths.admin.consultationRequests, lazy: page(() => import('@/pages/admin/AdminConsultationRequestsPage')) },
          { path: paths.admin.vendors, lazy: page(() => import('@/pages/admin/AdminVendorsPage')) },
          { path: '/admin/vendors/:id', lazy: page(() => import('@/pages/admin/AdminVendorDetailPage')) },
          { path: paths.admin.catalog, lazy: page(() => import('@/pages/admin/AdminCatalogPage')) },
          { path: '/admin/catalog/:id', lazy: page(() => import('@/pages/admin/AdminPackageDetailPage')) },
          { path: paths.admin.orders, lazy: page(() => import('@/pages/admin/AdminOrdersPage')) },
          { path: paths.admin.payments, lazy: page(() => import('@/pages/admin/AdminPaymentsPage')) },
          { path: '/admin/payments/:id', lazy: page(() => import('@/pages/admin/AdminPaymentDetailPage')) },
          { path: paths.admin.commissions, lazy: page(() => import('@/pages/admin/AdminCommissionsPage')) },
          { path: paths.admin.users, lazy: page(() => import('@/pages/admin/AdminUsersPage')) },
          { path: paths.admin.account, lazy: page(() => import('@/pages/admin/AdminAccountPage')) },
        ],
      },
    ],
  },

  // Xem kế hoạch qua link công khai: khung riêng, đầu trang chỉ có Đăng nhập và Đăng ký
  { path: '/xem/:token/:tab?', lazy: page(() => import('@/pages/PublicPlanPage')) },

  { path: '*', lazy: page(() => import('@/pages/NotFoundPage')) },
])

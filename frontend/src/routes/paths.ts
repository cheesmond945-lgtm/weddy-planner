import type { Role } from '@/types/auth'

/** Đường dẫn dùng chung, tránh viết chuỗi URL rải rác trong component. */
export const paths = {
  // Phía cặp đôi (theo prototype)
  services: '/',
  serviceDetail: (id: string | number) => `/services/${id}`,
  /** Timeline: tab trong Kế hoạch của tôi (cạnh Tổng quan); link cũ /timeline chuyển về đây */
  timeline: '/plan/timeline',
  favorites: '/favorites',
  compare: '/favorites/compare',
  /** Kế hoạch của tôi: vào /plan thì chuyển sang subtab Tổng quan */
  plan: '/plan',
  planTab: {
    overview: '/plan/tong-quan',
    timeline: '/plan/timeline',
    services: '/plan/dich-vu',
    budget: '/plan/ngan-sach',
  },
  deal: (id: string | number) => `/plan/deal/${id}`,
  chat: '/chat',
  /** Tài khoản của tôi (cặp đôi) */
  account: '/account',
  /** Xem kế hoạch qua link công khai */
  publicPlanTab: (token: string, tab: string) => `/xem/${token}/${tab}`,

  // Xác thực
  login: '/login',
  register: '/register',
  forgotPassword: '/forgot-password',
  setPassword: '/set-password',

  // NCC
  vendor: {
    dashboard: '/vendor',
    profile: '/vendor/profile',
    catalog: '/vendor/catalog',
    packageNew: '/vendor/catalog/new',
    package: (id: string) => `/vendor/catalog/${id}`,
    orders: '/vendor/orders',
    calendar: '/vendor/calendar',
    chat: '/vendor/chat',
    commissions: '/vendor/commissions',
    account: '/vendor/account',
  },

  // Admin
  admin: {
    dashboard: '/admin',
    consultationRequests: '/admin/consultation-requests',
    vendors: '/admin/vendors',
    vendor: (id: string) => `/admin/vendors/${id}`,
    catalog: '/admin/catalog',
    package: (id: string) => `/admin/catalog/${id}`,
    orders: '/admin/orders',
    payments: '/admin/payments',
    payment: (id: string) => `/admin/payments/${id}`,
    commissions: '/admin/commissions',
    users: '/admin/users',
    account: '/admin/account',
  },
} as const

/** Trang đầu tiên của từng role sau khi đăng nhập. */
export const homeOf: Record<Role, string> = {
  COUPLE: paths.services,
  VENDOR: paths.vendor.dashboard,
  ADMIN: paths.admin.dashboard,
}

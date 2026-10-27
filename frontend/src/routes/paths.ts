import type { Role } from '@/types/auth'

/** Đường dẫn dùng chung, tránh viết chuỗi URL rải rác trong component. */
export const paths = {
  // Phía cặp đôi (theo prototype)
  services: '/',
  serviceDetail: (id: string | number) => `/services/${id}`,
  timeline: '/timeline',
  favorites: '/favorites',
  compare: '/favorites/compare',
  plan: '/plan',
  deal: (id: string | number) => `/plan/deal/${id}`,
  chat: '/chat',

  // Xác thực
  login: '/login',
  register: '/register',
  setPassword: '/set-password',

  // NCC
  vendor: {
    dashboard: '/vendor',
    profile: '/vendor/profile',
    catalog: '/vendor/catalog',
    packageNew: '/vendor/catalog/new',
    package: (id: string) => `/vendor/catalog/${id}`,
    orders: '/vendor/orders',
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

  forbidden: '/403',
} as const

/** Trang đầu tiên của từng role sau khi đăng nhập. */
export const homeOf: Record<Role, string> = {
  COUPLE: paths.services,
  VENDOR: paths.vendor.dashboard,
  ADMIN: paths.admin.dashboard,
}

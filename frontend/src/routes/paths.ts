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
    orders: '/vendor/orders',
    chat: '/vendor/chat',
    commissions: '/vendor/commissions',
  },

  // Admin
  admin: {
    dashboard: '/admin',
    consultationRequests: '/admin/consultation-requests',
    vendors: '/admin/vendors',
    catalog: '/admin/catalog',
    orders: '/admin/orders',
    payments: '/admin/payments',
    commissions: '/admin/commissions',
    users: '/admin/users',
  },

  forbidden: '/403',
} as const

/** Trang đầu tiên của từng role sau khi đăng nhập. */
export const homeOf: Record<Role, string> = {
  COUPLE: paths.services,
  VENDOR: paths.vendor.dashboard,
  ADMIN: paths.admin.dashboard,
}

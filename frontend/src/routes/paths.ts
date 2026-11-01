import type { Role } from '@/types/auth'

/** Đường dẫn dùng chung, tránh viết chuỗi URL rải rác trong component. */
export const paths = {
  // Phía cặp đôi (theo prototype)
  services: '/',
  serviceDetail: (id: string | number) => `/services/${id}`,
  /** Tab Timeline đã bỏ; link cũ chuyển về Kế hoạch của tôi (còn dùng ở module đơn hàng) */
  timeline: '/plan/timeline',
  favorites: '/favorites',
  compare: '/favorites/compare',
  /** Kế hoạch của tôi: vào /plan thì chuyển sang subtab Tổng quan */
  plan: '/plan',
  planTab: {
    overview: '/plan/tong-quan',
    services: '/plan/dich-vu',
    budget: '/plan/ngan-sach',
    guests: '/plan/khach-moi',
  },
  deal: (id: string | number) => `/plan/deal/${id}`,
  chat: '/chat',
  /** Nhận lời mời cùng lập kế hoạch */
  invite: (token: string) => `/moi/${token}`,
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

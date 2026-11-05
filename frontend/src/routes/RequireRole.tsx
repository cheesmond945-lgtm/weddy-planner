import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/store/auth'
import type { Role } from '@/types/auth'
import { homeOf, paths } from './paths'

interface RequireRoleProps {
  roles: Role[]
}

/** Route guard theo role. Chưa đăng nhập thì sang /login (xong quay lại trang đang định vào), sai role thì về trang chủ của role đó. */
export function RequireRole({ roles }: RequireRoleProps) {
  const { user } = useAuth()
  const location = useLocation()
  const from = location.pathname + location.search

  if (!user) {
    return <Navigate to={paths.login} replace state={{ from }} />
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={homeOf[user.role]} replace />
  }
  return <Outlet />
}

/** Khu cặp đôi: khách chưa đăng nhập và cặp đôi xem được; NCC, Admin đã đăng nhập thì về trang quản lý của mình. */
export function GuestOrRole({ roles }: RequireRoleProps) {
  const { user } = useAuth()
  if (user && !roles.includes(user.role)) {
    return <Navigate to={homeOf[user.role]} replace />
  }
  return <Outlet />
}

import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '@/store/auth'
import type { Role } from '@/types/auth'
import { paths } from './paths'

interface RequireRoleProps {
  roles: Role[]
}

/** Route guard theo role. Chưa đăng nhập thì sang /login (xong quay lại trang đang định vào), sai role thì sang /403. */
export function RequireRole({ roles }: RequireRoleProps) {
  const { user } = useAuth()
  const location = useLocation()
  const from = location.pathname + location.search

  if (!user) {
    return <Navigate to={paths.login} replace state={{ from }} />
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={paths.forbidden} replace />
  }
  return <Outlet />
}

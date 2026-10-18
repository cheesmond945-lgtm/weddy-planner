import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { openAuthDialog } from '@/features/auth/authDialog'
import { useAuth } from '@/store/auth'
import type { Role } from '@/types/auth'
import { paths } from './paths'

interface RequireRoleProps {
  roles: Role[]
  /**
   * Khi chưa đăng nhập:
   * - 'dialog' (phía cặp đôi): về trang Dịch vụ cưới và mở modal đăng nhập, xong thì quay lại trang đang định vào.
   * - 'page' (NCC, Admin): sang trang /login.
   */
  unauthenticated?: 'dialog' | 'page'
}

/** Route guard theo role. Sai role thì sang /403. */
export function RequireRole({ roles, unauthenticated = 'page' }: RequireRoleProps) {
  const { user } = useAuth()
  const location = useLocation()
  const from = location.pathname + location.search

  if (!user) {
    return unauthenticated === 'dialog' ? (
      <RedirectWithAuthDialog redirectTo={from} />
    ) : (
      <Navigate to={paths.login} replace state={{ from }} />
    )
  }
  if (!roles.includes(user.role)) {
    return <Navigate to={paths.forbidden} replace />
  }
  return <Outlet />
}

function RedirectWithAuthDialog({ redirectTo }: { redirectTo: string }) {
  useEffect(() => openAuthDialog('login', redirectTo), [redirectTo])
  return <Navigate to={paths.services} replace />
}

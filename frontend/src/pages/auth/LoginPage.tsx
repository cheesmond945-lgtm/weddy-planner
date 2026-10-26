import { AlertTriangle } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { AuthTabs } from '@/features/auth/components/AuthTabs'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useAfterAuth } from '@/features/auth/useAfterAuth'
import { paths } from '@/routes/paths'

/** Trang đăng nhập riêng (vào thẳng khu vực NCC/Admin, hoặc bị chuyển về khi chưa đăng nhập). */
export default function LoginPage() {
  const location = useLocation()
  const state = location.state as { from?: string } | null
  const afterAuth = useAfterAuth()

  return (
    <>
      <h1 className="sr-only">Đăng nhập</h1>
      {state?.from && (
        <div role="alert" className="mb-5 flex items-center justify-center gap-2 rounded-lg border border-warn/30 bg-warn-soft px-4 py-3 text-sm font-medium text-warn">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          Vui lòng đăng nhập để tiếp tục.
        </div>
      )}
      <AuthTabs mode="login" hrefs={{ login: paths.login, register: paths.register }} linkState={state} />
      <LoginForm onSuccess={(session) => void afterAuth(session, 'Đăng nhập thành công', state?.from)} />
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{' '}
        <Link to={paths.register} state={state} replace className="font-semibold text-gold hover:underline">
          Đăng ký ngay
        </Link>
      </p>
    </>
  )
}

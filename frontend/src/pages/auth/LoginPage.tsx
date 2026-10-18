import { Link, useLocation } from 'react-router'
import { PageTitle } from '@/components/PageTitle'
import { LoginForm } from '@/features/auth/components/LoginForm'
import { useAfterAuth } from '@/features/auth/useAfterAuth'
import { paths } from '@/routes/paths'

/** Trang đăng nhập riêng, dùng khi vào thẳng khu vực NCC/Admin. Phía cặp đôi dùng modal. */
export default function LoginPage() {
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from
  const afterAuth = useAfterAuth()

  return (
    <>
      <PageTitle title="Đăng nhập" />
      <LoginForm onSuccess={(session) => void afterAuth(session, 'Đăng nhập thành công', from)} />
      <p className="mt-5 text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{' '}
        <Link to={paths.register} className="text-primary underline underline-offset-[3px]">
          Đăng ký
        </Link>
      </p>
    </>
  )
}

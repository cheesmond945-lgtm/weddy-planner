import { Link, Outlet } from 'react-router'
import { Brand } from '@/components/Brand'
import { paths } from '@/routes/paths'

/** Layout cho đăng nhập, đăng ký, đặt mật khẩu: thẻ ở giữa màn hình. */
export function AuthLayout() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Brand className="mb-6 text-[26px]" />
      <div className="w-full max-w-[520px] rounded-xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <Outlet />
      </div>
      <Link to={paths.services} className="mt-6 text-sm text-muted-foreground underline-offset-[3px] hover:text-gold hover:underline">
        ← Về trang dịch vụ
      </Link>
    </div>
  )
}

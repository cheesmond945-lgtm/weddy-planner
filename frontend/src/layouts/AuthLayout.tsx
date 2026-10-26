import { ArrowLeft } from 'lucide-react'
import { Link, Outlet } from 'react-router'
import authBg from '@/assets/auth-bg.jpg'
import { AuthBrandHeader } from '@/features/auth/components/AuthBrandHeader'
import { paths } from '@/routes/paths'

/** Layout đăng nhập / đăng ký / đặt mật khẩu: ảnh nền toàn màn hình, thẻ trắng ở giữa. */
export function AuthLayout() {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <img src={authBg} alt="" aria-hidden className="absolute inset-0 -z-20 size-full object-cover" />
      {/* Phủ mờ nhẹ để thẻ nổi bật, chữ đủ tương phản */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[color-mix(in_srgb,var(--ink)_28%,transparent)]" />

      <main className="w-full max-w-[470px] rounded-[20px] bg-[color-mix(in_srgb,var(--surface)_96%,transparent)] px-6 py-8 shadow-[0_24px_60px_rgb(var(--shadow-rgb)/0.35)] sm:px-10 sm:py-10">
        <AuthBrandHeader />
        <Outlet />
        <div className="mt-6 text-center">
          <Link to={paths.services} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold">
            <ArrowLeft className="size-4" aria-hidden />
            Quay lại Trang chủ
          </Link>
        </div>
      </main>
    </div>
  )
}

import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import tile1 from '@/assets/auth-1.jpg'
import tile2 from '@/assets/auth-2.jpg'
import tile3 from '@/assets/auth-3.jpg'
import tile4 from '@/assets/auth-4.jpg'
import panel1 from '@/assets/auth-panel-1.jpg'
import { AuthPosterHeader } from '@/features/auth/components/AuthPosterHeader'
import { AuthBubbleFlight, AuthBubbles } from '@/features/auth/components/AuthBubbles'
import { paths } from '@/routes/paths'

const TILES = [tile1, tile2, tile3, tile4]

/**
 * Layout đăng nhập / đăng ký / đặt mật khẩu.
 * Màn hình rộng: bên trái ảnh ghép 2×2 kèm tiêu đề "Chuyện đôi ta" và dòng nhỏ "Một lời hẹn ước, một đời chung bước", bên phải thẻ poster giữa nắng.
 * Bong bóng bay chéo cả màn hình từ góc dưới bên trái lên phía trên, nằm dưới thẻ form.
 * Điện thoại: nền kem xanh xám, bong bóng bay phía trên, thẻ trắng ở giữa.
 */
export function AuthLayout() {
  const { pathname } = useLocation()

  return (
    <div className="relative isolate min-h-dvh bg-bg lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Nửa trái: ảnh ghép đứng yên khi form dài phải cuộn */}
      <div className="hidden lg:sticky lg:top-0 lg:block lg:h-dvh">
        <LeftPage />
      </div>

      <AuthBubbleFlight />

      <AuthPage path={pathname}>
        <Outlet />
      </AuthPage>
    </div>
  )
}

/** Nửa trái: ảnh ghép 2×2 (các ô hiện dần khi mở trang) kèm tiêu đề. */
function LeftPage() {
  return (
    <div className="relative size-full overflow-hidden bg-[#0e130f]">
      <div aria-hidden className="grid size-full grid-cols-2 grid-rows-2 gap-[3px]">
        {TILES.map((src, i) => (
          <div key={src} className="overflow-hidden">
            <img src={src} alt="" className="size-full animate-auth-reveal object-cover" style={{ animationDelay: `${i * 0.18}s` }} />
          </div>
        ))}
      </div>
      {/* Tối nhẹ ở giữa cho chữ dễ đọc, viền tối kiểu phim ở mép */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(0_0_0/0.18)_0%,transparent_45%,rgb(0_0_0/0.4)_100%)]" />
      {/* Ánh vàng ấm rất nhẹ cho hợp tông ảnh cưới bên phải */}
      <div aria-hidden className="absolute inset-0 bg-[rgb(214_170_100/0.16)] mix-blend-soft-light" />

      {/* Tiêu đề chia theo đường ngang giữa 2 hàng ảnh: chữ lớn nằm trọn phía trên đường, vạch + chữ nhỏ phía dưới */}
      <div className="absolute inset-x-0 bottom-1/2 mb-3 px-8 text-center text-white">
        <p className="font-serif text-[clamp(40px,4.6vw,68px)] leading-none tracking-[0.14em] whitespace-nowrap uppercase [text-shadow:0_2px_18px_rgb(0_0_0/0.65)]">
          Chuyện đôi ta
        </p>
      </div>
      <div className="absolute inset-x-0 top-1/2 mt-3 px-8 text-center text-white">
        <div aria-hidden className="mx-auto flex w-56 items-center gap-3 text-[color-mix(in_srgb,var(--gold)_55%,white)]">
          <span className="h-px flex-1 bg-current opacity-70" />
          <span className="text-xs">✦</span>
          <span className="h-px flex-1 bg-current opacity-70" />
        </div>
        <p className="mt-3 text-xs tracking-[0.32em] text-white/85 uppercase [text-shadow:0_1px_10px_rgb(0_0_0/0.7)]">Một lời hẹn ước, một đời chung bước</p>
      </div>
    </div>
  )
}

/** Nửa phải: nền, bong bóng, đường kẻ dọc ở mép, thẻ poster chứa form. */
function AuthPage({ path, children }: { path: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      {/* Nền kem xanh xám lấy từ màu cỏ, rừng bên trái; bóng hoa ly giảm màu hắt như bóng trên tường; nắng nhẹ góc trên */}
      <div aria-hidden className="absolute inset-0 -z-20 bg-[linear-gradient(165deg,#f4eedd_0%,#dcd6bb_48%,#a9a585_100%)]" />
      <img src={panel1} alt="" aria-hidden className="absolute inset-0 -z-20 size-full object-cover object-[35%_50%] opacity-70 saturate-[0.45] sepia-[0.25] mix-blend-multiply" />
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_80%_0%,rgb(255_241_210/0.65)_0%,transparent_50%)]" />
      <AuthBubbles />

      {/* Mép phải kiểu tạp chí: đường kẻ dọc, ngôi sao, chữ dọc */}
      {/* Màu kem sáng + bóng tối mềm để nổi trên nền ảnh */}
      <div aria-hidden className="absolute top-8 right-7 bottom-8 hidden flex-col items-center gap-4 text-[#fbf4e2] [text-shadow:0_1px_6px_rgb(40_30_15/0.55)] lg:flex">
        <span className="font-serif text-xs font-semibold tracking-[0.4em] uppercase [writing-mode:vertical-rl]">Save the date</span>
        <span className="w-px flex-1 bg-[#fbf4e2]/70 shadow-[0_0_4px_rgb(40_30_15/0.4)]" />
        <span className="text-lg leading-none">✦</span>
        <span className="w-px flex-1 bg-[#fbf4e2]/70 shadow-[0_0_4px_rgb(40_30_15/0.4)]" />
        <span className="font-serif text-xs font-semibold tracking-[0.4em] uppercase [writing-mode:vertical-rl]">Chuyện của hai ta</span>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-6 lg:px-12 lg:py-6">
        {/* Thẻ như tờ poster giấy đặt trên nền */}
        <main className="relative z-[2] w-full max-w-[460px] rounded-[6px] bg-surface px-6 pt-6 pb-6 shadow-[0_2px_4px_rgb(60_40_20/0.08),0_28px_60px_rgb(60_40_20/0.28)] sm:px-9">
          <AuthPosterHeader compact={path === paths.register || path === paths.forgotPassword} />
          {children}
          <div className="mt-5 text-center [@media(max-height:820px)]:mt-3">
            <Link to={paths.services} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gold hover:underline">
              <ArrowLeft className="size-4" aria-hidden />
              Quay lại Trang chủ
            </Link>
          </div>
        </main>
      </div>
    </div>
  )
}

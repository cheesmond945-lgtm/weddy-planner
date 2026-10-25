import { CoupleNotificationBell } from '@/features/coupleNotifications/components/CoupleNotificationBell'
import { Heart, MessageCircle } from 'lucide-react'
import { useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatch, useNavigate } from 'react-router'
import { Brand } from '@/components/Brand'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { openAuthDialog } from '@/features/auth/authDialog'
import { AuthDialog } from '@/features/auth/components/AuthDialog'
import { ProfileDialog } from '@/features/auth/components/ProfileDialog'
import { compareStore } from '@/features/compare/store'
import { useConversations } from '@/features/chat/hooks'
import { useFavorites } from '@/features/favorites/hooks'
import { WeddingSetupDialog } from '@/features/weddings/components/WeddingDialogs'
import { usePlan } from '@/features/weddings/hooks'
import { ReplacePlanDialog } from '@/features/weddings/planActions'
import { cn } from '@/lib/utils'
import { homeOf, paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'

const NAV = [
  { to: paths.services, label: 'Dịch vụ cưới' },
  { to: paths.timeline, label: 'Lập Timeline' },
  { to: paths.favorites, label: 'Dịch vụ yêu thích' },
  { to: paths.plan, label: 'Kế hoạch của tôi' },
]

/** Số đếm trong nút menu (.cnt trong prototype). */
function NavCount({ value }: { value: number }) {
  if (!value) return null
  return <span className="rounded-pill bg-surface px-1.5 py-[3px] text-[10px] leading-none font-semibold text-gold">{value}</span>
}

/** Số đỏ trên nút nổi (.quick-count trong prototype). */
function QuickCount({ value }: { value: number }) {
  if (!value) return null
  return (
    <span className="absolute -top-[3px] -right-[3px] h-[17px] min-w-[17px] rounded-pill border border-white bg-notify px-1 text-center text-[10px] leading-[15px] font-semibold text-white">
      {value}
    </span>
  )
}

function navClass(active: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 py-2.5 text-xs font-medium transition-colors',
    active ? 'bg-primary text-primary-foreground shadow-pill' : 'text-nav hover:bg-accent-soft hover:text-gold',
  )
}

/**
 * Trang cần đăng nhập: chưa đăng nhập thì mở modal đăng nhập tại chỗ,
 * đăng nhập xong mới chuyển trang (như requireLogin trong prototype).
 */
function useRequireLogin() {
  const { user } = useAuth()
  return (to: string) => (e: MouseEvent) => {
    if (user) return
    e.preventDefault()
    openAuthDialog('login', to)
  }
}

function Header() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const requireLogin = useRequireLogin()
  const [profileOpen, setProfileOpen] = useState(false)
  const { favorites } = useFavorites()
  const { data: plan } = usePlan()
  const counts: Record<string, number> = { [paths.favorites]: favorites.length, [paths.plan]: plan?.items.length ?? 0 }

  // "Dịch vụ cưới" sáng cả khi đang xem chi tiết dịch vụ
  const isServices = pathname === paths.services || pathname.startsWith('/services/')

  function handleLogout() {
    logout()
    compareStore.clear()
    navigate(paths.services)
    window.scrollTo(0, 0)
    toast('Đã đăng xuất')
  }

  return (
    <header className="sticky top-0 z-30 bg-header px-3 py-2.5 backdrop-blur-md">
      <div className="mx-auto flex flex-wrap items-center gap-x-5 gap-y-2 rounded-3xl border border-line-soft bg-surface px-3.5 py-2 shadow-header md:flex-nowrap">
        <Brand />

        <nav
          aria-label="Điều hướng chính"
          className="order-3 flex min-w-0 basis-full gap-1 overflow-x-auto [scrollbar-width:none] md:order-none md:flex-1 md:basis-auto md:justify-center"
        >
          {NAV.map((item) =>
            item.to === paths.services ? (
              <Link key={item.to} to={item.to} aria-current={isServices ? 'page' : undefined} className={navClass(isServices)}>
                {item.label}
              </Link>
            ) : (
              <NavLink key={item.to} to={item.to} onClick={requireLogin(item.to)} className={({ isActive }) => navClass(isActive)}>
                {item.label}
                <NavCount value={counts[item.to] ?? 0} />
              </NavLink>
            ),
          )}
        </nav>

        <div className="ml-auto flex flex-none items-center gap-2 md:ml-0">
          {!user && (
            <>
              <Button variant="outline" size="sm" className="rounded-pill" onClick={() => openAuthDialog('login')}>
                Đăng nhập
              </Button>
              <Button size="sm" className="rounded-pill" onClick={() => openAuthDialog('register')}>
                Đăng ký
              </Button>
            </>
          )}
          {user && user.role !== 'COUPLE' && (
            <Button asChild variant="outline" size="sm" className="rounded-pill">
              <Link to={homeOf[user.role]}>Trang quản lý</Link>
            </Button>
          )}
          {user?.role === 'COUPLE' && <CoupleNotificationBell />}
          {user && (
            <>
              {user.role === 'COUPLE' && (
                <Button variant="outline" size="sm" className="rounded-pill" onClick={() => setProfileOpen(true)} title="Thông tin cá nhân">
                  <span className="max-w-[150px] truncate">{user.name}</span>
                </Button>
              )}
              <Button variant="outline" size="sm" className="rounded-pill" onClick={handleLogout}>
                Đăng xuất
              </Button>
            </>
          )}
        </div>
      </div>
      {user && <ProfileDialog user={user} open={profileOpen} onOpenChange={setProfileOpen} />}
    </header>
  )
}

function QuickActions({ hideOnMobile }: { hideOnMobile?: boolean }) {
  const requireLogin = useRequireLogin()
  const { favorites } = useFavorites()
  const { data: conversations } = useConversations()
  const base =
    'relative grid size-[46px] place-items-center rounded-full border shadow-fab transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-fab-hover max-sm:size-[42px] [&_svg]:size-[23px]'
  return (
    <div aria-label="Truy cập nhanh" className={cn('fixed right-[18px] bottom-[22px] z-40 flex flex-col items-center gap-2.5 max-sm:right-3 max-sm:bottom-3.5', hideOnMobile && 'max-md:hidden')}>
      <Link
        to={paths.favorites}
        onClick={requireLogin(paths.favorites)}
        aria-label="Dịch vụ yêu thích"
        title="Dịch vụ yêu thích"
        className={cn(base, 'border-line-soft bg-surface text-heart')}
      >
        <Heart />
        <QuickCount value={favorites.length} />
      </Link>
      <Link
        to={paths.chat}
        onClick={requireLogin(paths.chat)}
        aria-label="Tin nhắn"
        title="Tin nhắn"
        className={cn(base, 'border-primary bg-primary text-primary-foreground')}
      >
        <MessageCircle />
        <QuickCount value={conversations?.length ?? 0} />
      </Link>
    </div>
  )
}

function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-4 px-6 pb-8 text-[13px] text-muted-foreground max-sm:px-3.5">
      <span>© {new Date().getFullYear()} WebPlan. Nền tảng lập kế hoạch đám cưới.</span>
    </footer>
  )
}

/** Layout phía cặp đôi: header dạng viên thuốc, hai nút nổi, footer, modal đăng nhập (theo prototype). */
export function CoupleLayout() {
  // Trang tin nhắn: nội dung rộng hết màn hình và ẩn footer, như prototype
  const isChat = useMatch(paths.chat) !== null

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className={cn('mx-auto w-full flex-1', isChat ? 'px-7 pt-3.5 pb-7 md:pr-[84px] max-md:px-2' : 'max-w-content px-6 pt-6 pb-[70px] max-sm:px-3.5')}>
        <Outlet />
      </main>
      {!isChat && <Footer />}
      {/* Trang chat trên điện thoại: ẩn để không che nút gửi */}
      <QuickActions hideOnMobile={isChat} />
      <AuthDialog />
      <WeddingSetupDialog />
      <ReplacePlanDialog />
      <ScrollRestoration />
    </div>
  )
}

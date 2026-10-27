import { Heart, Menu, MessageCircle, X } from 'lucide-react'
import { useEffect, useState, type MouseEvent } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useMatch, useNavigate } from 'react-router'
import { Brand } from '@/components/Brand'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { ProfileDialog } from '@/features/auth/components/ProfileDialog'
import { compareStore } from '@/features/compare/store'
import { ChatPanel } from '@/features/chat/components/ChatPanel'
import { useUnreadMessages } from '@/features/chat/hooks'
import { useFavorites } from '@/features/favorites/hooks'
import { previewWeddingSetup, WeddingSetupDialog } from '@/features/weddings/components/WeddingDialogs'
import { usePlan } from '@/features/weddings/hooks'
import { ChatPanelResume, ReplacePlanDialog } from '@/features/weddings/planActions'
import { cn } from '@/lib/utils'
import { NotificationBell, PartnerButton, UserMenu } from './HeaderActions'
import { homeOf, paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'

const NAV = [
  { to: paths.services, label: 'Dịch vụ cưới' },
  { to: paths.timeline, label: 'Lập Timeline' },
  { to: paths.favorites, label: 'Dịch vụ yêu thích' },
  { to: paths.plan, label: 'Kế hoạch của tôi' },
]

/** Số đếm trong mục menu: badge tròn, chữ không giãn (.cnt trong prototype). */
function NavCount({ value }: { value: number }) {
  if (!value) return null
  return (
    <span className="inline-grid h-5 min-w-5 place-items-center rounded-pill bg-gold-100 px-1.5 font-sans text-xs leading-none font-semibold tracking-normal text-gold-800">
      {value}
    </span>
  )
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

// Chữ menu cùng kiểu nhãn "LẬP KẾ HOẠCH" ở trang đăng nhập: serif in hoa, giãn chữ
function navClass(active: boolean) {
  return cn(
    'inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-4 py-2.5 font-serif text-[13px] leading-[1.3] font-semibold tracking-[0.12em] uppercase transition-colors',
    active ? 'btn-gold' : 'text-ink-2 hover:bg-gold-100 hover:text-ink',
  )
}

/**
 * Trang cần đăng nhập: chưa đăng nhập thì sang trang /login,
 * đăng nhập xong mới chuyển tới trang định vào.
 */
function useRequireLogin() {
  const { user } = useAuth()
  const navigate = useNavigate()
  return (to: string) => (e: MouseEvent) => {
    if (user) return
    e.preventDefault()
    navigate(paths.login, { state: { from: to } })
  }
}

function Header() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const requireLogin = useRequireLogin()
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  // Chuyển trang thì đóng menu ☰
  useEffect(() => setMenuOpen(false), [pathname])
  const { favorites } = useFavorites()
  const { data: plan } = usePlan()
  const counts: Record<string, number> = { [paths.favorites]: favorites.length, [paths.plan]: plan?.items.length ?? 0 }
  // Tin chưa đọc chỉ hiện ở nút chat nổi và mục Tin nhắn trong menu tài khoản, tách khỏi số đếm kế hoạch
  const unreadMessages = useUnreadMessages()

  // Trang Dịch vụ cưới: lúc còn ở đầu trang, header nằm trên dải ảnh (trong suốt, chữ trắng); cuộn qua dải ảnh thì về header sáng
  const onPhotoPage = pathname === paths.services
  const [atTop, setAtTop] = useState(true)
  const [pastTop, setPastTop] = useState(false)
  useEffect(() => {
    const update = () => {
      setAtTop(window.scrollY < 300)
      setPastTop(window.scrollY > 8)
    }
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])
  const onPhoto = onPhotoPage && atTop
  // Đã cuộn khỏi đầu trang: viền vàng + bóng đậm để header tách khỏi các thẻ cùng màu kem bên dưới
  const scrolled = !onPhoto && pastTop

  // "Dịch vụ cưới" sáng cả khi đang xem chi tiết dịch vụ
  const isServices = pathname === paths.services || pathname.startsWith('/services/')

  function handleLogout() {
    logout()
    compareStore.clear()
    navigate(paths.services)
    window.scrollTo(0, 0)
    toast('Đã đăng xuất')
  }

  const navItems = NAV.map((item) =>
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
  )

  return (
    // Thanh dính cách đỉnh 12px, kính mờ: nội dung cuộn qua bị làm mờ hẳn
    <header className={cn('sticky top-3 z-30 px-3', onPhoto && 'header-on-photo')}>
      <div
        className={cn(
          'mx-auto max-w-content rounded-3xl border border-line bg-header backdrop-blur-[14px] transition-[background-color,border-color,box-shadow] duration-300',
          !onPhoto && 'shadow-header',
          scrolled && 'border-gold-500/45 shadow-[0_12px_32px_rgb(var(--shadow-rgb)/0.2)]',
        )}
      >
        <div className="flex items-center gap-4 px-3.5 py-2">
          <Brand />

          {/* Màn hình rộng: menu ngang ở giữa */}
          <nav aria-label="Điều hướng chính" className="hidden flex-1 justify-center gap-2 min-[1180px]:flex">
            {navItems}
          </nav>

          <div className="ml-auto flex flex-none items-center gap-2 min-[1180px]:ml-0">
            {!user && (
              <>
                <Button asChild variant="outline" size="sm" className="rounded-pill">
                  <Link to={paths.login}>Đăng nhập</Link>
                </Button>
                <Button asChild size="sm" className="rounded-pill">
                  <Link to={paths.register}>Đăng ký</Link>
                </Button>
              </>
            )}
            {user && user.role !== 'COUPLE' && (
              <Button asChild variant="outline" size="sm" className="rounded-pill">
                <Link to={homeOf[user.role]}>Trang quản lý</Link>
              </Button>
            )}
            {user && (
              <>
                {user.role === 'COUPLE' && <PartnerButton />}
                <NotificationBell />
                <span aria-hidden className="mx-1 h-7 w-px bg-line" />
                <UserMenu
                  user={user}
                  onProfile={user.role === 'COUPLE' ? () => setProfileOpen(true) : undefined}
                  unreadMessages={user.role === 'COUPLE' ? unreadMessages : undefined}
                  onLogout={handleLogout}
                />
              </>
            )}
            {/* Màn hình hẹp: chữ menu in hoa giãn rộng không đủ chỗ, gom vào nút ☰ */}
            <button
              type="button"
              aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={menuOpen}
              aria-controls="couple-nav-mobile"
              onClick={() => setMenuOpen((o) => !o)}
              className="grid size-11 place-items-center rounded-full text-ink hover:bg-gold-100 min-[1180px]:hidden"
            >
              {menuOpen ? <X className="size-[22px]" aria-hidden /> : <Menu className="size-[22px]" aria-hidden />}
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav id="couple-nav-mobile" aria-label="Điều hướng chính" className="flex flex-col gap-1 border-t border-line p-2 min-[1180px]:hidden">
            {navItems}
          </nav>
        )}
      </div>
      {user && <ProfileDialog user={user} open={profileOpen} onOpenChange={setProfileOpen} />}
    </header>
  )
}

function QuickActions({ hideClassName }: { hideClassName?: string }) {
  const requireLogin = useRequireLogin()
  const { favorites } = useFavorites()
  const unreadMessages = useUnreadMessages()
  const base =
    'relative grid size-[46px] place-items-center rounded-full border shadow-fab transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-fab-hover max-sm:size-[42px] [&_svg]:size-[23px]'
  return (
    <div aria-label="Truy cập nhanh" className={cn('fixed right-[18px] bottom-[22px] z-40 flex flex-col items-center gap-2.5 max-sm:right-3 max-sm:bottom-3.5', hideClassName)}>
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
        aria-label={unreadMessages ? `Tin nhắn, ${unreadMessages} chưa đọc` : 'Tin nhắn'}
        title="Tin nhắn"
        className={cn(base, 'btn-gold border-transparent')}
      >
        <MessageCircle />
        <QuickCount value={unreadMessages} />
      </Link>
    </div>
  )
}

function Footer() {
  return (
    <footer className="mx-auto flex w-full max-w-content flex-wrap items-center justify-between gap-4 px-[clamp(16px,4vw,32px)] pb-8 text-[13px] text-ink-2">
      <span>© {new Date().getFullYear()} WebPlan. Nền tảng lập kế hoạch đám cưới.</span>
    </footer>
  )
}

/** Layout phía cặp đôi: header dạng viên thuốc, hai nút nổi, footer, modal đăng nhập (theo prototype). */
export function CoupleLayout() {
  // Trang tin nhắn: nội dung rộng hết màn hình và ẩn footer, như prototype
  const isChat = useMatch(paths.chat) !== null
  // Chi tiết dịch vụ trên điện thoại (< 900px) có thanh nhắn tin cố định dưới đáy: ẩn nút nổi để không đè lên
  const isServiceDetail = useMatch('/services/:serviceId') !== null
  // Dev: thêm ?setup-wedding vào URL để mở hộp "Thiết lập thông tin đám cưới" mà làm giao diện
  const { search } = useLocation()
  useEffect(() => {
    if (import.meta.env.DEV && new URLSearchParams(search).has('setup-wedding')) previewWeddingSetup()
  }, [search])

  return (
    <div className="flex min-h-dvh flex-col">
      <Header />
      <main className={cn('mx-auto w-full flex-1', isChat ? 'px-7 pt-3.5 pb-7 md:pr-[84px] max-md:px-2' : 'max-w-content px-[clamp(16px,4vw,32px)] pt-8 pb-24')}>
        <Outlet />
      </main>
      {!isChat && <Footer />}
      {/* Trang chat trên điện thoại: ẩn để không che nút gửi */}
      <QuickActions hideClassName={isChat ? 'max-md:hidden' : isServiceDetail ? 'max-[900px]:hidden' : undefined} />
      <WeddingSetupDialog />
      <ReplacePlanDialog />
      <ChatPanel />
      <ChatPanelResume />
      <ScrollRestoration />
    </div>
  )
}

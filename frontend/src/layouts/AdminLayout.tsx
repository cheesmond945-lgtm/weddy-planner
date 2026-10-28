import type { LucideIcon } from 'lucide-react'
import { ChevronRight, CircleUserRound, ClipboardCheck, Handshake, Inbox, LayoutDashboard, LogOut, Menu, PieChart, Package, Users } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { applySavedTheme, ThemeToggle } from '@/components/ThemeToggle'
import { toast } from '@/components/ui/toast'
import { NotificationBell } from '@/features/adminNotifications/components/NotificationBell'
import { PartnerRegistrationDialog } from '@/features/partnerRegistration/components/PartnerRegistrationDialog'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'

interface AdminNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
  /** Tên trang chi tiết (đường dẫn con), hiện thêm vào đường dẫn phía trên tiêu đề */
  detail?: string
}

const NAV: AdminNavItem[] = [
  { to: paths.admin.dashboard, label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: paths.admin.consultationRequests, label: 'Yêu cầu tư vấn', icon: Inbox },
  { to: paths.admin.vendors, label: 'Quản lý hồ sơ', icon: ClipboardCheck, detail: 'Chi tiết hồ sơ' },
  { to: paths.admin.catalog, label: 'Quản lý gói dịch vụ', icon: Package, detail: 'Chi tiết gói dịch vụ' },
  { to: paths.admin.users, label: 'Quản lý người dùng', icon: Users },
  { to: paths.admin.payments, label: 'Quản lý thanh toán', icon: PieChart, detail: 'Chi tiết thanh toán' },
]

/** Đường dẫn "Trang chủ > Tên trang" phía trên tiêu đề, lấy từ NAV theo địa chỉ hiện tại. Trang tổng quan (trang chủ) không hiện. */
function Breadcrumb({ pathname }: { pathname: string }) {
  const page = NAV.find((n) => !n.end && (pathname === n.to || pathname.startsWith(`${n.to}/`)))
  if (!page) return null
  const detail = !!page.detail && pathname !== page.to
  return (
    <nav aria-label="Đường dẫn" className="mb-3 flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
      <Link to={paths.admin.dashboard} className="transition-colors hover:text-ink">
        Trang chủ
      </Link>
      <ChevronRight aria-hidden className="size-3.5" />
      {detail ? (
        <>
          <Link to={page.to} className="transition-colors hover:text-ink">
            {page.label}
          </Link>
          <ChevronRight aria-hidden className="size-3.5" />
          <span aria-current="page" className="font-medium text-gold-ink">
            {page.detail}
          </span>
        </>
      ) : (
        <span aria-current="page" className="font-medium text-gold-ink">
          {page.label}
        </span>
      )}
    </nav>
  )
}

/** Bật token màu cổng quản trị (dùng chung bộ màu NCC trong styles/vendor.css) trên <html>. */
function useAdminPortalTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.portal = 'admin'
    applySavedTheme()
    return () => {
      delete root.dataset.portal
      delete root.dataset.theme
    }
  }, [])
}

/** Chữ viết tắt từ tên: chữ đầu của từ đầu và từ cuối. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return picked.map((w) => w[0]).join('').toUpperCase()
}

function Avatar({ name, onSidebar }: { name: string; onSidebar?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'relative grid size-[38px] flex-none place-items-center rounded-full border font-sans text-[13px] font-semibold',
        onSidebar ? 'border-side-logo-border bg-(image:--side-logo-bg) text-side-logo-ink' : 'border-line-strong bg-(image:--logo-bg) text-gold-ink',
      )}
    >
      {initialsOf(name)}
      <i className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-surface bg-sage" />
    </span>
  )
}

function Wordmark() {
  const gold = 'bg-(image:--gold-grad) bg-clip-text text-transparent'
  return (
    <Link to={paths.admin.dashboard} aria-label="WebPlan, về trang tổng quan" className="block px-[26px] pt-7 pb-[22px]">
      <span className="block font-serif text-[32px] leading-none font-semibold tracking-[-0.01em] text-side-ink">
        Web<em className={cn('font-medium', gold)}>Plan</em>
        <span className={gold}>.</span>
      </span>
      <span className="mt-2.5 block text-[10.5px] tracking-[0.24em] text-side-muted uppercase">Admin panel</span>
    </Link>
  )
}

/** Bấm ảnh đại diện ở header: thả ra menu tài khoản (tên, email, Tài khoản của tôi, Đăng xuất). Bấm ra ngoài hoặc Esc để đóng. */
function AccountMenu({ onLogout }: { onLogout: () => void }) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => box.current && !box.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const item = 'flex w-full items-center gap-2.5 rounded-sm px-3 py-2 text-left text-[13.5px] text-ink transition-colors hover:bg-surface-2'
  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Tài khoản"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 rounded-pill text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <Avatar name={user.name} />
        <div className="leading-tight max-sm:hidden">
          <strong className="block max-w-[180px] truncate text-[13.5px] font-semibold">{user.name}</strong>
          <span className="text-[11.5px] text-muted-foreground">Quản trị viên</span>
        </div>
      </button>
      {open && (
        <div role="menu" className="absolute top-[calc(100%+8px)] right-0 z-40 w-[260px] rounded-md border border-line bg-surface p-1.5 shadow-portal">
          <div className="border-b border-line px-3 pt-2 pb-2.5">
            <p className="truncate text-[14px] font-semibold text-ink">{user.name}</p>
            {user.email && <p className="truncate text-[12.5px] text-muted-foreground">{user.email}</p>}
          </div>
          <div className="pt-1.5">
            <Link role="menuitem" to={paths.admin.account} onClick={() => setOpen(false)} className={item}>
              <CircleUserRound className="size-4 text-muted-foreground" />
              Tài khoản của tôi
            </Link>
            <button role="menuitem" type="button" onClick={() => (setOpen(false), onLogout())} className={item}>
              <LogOut className="size-4 text-muted-foreground" />
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Sidebar({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const { user } = useAuth()
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-side-border bg-(image:--side-grad) text-side-fg transition-transform duration-200 ease-out',
        'after:pointer-events-none after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-(image:--side-hairline)',
        open ? 'translate-x-0 shadow-[12px_0_40px_rgb(0_0_0/0.25)]' : '-translate-x-full',
        'min-[901px]:w-side min-[901px]:translate-x-0 min-[901px]:shadow-none',
      )}
    >
      <Wordmark />

      <nav aria-label="Điều hướng quản trị" className="grid gap-0.5 overflow-y-auto px-3.5 py-1.5">
        {NAV.map(({ to, label, icon: Icon, end }) => {
          return (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-sm px-3 py-[11px] text-[13.5px] transition-[background,color,padding] duration-300 hover:bg-side-2 hover:pl-4 hover:text-side-ink',
                  isActive &&
                    'bg-(image:--side-active) font-medium text-side-ink before:absolute before:inset-y-[9px] before:-left-3.5 before:w-[3px] before:rounded-r-[3px] before:bg-(image:--gold-grad)',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon strokeWidth={1.6} className={cn('size-[18px]', isActive ? 'text-side-gold' : 'text-side-muted')} />
                  {label}
                </>
              )}
            </NavLink>
          )
        })}
      </nav>

      {user && (
        <div className="mt-auto flex items-center gap-[11px] border-t border-side-divider px-[18px] pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <Avatar name={user.name} onSidebar />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] font-medium text-side-ink" title={user.name}>
              {user.name}
            </strong>
            <p className="truncate text-[11.5px] text-side-muted">Quản trị viên</p>
          </div>
        </div>
      )}
    </aside>
  )
}

function Header({ onOpenMenu, onLogout }: { onOpenMenu: () => void; onLogout: () => void }) {
  const [registerOpen, setRegisterOpen] = useState(false)
  return (
    <header className="sticky top-0 z-30 flex h-[62px] items-center gap-3.5 border-b border-line bg-header px-4 backdrop-blur-[10px] min-[901px]:px-7">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Mở menu"
        className="-ml-2 grid size-9 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-ink min-[901px]:hidden"
      >
        <Menu className="size-[18px]" />
      </button>

      <div className="ml-auto flex items-center gap-2.5">
        {/* Tạm đặt ở header Admin để thử form; sau này chuyển sang header giao diện khách hàng */}
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-pill border border-line-strong px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-gold-soft hover:text-gold-ink"
        >
          <Handshake className="size-4" />
          <span className="max-sm:hidden">Đăng ký hợp tác</span>
        </button>
        <PartnerRegistrationDialog open={registerOpen} onOpenChange={setRegisterOpen} />
        <ThemeToggle />
        <NotificationBell />
        <span aria-hidden className="mx-1 h-6 w-px bg-line max-sm:hidden" />
        <AccountMenu onLogout={onLogout} />
      </div>
    </header>
  )
}

/**
 * Layout cổng Admin: sidebar tối cùng màu với cổng NCC, header mảnh (giao diện sáng/tối, thông báo, tài khoản).
 * Màn hình ≤ 900px: sidebar thành menu trượt.
 */
export function AdminLayout() {
  useAdminPortalTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])

  function handleLogout() {
    logout()
    navigate(paths.login)
    toast('Đã đăng xuất')
  }

  return (
    <div className="min-h-dvh bg-(image:--portal-glow) bg-fixed">
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} />
      {menuOpen && <div aria-hidden className="fixed inset-0 z-39 bg-scrim min-[901px]:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="flex min-w-0 flex-col min-[901px]:pl-side">
        <Header onOpenMenu={() => setMenuOpen(true)} onLogout={handleLogout} />
        <main className="px-4 pt-[22px] pb-12 min-[901px]:px-7 min-[901px]:pt-[30px] min-[901px]:pb-[60px]">
          <div key={pathname} className="mx-auto max-w-portal animate-in duration-500 fade-in slide-in-from-bottom-3">
            <Breadcrumb pathname={pathname} />
            <Outlet />
          </div>
        </main>
      </div>
      <ScrollRestoration />
    </div>
  )
}

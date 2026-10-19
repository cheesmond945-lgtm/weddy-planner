import type { LucideIcon } from 'lucide-react'
import { Building2, ChevronRight, ClipboardList, ExternalLink, LayoutDashboard, LogOut, Menu, MessageSquare, Package, Wallet } from 'lucide-react'
import { useEffect, useLayoutEffect, useState } from 'react'
import { Link, matchPath, NavLink, Outlet, ScrollRestoration, useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'

interface VendorNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

// Icon theo prototype NCC
const NAV: VendorNavItem[] = [
  { to: paths.vendor.dashboard, label: 'Tổng quan', icon: LayoutDashboard, end: true },
  { to: paths.vendor.orders, label: 'Quản lý đơn hàng', icon: ClipboardList },
  { to: paths.vendor.chat, label: 'Tin nhắn', icon: MessageSquare },
  { to: paths.vendor.catalog, label: 'Quản lý dịch vụ', icon: Package },
  { to: paths.vendor.commissions, label: 'Tài chính & đối soát', icon: Wallet },
  { to: paths.vendor.profile, label: 'Hồ sơ nhà cung cấp', icon: Building2 },
]

/** Bật token màu NCC (styles/vendor.css) trên <html> khi đang ở cổng NCC. */
function useVendorPortalTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.portal = 'vendor'
    return () => {
      delete root.dataset.portal
    }
  }, [])
}

/** Chữ viết tắt từ tên: chữ đầu của từ đầu và từ cuối. */
function initialsOf(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words
  return picked.map((w) => w[0]).join('').toUpperCase()
}

/** Logo chữ viết tắt của NCC (.studio-logo trong prototype). */
function StudioLogo({ name, onSidebar }: { name: string; onSidebar?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'grid size-[38px] flex-none place-items-center rounded-full border font-serif text-[17px] font-semibold italic',
        onSidebar ? 'border-side-logo-border bg-(image:--side-logo-bg) text-side-logo-ink' : 'border-line-strong bg-(image:--logo-bg) text-gold-ink',
      )}
    >
      {initialsOf(name)}
    </span>
  )
}

/** Chữ WebPlan. trên sidebar, "Plan." ánh vàng (.wordmark trong prototype). */
function Wordmark() {
  const gold = 'bg-(image:--gold-grad) bg-clip-text text-transparent'
  return (
    <Link to={paths.vendor.dashboard} aria-label="WebPlan, về trang tổng quan" className="block px-[26px] pt-7 pb-[22px]">
      <span className="block font-serif text-[32px] leading-none font-semibold tracking-[-0.01em] text-side-ink">
        Web<em className={cn('font-medium', gold)}>Plan</em>
        <span className={gold}>.</span>
      </span>
      <span className="mt-2.5 block text-[10.5px] tracking-[0.24em] text-side-muted uppercase">Cổng nhà cung cấp</span>
    </Link>
  )
}

function Sidebar({ open, onNavigate, onLogout }: { open: boolean; onNavigate: () => void; onLogout: () => void }) {
  const { user } = useAuth()
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-40 flex w-[272px] flex-col border-r border-side-border bg-(image:--side-grad) text-side-fg transition-transform duration-200 ease-out',
        // Đường viền vàng mảnh mép phải
        'after:pointer-events-none after:absolute after:inset-y-0 after:-right-px after:w-px after:bg-(image:--side-hairline)',
        // Điện thoại, máy tính bảng: trượt ra từ trái
        open ? 'translate-x-0 shadow-[12px_0_40px_rgb(0_0_0/0.25)]' : '-translate-x-full',
        'min-[901px]:w-side min-[901px]:translate-x-0 min-[901px]:shadow-none',
      )}
    >
      <Wordmark />

      <nav aria-label="Điều hướng nhà cung cấp" className="grid gap-0.5 overflow-y-auto px-3.5 py-1.5">
        {NAV.map(({ to, label, icon: Icon, end }) => (
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
        ))}
      </nav>

      {user && (
        <div className="mt-auto flex items-center gap-[11px] border-t border-side-divider px-[18px] pt-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))]">
          <StudioLogo name={user.name} onSidebar />
          <div className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] font-medium text-side-ink" title={user.name}>
              {user.name}
            </strong>
            <p className="truncate text-[11.5px] text-side-muted">{user.email ?? user.phone ?? 'Nhà cung cấp'}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            aria-label="Đăng xuất"
            title="Đăng xuất"
            className="grid size-8 flex-none place-items-center rounded-sm text-side-muted transition-colors hover:bg-side-2 hover:text-side-ink"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </aside>
  )
}

function Header({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user } = useAuth()
  const { pathname } = useLocation()
  const current = NAV.find(({ to, end }) => matchPath({ path: to, end: !!end }, pathname))

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

      <div className="flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
        {user && <span className="truncate max-sm:hidden">{user.name}</span>}
        <ChevronRight className="size-3.5 flex-none max-sm:hidden" />
        <strong className="truncate font-medium text-ink">{current?.label ?? 'Tổng quan'}</strong>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <Button asChild variant="outline" size="sm" className="border-line-strong hover:border-gold hover:text-gold-ink max-sm:hidden">
          <Link to={paths.services}>
            <ExternalLink />
            Về website
          </Link>
        </Button>
        <span aria-hidden className="h-6 w-px bg-line max-sm:hidden" />
        {user && <StudioLogo name={user.name} />}
      </div>
    </header>
  )
}

/**
 * Layout cổng NCC theo docs/prototype/prototype_vendor: sidebar tối cố định bên trái,
 * header mảnh (đường dẫn trang) và vùng nội dung bên phải. Màn hình ≤ 900px: sidebar thành menu trượt.
 */
export function VendorLayout() {
  useVendorPortalTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // Menu trượt đang mở: Esc để đóng
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
      <Sidebar open={menuOpen} onNavigate={() => setMenuOpen(false)} onLogout={handleLogout} />
      {menuOpen && <div aria-hidden className="fixed inset-0 z-39 bg-scrim min-[901px]:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="flex min-w-0 flex-col min-[901px]:pl-side">
        <Header onOpenMenu={() => setMenuOpen(true)} />
        <main className="px-4 pt-[22px] pb-12 min-[901px]:px-7 min-[901px]:pt-[30px] min-[901px]:pb-[60px]">
          {/* key theo trang để chạy hiệu ứng hiện trang mỗi lần chuyển (.page-enter) */}
          <div key={pathname} className="mx-auto max-w-portal animate-in duration-500 fade-in slide-in-from-bottom-3">
            <Outlet />
          </div>
        </main>
      </div>
      <ScrollRestoration />
    </div>
  )
}

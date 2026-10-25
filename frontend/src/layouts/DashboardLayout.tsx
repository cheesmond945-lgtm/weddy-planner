import type { LucideIcon } from 'lucide-react'
import { LogOut } from 'lucide-react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import { Brand } from '@/components/Brand'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import { useAuth } from '@/store/auth'

export interface DashboardNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface DashboardLayoutProps {
  /** Tên khu vực, hiện dưới logo (ví dụ: Nhà cung cấp, Quản trị). */
  area: string
  nav: DashboardNavItem[]
}

/** Bố cục sidebar tối giản dùng chung cho NCC và Admin. */
export function DashboardLayout({ area, nav }: DashboardLayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate(paths.login)
  }

  const items = nav.map(({ to, label, icon: Icon, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors',
          isActive ? 'bg-primary text-primary-foreground shadow-pill' : 'text-nav hover:bg-accent-soft hover:text-gold',
        )
      }
    >
      <Icon className="size-4" />
      {label}
    </NavLink>
  ))

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <div className="px-5 pt-5 pb-4">
          <Brand to={nav[0]?.to ?? '/'} />
          <p className="mt-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{area}</p>
        </div>
        <nav aria-label={`Điều hướng ${area}`} className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
          {items}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 bg-header backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 md:px-8">
            <div className="md:hidden">
              <Brand to={nav[0]?.to ?? '/'} className="text-lg" />
            </div>
            <span className="hidden text-sm text-muted-foreground md:inline">{area}</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="max-w-[180px] truncate text-[13px] font-medium" title={user?.name}>
                {user?.name}
              </span>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut />
                Đăng xuất
              </Button>
            </div>
          </div>
          <nav aria-label={`Điều hướng ${area}`} className="flex gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] md:hidden">
            {items}
          </nav>
        </header>

        <main className="w-full max-w-6xl flex-1 px-4 py-6 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

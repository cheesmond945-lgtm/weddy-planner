import { LayoutDashboard, LayoutGrid, Pencil, Share2, UsersRound, Wallet, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { NavLink, useOutletContext } from 'react-router'
import { Button } from '@/components/ui/button'
import { daysBetween, formatDate, parseDate, today } from '@/lib/date'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { PlanTab, Wedding } from '@/types/wedding'
import type { PlanAccess } from '../access'
import { usePlan } from '../hooks'
import { ShareDialog } from './ShareDialog'

/** Dữ liệu trang Kế hoạch truyền xuống các subtab qua <Outlet context>. */
export interface PlanOutletContext {
  wedding: Wedding
  access: PlanAccess
  openEdit: () => void
}

/** Đám cưới đang dùng trong các subtab (trang khung đã chặn trường hợp chưa có đám cưới). */
export const usePlanContext = () => useOutletContext<PlanOutletContext>()

/** Đầu trang Kế hoạch: "Chú rể & Cô dâu", ngày cưới, số ngày còn lại, các nút (hubHead trong prototype). */
export function PlanHubHeader({ wedding, access, onEdit }: { wedding: Wedding; access: PlanAccess; onEdit: () => void }) {
  const left = Math.max(0, daysBetween(today(), parseDate(wedding.date)))
  const [sharing, setSharing] = useState(false)
  // Đám cưới tạo từ bản cũ có thể chưa có tên: hiện vai trò mờ thay cho tên
  const name = (value: string, fallback: string) => value || <span className="text-muted-foreground">{fallback}</span>

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-[18px]">
      <div>
        <h1 className="text-[clamp(30px,4.6vw,46px)] leading-[1.08] tracking-[-0.02em]">
          {name(wedding.groomName, 'Chú rể')}
          <span className="px-[0.22em] font-medium text-primary italic">&amp;</span>
          {name(wedding.brideName, 'Cô dâu')}
        </h1>
        <p className="mt-1.5 text-muted-foreground">
          <b className="font-semibold text-ink">{formatDate(wedding.date)}</b>, còn {left} ngày
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant={access.isOwner ? 'default' : 'outline'} size="sm" className="rounded-pill" onClick={() => setSharing(true)}>
          {access.isOwner ? <Share2 /> : <UsersRound />}
          {access.isOwner ? 'Chia sẻ kế hoạch' : 'Được chia sẻ'}
        </Button>
        <Button variant="outline" size="sm" className="rounded-pill" disabled={!access.canEdit} onClick={onEdit}>
          <Pencil />
          Chỉnh sửa thông tin
        </Button>
      </div>
      <ShareDialog open={sharing} onOpenChange={setSharing} access={access} />
    </div>
  )
}

export const PLAN_TAB_LINKS: { tab: PlanTab; to: string; label: string; icon: LucideIcon }[] = [
  { tab: 'overview', to: paths.planTab.overview, label: 'Tổng quan', icon: LayoutDashboard },
  { tab: 'services', to: paths.planTab.services, label: 'Dịch vụ', icon: LayoutGrid },
  { tab: 'budget', to: paths.planTab.budget, label: 'Ngân sách', icon: Wallet },
  { tab: 'guests', to: paths.planTab.guests, label: 'Khách mời', icon: UsersRound },
]

/** Thanh subtab của Kế hoạch (ptabs trong prototype): chỉ các tab được xem. Đổi tab không cuộn lại đầu trang. */
export function PlanTabs({ access }: { access: PlanAccess }) {
  const { data: plan } = usePlan()
  const counts: Partial<Record<PlanTab, number>> = { services: plan?.items.length ?? 0 }

  return (
    <nav
      aria-label="Các phần của kế hoạch"
      className="mb-6 flex gap-1 overflow-x-auto rounded-[22px] border border-line bg-accent-soft/60 p-[5px] [scrollbar-width:none]"
    >
      {PLAN_TAB_LINKS.filter((t) => access.canSee(t.tab)).map(({ tab, to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          preventScrollReset
          className={({ isActive }) =>
            cn(
              'group inline-flex min-w-max flex-[1_1_0] items-center justify-center gap-2.5 rounded-[17px] py-[9px] pr-5 pl-2.5 text-sm font-medium whitespace-nowrap transition-[background-color,color,box-shadow] max-sm:py-2 max-sm:pr-3.5 max-sm:pl-2 max-sm:text-[13px]',
              isActive ? 'bg-surface text-ink shadow-[0_5px_14px_rgb(var(--shadow-rgb)/0.12)]' : 'text-muted-foreground hover:text-ink',
            )
          }
        >
          <span className="grid size-[30px] place-items-center rounded-full bg-surface text-gold transition-colors group-aria-[current=page]:bg-gold group-aria-[current=page]:text-white max-sm:size-[26px]">
            <Icon aria-hidden className="size-4" />
          </span>
          {label}
          {!!counts[tab] && <span className="rounded-pill bg-accent-soft px-1.5 py-[3px] text-[10px] leading-none font-semibold text-gold">{counts[tab]}</span>}
        </NavLink>
      ))}
    </nav>
  )
}

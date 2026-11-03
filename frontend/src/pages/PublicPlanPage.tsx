import { useQuery } from '@tanstack/react-query'
import { Eye } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, useParams } from 'react-router'
import { sharingApi } from '@/api/sharing'
import { Badge } from '@/components/Badge'
import { Brand } from '@/components/Brand'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { PLAN_TAB_LABEL } from '@/features/weddings/access'
import { costSourceText } from '@/features/weddings/budgetView'
import { StatCard, StatGrid } from '@/features/weddings/components/StatCard'
import { PLAN_STATUS } from '@/features/weddings/status'
import { daysBetween, formatDate, formatShortDate, parseDate, today } from '@/lib/date'
import { formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { PublicTabData } from '@/types/sharing'
import type { PlanTab } from '@/types/wedding'

const card = 'rounded-lg border border-line bg-surface px-[22px] py-5'
const SIDE = { GROOM: 'Nhà trai', BRIDE: 'Nhà gái' } as const
const RSVP = { PENDING: 'Chưa phản hồi', ATTENDING: 'Sẽ đến', DECLINED: 'Từ chối' } as const

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={cn(card, 'flex flex-col gap-2.5')}>
      <h2 className="text-lg">{title}</h2>
      {children}
    </section>
  )
}

function OverviewView({ d }: { d: PublicTabData['overview'] }) {
  return (
    <div className="flex flex-col gap-4">
      <StatGrid className="mb-0">
        {d.tasks && <StatCard label="Công việc" value={`${d.tasks.done}/${d.tasks.total}`} sub={d.tasks.overdue ? `${d.tasks.overdue} việc quá hạn` : 'Chưa có việc nào quá hạn'} />}
        {d.budget && <StatCard label="Dự kiến chi" value={formatMoney(d.budget.planned)} sub={`Tổng ngân sách ${formatMoney(d.budget.total)}`} />}
        {d.guests && <StatCard label="Khách mời" value={`${formatNumber(d.guests.total)}/${formatNumber(d.guests.expected)}`} sub={`Đã mời ${formatNumber(d.guests.invited)}, sẽ đến ${formatNumber(d.guests.attending)}`} />}
      </StatGrid>
      {d.tasks && (
        <Section title="Việc sắp đến hạn">
          {d.tasks.upcoming.length ? (
            <ul>
              {d.tasks.upcoming.map((t) => (
                <li key={t.id} className="flex justify-between gap-3 border-t border-line py-2 text-sm first:border-t-0">
                  <span>{t.title}</span>
                  <span className={cn('whitespace-nowrap text-muted-foreground', t.daysLeft < 0 && 'font-semibold text-warn')}>{t.daysLeft < 0 ? `Quá hạn ${-t.daysLeft} ngày` : `Hạn ${formatShortDate(t.dueDate)}`}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Không còn việc nào cần làm.</p>
          )}
        </Section>
      )}
    </div>
  )
}

function ServicesView({ d }: { d: PublicTabData['services'] }) {
  if (!d.items.length) return <EmptyState title="Chưa chọn dịch vụ nào" />
  return (
    <div className="flex flex-col gap-2.5">
      {d.items.map((i) => (
        <div key={i.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-[18px] py-4">
          <div className="min-w-[200px] flex-1">
            <div className="text-[13px] text-muted-foreground">{i.service.category.name}</div>
            <b className="font-serif text-base font-semibold">{i.service.name}</b>
            <div className="text-[13px] text-muted-foreground">
              {i.packageName}
              {i.price !== null && `: ${formatMoney(i.price)}`}
            </div>
          </div>
          <Badge tone={PLAN_STATUS[i.status].tone}>{PLAN_STATUS[i.status].label}</Badge>
        </div>
      ))}
    </div>
  )
}

function BudgetView({ d }: { d: PublicTabData['budget'] }) {
  const t = d.totals
  return (
    <div className="flex flex-col gap-4">
      <StatGrid className="mb-0">
        <StatCard label="Tổng ngân sách" value={formatMoney(t.total)} />
        <StatCard label="Đã cọc" value={formatMoney(t.deposited)} />
        <StatCard label="Dự kiến chưa chốt" value={formatMoney(t.plannedTotal)} />
        <StatCard label={t.remaining < 0 ? 'Vượt ngân sách' : 'Còn lại'} value={formatMoney(Math.abs(t.remaining))} tone={t.remaining < 0 ? 'warn' : 'good'} />
      </StatGrid>
      <div className={cn(card, 'overflow-x-auto px-0 py-0')}>
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-[13px] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Hạng mục</th>
              <th className="px-3 py-2.5 font-medium">Dịch vụ</th>
              <th className="px-4 py-2.5 text-right font-medium">Chi phí</th>
            </tr>
          </thead>
          <tbody>
            {d.categories.map((c) => (
              <tr key={c.categoryId} className="border-t border-line align-top">
                <td className="px-4 py-2.5 font-medium">{c.name}</td>
                <td className="px-3 py-2.5">
                  {c.vendors.map((x) => x.name).join(', ') || <span className="text-muted-foreground">{c.status === 'OWN_VENUE' ? 'Tự lo tiệc' : 'Chưa chọn'}</span>}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {c.status === 'CHOSEN' || c.status === 'OWN_VENUE' ? formatMoney(c.cost) : <span className="text-muted-foreground">—</span>}
                  {c.vendors.map((v) => (
                    <div key={v.id} className="text-[12px] text-muted-foreground">
                      {costSourceText(v.costSource, v.deposited)}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function GuestsView({ d }: { d: PublicTabData['guests'] }) {
  const s = d.stats
  return (
    <div className="flex flex-col gap-4">
      <StatGrid className="mb-0">
        <StatCard label="Tổng khách" value={`${formatNumber(s.total)}/${formatNumber(s.expected)}`} />
        <StatCard label="Đã mời" value={formatNumber(s.invited)} />
        <StatCard label="Sẽ đến" value={formatNumber(s.attending)} tone="good" />
        <StatCard label="Từ chối" value={formatNumber(s.declined)} />
      </StatGrid>
      <div className={cn(card, 'overflow-x-auto px-0 py-0')}>
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead className="text-[13px] text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">Tên khách</th>
              <th className="px-3 py-2.5 font-medium">Bên</th>
              <th className="px-3 py-2.5 font-medium">Nhóm</th>
              <th className="px-3 py-2.5 text-center font-medium">Số người</th>
              <th className="px-4 py-2.5 font-medium">Phản hồi</th>
            </tr>
          </thead>
          <tbody>
            {d.items.map((g) => (
              <tr key={g.id} className="border-t border-line">
                <td className="px-4 py-2.5 font-medium">{g.fullName}</td>
                <td className="px-3 py-2.5">{SIDE[g.side]}</td>
                <td className="px-3 py-2.5">{g.group}</td>
                <td className="px-3 py-2.5 text-center">{g.partySize}</td>
                <td className="px-4 py-2.5">{g.isInvited ? RSVP[g.rsvp] : 'Chưa mời'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TabContent({ token, tab }: { token: string; tab: PlanTab }) {
  const q = useQuery({ queryKey: ['public-plan', token, tab], queryFn: () => sharingApi.getPublicTab(token, tab), retry: false })
  if (q.isPending) return <div className="h-[320px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" />
  if (q.isError) return <EmptyState title="Không tải được phần này" description={q.error.message} />
  const d = q.data as never
  if (tab === 'overview') return <OverviewView d={d} />
  if (tab === 'services') return <ServicesView d={d} />
  if (tab === 'budget') return <BudgetView d={d} />
  return <GuestsView d={d} />
}

/**
 * Xem kế hoạch qua link công khai (/xem/:token/:tab, docs/api/sharing.md mục 4): chỉ đọc, không cần đăng nhập.
 * Đầu trang chỉ có Đăng nhập và Đăng ký; chỉ hiện các tab cặp đôi cho phép (dữ liệu đã lọc ở backend).
 */
export default function PublicPlanPage() {
  const { token = '', tab } = useParams()
  const plan = useQuery({ queryKey: ['public-plan', token], queryFn: () => sharingApi.getPublicPlan(token), retry: false })

  const header = (
    <header className="sticky top-3 z-30 px-3">
      <div className="mx-auto flex max-w-content items-center gap-4 rounded-3xl border border-line bg-header px-3.5 py-2 shadow-header backdrop-blur-[14px]">
        <Brand />
        <div className="ml-auto flex gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-pill">
            <Link to={paths.login}>Đăng nhập</Link>
          </Button>
          <Button asChild size="sm" className="rounded-pill">
            <Link to={paths.register}>Đăng ký</Link>
          </Button>
        </div>
      </div>
    </header>
  )

  let body: ReactNode
  if (plan.isPending) body = <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" />
  else if (plan.isError) body = <EmptyState title="Không xem được kế hoạch" description={plan.error.message} />
  else {
    const p = plan.data
    // Tab Timeline đã bỏ khỏi giao diện
    const tabs: PlanTab[] = p.tabs.filter((t) => t !== 'timeline')
    const current = (tab ?? tabs[0]) as PlanTab
    if (!tabs.length) body = <EmptyState title="Không có phần nào để xem" description="Cặp đôi chưa chia sẻ phần nào qua liên kết này." />
    else if (!tab || !tabs.includes(current)) return <Navigate to={paths.publicPlanTab(token, tabs[0])} replace />
    const left = Math.max(0, daysBetween(today(), parseDate(p.wedding.date)))
    if (tabs.length) body = (
      <>
        <div role="note" className="mb-5 flex items-center gap-2.5 rounded-md bg-accent-soft px-4 py-3 text-sm text-gold-700">
          <Eye className="size-[18px] shrink-0" aria-hidden />
          Bạn đang xem kế hoạch này qua liên kết chia sẻ (chỉ xem).
        </div>
        <div className="mb-5">
          <h1 className="text-[clamp(30px,4.6vw,46px)] leading-[1.08] tracking-[-0.02em]">
            {p.wedding.groomName}
            <span className="px-[0.22em] font-medium text-primary italic">&amp;</span>
            {p.wedding.brideName}
          </h1>
          <p className="mt-1.5 text-muted-foreground">
            <b className="font-semibold text-ink">{formatDate(p.wedding.date)}</b>, còn {left} ngày
          </p>
        </div>
        <nav aria-label="Các phần của kế hoạch" className="mb-6 flex gap-1 overflow-x-auto rounded-[22px] border border-line bg-accent-soft/60 p-[5px]">
          {tabs.map((t) => (
            <NavLink
              key={t}
              to={paths.publicPlanTab(token, t)}
              preventScrollReset
              className={({ isActive }) => cn('flex-[1_1_0] rounded-[17px] px-4 py-2 text-center text-sm font-medium whitespace-nowrap', isActive ? 'bg-surface text-ink shadow-[0_5px_14px_rgb(var(--shadow-rgb)/0.12)]' : 'text-muted-foreground hover:text-ink')}
            >
              {PLAN_TAB_LABEL[t]}
            </NavLink>
          ))}
        </nav>
        <TabContent key={current} token={token} tab={current} />
      </>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col">
      {header}
      <main className="mx-auto w-full max-w-content flex-1 px-[clamp(16px,4vw,32px)] pt-8 pb-24">{body}</main>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { CHART_COLORS, Donut } from '@/features/weddings/components/Donut'
import { usePlanContext } from '@/features/weddings/components/PlanHub'
import { StackBar } from '@/features/weddings/components/StatCard'
import { SpendingServicesCard } from '@/features/weddings/components/SpendingServicesCard'
import { useOverview } from '@/features/weddings/hooks'
import { formatShortDate } from '@/lib/date'
import { formatMillions, formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Overview } from '@/types/wedding'

function Card({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-2.5 rounded-lg border border-line bg-surface px-[22px] py-5', className)}>
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const more = (to: string, label = 'Xem tất cả') => (
  <Link to={to} className="text-[13px] font-medium text-primary underline underline-offset-[3px]">
    {label}
  </Link>
)

const progress = (done: number, total: number) => (
  <div className="h-1.5 overflow-hidden rounded-[9px] bg-line" aria-hidden>
    <i className="block h-full bg-sage" style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
  </div>
)

/** "Còn n ngày" khi ≤ 7 ngày, "Quá hạn n ngày", "Hạn hôm nay", nếu không thì ngày (P2). */
function dueText(daysLeft: number, dueDate: string) {
  if (daysLeft < 0) return { text: `Quá hạn ${-daysLeft} ngày`, cls: 'font-semibold text-warn' }
  if (daysLeft === 0) return { text: 'Hạn hôm nay', cls: 'font-semibold text-warn' }
  if (daysLeft <= 7) return { text: `Còn ${daysLeft} ngày`, cls: 'font-semibold text-gold' }
  return { text: `Hạn ${formatShortDate(dueDate)}`, cls: 'text-muted-foreground' }
}

function TopCards({ data }: { data: Overview }) {
  const { tasks, budget, guests } = data
  return (
    <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4">
      {tasks && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface px-[22px] py-5">
          <span className="text-[13px] text-muted-foreground">Công việc</span>
          <span>
            <b className="font-serif text-[24px] font-semibold">{tasks.done}</b>/{tasks.total} việc đã xong
          </span>
          {progress(tasks.done, tasks.total)}
          <span className={cn('text-[13px]', tasks.overdue ? 'font-semibold text-warn' : 'text-muted-foreground')}>
            {tasks.overdue ? `${tasks.overdue} việc quá hạn` : 'Chưa có việc nào quá hạn'}
          </span>
        </div>
      )}
      {budget && (
        <Link to={paths.planTab.budget} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface px-[22px] py-5 hover:border-primary">
          <span className="text-[13px] text-muted-foreground">Ngân sách</span>
          <span>
            <b className="font-serif text-[24px] font-semibold">{formatMillions(budget.planned)}</b> / {formatMillions(budget.total)}
          </span>
          <StackBar
            label="Đã cọc, chưa cọc và còn lại"
            parts={[
              { title: 'Đã cọc', value: budget.deposited, className: 'bg-sage' },
              { title: 'Chưa cọc', value: budget.planned - budget.deposited, className: budget.remaining < 0 ? 'bg-warn' : 'bg-gold' },
              { title: 'Còn lại', value: budget.remaining, className: 'bg-transparent' },
            ]}
          />
          <span className={cn('text-[13px]', budget.remaining < 0 ? 'font-semibold text-warn' : 'text-muted-foreground')}>
            Đã cọc {formatMillions(budget.deposited)}, {budget.remaining < 0 ? `vượt ${formatMillions(-budget.remaining)}` : `còn lại ${formatMillions(budget.remaining)}`}
          </span>
        </Link>
      )}
      {guests && (
        <Link to={paths.planTab.guests} className="flex flex-col gap-1.5 rounded-lg border border-line bg-surface px-[22px] py-5 hover:border-primary">
          <span className="text-[13px] text-muted-foreground">Khách mời</span>
          <span>
            <b className="font-serif text-[24px] font-semibold">{formatNumber(guests.total)}</b>/{formatNumber(guests.expected)} khách
          </span>
          {progress(Math.min(guests.total, guests.expected), guests.expected)}
          <span className={cn('text-[13px]', guests.total > guests.expected ? 'font-semibold text-warn' : 'text-muted-foreground')}>
            {guests.total > guests.expected
              ? `Vượt ${formatNumber(guests.total - guests.expected)} khách so với dự kiến`
              : `Đã mời ${formatNumber(guests.invited)}, sẽ đến ${formatNumber(guests.attending)}`}
          </span>
        </Link>
      )}
    </div>
  )
}

function TaskCards({ tasks }: { tasks: NonNullable<Overview['tasks']> }) {
  return (
    <>
      <Card title="Việc sắp đến hạn">
        {tasks.upcoming.length ? (
          <ul>
            {tasks.upcoming.map((t) => {
              const due = dueText(t.daysLeft, t.dueDate)
              return (
                <li key={t.id} className="flex items-start gap-3 border-t border-line py-2.5 text-sm first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{t.title}</div>
                    <div className="text-[13px] text-muted-foreground">{t.category?.name ?? 'Việc chung'}</div>
                  </div>
                  <span className={cn('text-[13px] whitespace-nowrap', due.cls)}>{due.text}</span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Không còn việc nào cần làm.</p>
        )}
      </Card>

      <Card title="Tiến độ theo hạng mục">
        <ul className="flex flex-col gap-3">
          {tasks.byCategory.map((c) => (
            <li key={c.slug ?? 'chung'} className="text-sm">
              <div className="mb-1.5 flex justify-between gap-2">
                <span className="font-medium">{c.name}</span>
                <span className="text-muted-foreground">
                  {c.done}/{c.total}
                </span>
              </div>
              {progress(c.done, c.total)}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )
}

function CostCard({ budget }: { budget: NonNullable<Overview['budget']> }) {
  const spent = budget.slices.reduce((s, x) => s + x.amount, 0)
  return (
    <Card title="Chi phí theo hạng mục" action={more(paths.planTab.budget, 'Xem ngân sách')}>
      {budget.slices.length ? (
        <Donut
          label="Chi phí theo hạng mục"
          size={130}
          center={
            <span>
              <b className="block font-serif text-base">{formatMillions(spent)}</b>dự kiến
            </span>
          }
          slices={budget.slices.map((s, i) => ({
            key: s.slug,
            label: s.name,
            value: s.amount,
            color: s.slug === 'other' ? 'var(--line-strong)' : CHART_COLORS[i % CHART_COLORS.length],
            note: formatMoney(s.amount),
            warn: s.isOver,
          }))}
        />
      ) : (
        <p className="text-sm text-muted-foreground">Chưa có chi phí nào. Thêm dịch vụ vào kế hoạch để thấy chi phí dự kiến.</p>
      )}
    </Card>
  )
}

/** Subtab Tổng quan (P2). Thẻ của tab mà người xem không được xem thì không hiện (backend trả null). */
export default function PlanOverviewPage() {
  const { wedding, access, openEdit } = usePlanContext()
  const overview = useOverview()

  if (overview.isError) {
    return (
      <EmptyState
        title="Không tải được tổng quan"
        description={overview.error.message}
        action={
          <Button variant="outline" onClick={() => overview.refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }
  const data = overview.data

  return (
    <>
      {overview.isPending ? <div className="mb-4 h-[150px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" /> : <TopCards data={data!} />}
      <div className="grid grid-cols-[1.2fr_1fr] items-start gap-4 max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-4">
          {data?.tasks && <TaskCards tasks={data.tasks} />}
          {!data?.tasks && <SpendingServicesCard wedding={wedding} onEdit={access.canEdit ? openEdit : undefined} />}
        </div>
        <div className="flex flex-col gap-4">
          {data?.tasks && <SpendingServicesCard wedding={wedding} onEdit={access.canEdit ? openEdit : undefined} />}
          {data?.budget && <CostCard budget={data.budget} />}
        </div>
      </div>
    </>
  )
}

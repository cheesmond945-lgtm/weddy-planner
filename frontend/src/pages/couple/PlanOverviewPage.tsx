import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { categoryColor } from '@/features/catalog/categoryIcons'
import { Donut } from '@/features/weddings/components/Donut'
import { usePlanContext } from '@/features/weddings/components/PlanHub'
import { StackBar, StatCard, StatGrid } from '@/features/weddings/components/StatCard'
import { SpendingServicesCard } from '@/features/weddings/components/SpendingServicesCard'
import { useOverview } from '@/features/weddings/hooks'
import { formatShortDate } from '@/lib/date'
import { formatMillions, formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Overview } from '@/types/wedding'

function Card({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('flex flex-col gap-3 rounded-lg border border-line bg-surface px-[22px] py-5', className)}>
      <div className="flex items-baseline justify-between gap-2.5">
        <h2>{title}</h2>
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
  <div className="overview-bar" aria-hidden>
    <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
  </div>
)

/** "Còn n ngày" khi ≤ 7 ngày, "Quá hạn n ngày", "Hạn hôm nay", nếu không thì ngày (P2). */
function dueText(daysLeft: number, dueDate: string) {
  if (daysLeft < 0) return { text: `Quá hạn ${-daysLeft} ngày`, cls: 'bg-warn-soft font-semibold text-warn' }
  if (daysLeft === 0) return { text: 'Hạn hôm nay', cls: 'bg-warn-soft font-semibold text-warn' }
  if (daysLeft <= 7) return { text: `Còn ${daysLeft} ngày`, cls: 'bg-gold-100 font-semibold text-gold-800' }
  return { text: `Hạn ${formatShortDate(dueDate)}`, cls: 'text-muted-foreground' }
}

/** Ba thẻ số đầu trang: cùng kiểu thẻ số tab Ngân sách (ô giấy kem trên dải ô liu, chú thích bên dưới); Ngân sách bấm được */
function TopCards({ data }: { data: Overview }) {
  const { tasks, budget } = data
  return (
    <StatGrid className="grid-cols-[repeat(auto-fit,minmax(220px,1fr))]">
      {tasks && (
        <StatCard
          label="Công việc"
          value={
            <>
              {tasks.done}
              <span className="text-[17px] font-normal text-muted-foreground">/{tasks.total} việc</span>
            </>
          }
          sub={
            <span className={cn(tasks.overdue > 0 && 'font-semibold text-warn')}>
              {tasks.overdue ? `${tasks.overdue} việc quá hạn` : 'Chưa có việc nào quá hạn'}
            </span>
          }
        >
          <div className="w-full">{progress(tasks.done, tasks.total)}</div>
        </StatCard>
      )}
      {budget && (
        <Link to={paths.planTab.budget} className="olive-link">
          <StatCard
            label="Ngân sách"
            value={
              <>
                {formatMillions(budget.planned)}
                <span className="text-[17px] font-normal text-muted-foreground"> / {formatMillions(budget.total)}</span>
              </>
            }
            sub={
              <span className={cn(budget.remaining < 0 && 'font-semibold text-warn')}>
                Đã cọc {formatMillions(budget.deposited)},{' '}
                {budget.remaining < 0 ? `vượt ${formatMillions(-budget.remaining)}` : `còn lại ${formatMillions(budget.remaining)}`}
              </span>
            }
          >
            <div className="w-full">
              <StackBar
                label="Đã cọc, chưa cọc và còn lại"
                parts={[
                  { title: 'Đã cọc', value: budget.deposited, className: 'bg-[#6f7444]' },
                  { title: 'Chưa cọc', value: budget.planned - budget.deposited, className: budget.remaining < 0 ? 'bg-warn' : 'bg-[#c9b37a]' },
                  { title: 'Còn lại', value: budget.remaining, className: 'bg-transparent' },
                ]}
              />
            </div>
          </StatCard>
        </Link>
      )}
    </StatGrid>
  )
}

function UpcomingCard({ tasks }: { tasks: NonNullable<Overview['tasks']> }) {
  return (
    <Card title="Việc sắp đến hạn">
      {tasks.upcoming.length ? (
        <ul>
          {tasks.upcoming.map((t) => {
            const due = dueText(t.daysLeft, t.dueDate)
            return (
              <li key={t.id} className="flex items-start gap-3 border-t border-line py-2.5 text-sm first:border-t-0 first:pt-0">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{t.title}</div>
                  {t.category && <div className="text-[12.5px] text-muted-foreground">{t.category.name}</div>}
                </div>
                <span className={cn('rounded-pill px-2 py-0.5 text-[12px] whitespace-nowrap', due.cls)}>{due.text}</span>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Không còn việc nào cần làm.</p>
      )}
    </Card>
  )
}

/** Tiến độ theo hạng mục: mỗi hạng mục một dòng gọn (tên, số việc xong, thanh mảnh) */
function ProgressCard({ tasks }: { tasks: NonNullable<Overview['tasks']> }) {
  return (
    <Card title="Tiến độ theo hạng mục">
      <ul className="flex flex-col gap-2.5">
        {tasks.byCategory.map((c) => (
          <li key={c.slug ?? 'chung'} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
            <span className="truncate">{c.name}</span>
            <span className="text-[12.5px] text-muted-foreground tabular-nums">
              {c.done}/{c.total}
            </span>
            <div className="col-span-2">{progress(c.done, c.total)}</div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Chi phí theo hạng mục: biểu đồ tròn và chú thích nằm gọn trong một cột; rê chuột vào lát hoặc dòng chú thích để xem số tiền và tỉ lệ. Màu theo hạng mục (như trang Kế hoạch). */
function CostCard({ budget }: { budget: NonNullable<Overview['budget']> }) {
  const spent = budget.slices.reduce((s, x) => s + x.amount, 0)
  return (
    <Card title="Chi phí theo hạng mục" action={more(paths.planTab.budget, 'Xem ngân sách')}>
      {budget.slices.length ? (
        <Donut
          label="Chi phí theo hạng mục"
          size={200}
          center={
            <span>
              <b className="block font-serif text-[22px] leading-tight">{formatMillions(spent)}</b>
              <span className="text-muted-foreground">chi phí dự kiến</span>
            </span>
          }
          detail={(s) => (budget.total > 0 ? `${Math.round((s.value / budget.total) * 100)}% tổng ngân sách ${formatMillions(budget.total)}` : null)}
          slices={budget.slices.map((s) => ({
            key: s.slug,
            label: s.name,
            value: s.amount,
            color: s.slug === 'other' ? 'var(--line-strong)' : categoryColor(s.slug),
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

/** Subtab Tổng quan (P2). */
export default function PlanOverviewPage() {
  const { wedding, openEdit } = usePlanContext()
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

  // Cùng phong cách tab Ngân sách (plan-theme / budget-theme: Lexend, tiêu đề serif nghiêng, thẻ số ô liu).
  // Thẻ số → hai cột gọn: trái = chi phí theo hạng mục + mức chia và dịch vụ; phải = việc sắp đến hạn + tiến độ theo hạng mục.
  return (
    <div className="plan-theme budget-theme overview-page">
      {overview.isPending ? (
        <div className="mb-5 h-[170px] animate-pulse rounded-[22px] bg-muted" aria-busy="true" aria-label="Đang tải" />
      ) : (
        <TopCards data={data!} />
      )}
      <div className="grid grid-cols-2 items-start gap-5 max-[900px]:grid-cols-1">
        <div className="flex flex-col gap-5">
          {data?.budget && <CostCard budget={data.budget} />}
          <SpendingServicesCard wedding={wedding} onEdit={openEdit} />
        </div>
        <div className="flex flex-col gap-5">
          {data?.tasks && <UpcomingCard tasks={data.tasks} />}
          {data?.tasks && <ProgressCard tasks={data.tasks} />}
        </div>
      </div>
    </div>
  )
}

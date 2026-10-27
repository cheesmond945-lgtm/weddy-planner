import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { DashboardStats } from '@/features/vendorDashboard/components/DashboardStats'
import { RecentOrders, UpcomingOrders } from '@/features/vendorDashboard/components/OrderLists'
import { ProfileCard } from '@/features/vendorDashboard/components/ProfileCard'
import { ProfileReminder } from '@/features/vendorDashboard/components/ProfileReminder'
import { TodoList } from '@/features/vendorDashboard/components/TodoList'
import { useVendorDashboard } from '@/features/vendorDashboard/hooks'
import { useNow } from '@/lib/clock'
import { useAuth } from '@/store/auth'

const dateText = (at: Date) => new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(at)

/** Tổng quan: lời chào, số liệu chính, việc cần làm, đơn sắp diễn ra, đơn gửi gần đây. */
export default function VendorDashboardPage() {
  const { user } = useAuth()
  const d = useVendorDashboard()
  const name = d.profile?.businessName ?? user?.name ?? ''
  // Câu chào theo đồng hồ giả lập (tua giờ thì ngày chào đổi theo)
  const date = dateText(useNow())

  return (
    <>
      <PageTitle title="Tổng quan" description={`${date.charAt(0).toUpperCase()}${date.slice(1)} · Chào mừng trở lại, ${name}`} />
      {d.isPending ? (
        <div aria-busy="true" aria-label="Đang tải tổng quan" className="h-[480px] animate-pulse rounded-md bg-muted" />
      ) : d.error || !d.profile ? (
        <EmptyState title="Chưa tải được tổng quan" description={d.error?.message} action={<Button onClick={d.refetch}>Thử lại</Button>} />
      ) : (
        <>
          <ProfileReminder profile={d.profile} />
          <DashboardStats stats={d.stats} currentCommission={d.currentCommission} />
          <div className="grid grid-cols-[minmax(0,1fr)_300px] items-start gap-5 max-[1100px]:grid-cols-1">
            <div className="grid min-w-0 gap-5">
              <UpcomingOrders items={d.upcoming} />
              <RecentOrders orders={d.recent} />
            </div>
            <aside className="grid gap-[18px] max-[1100px]:order-first max-[1100px]:grid-cols-2 max-sm:grid-cols-1">
              <ProfileCard profile={d.profile} fallbackName={user?.name ?? ''} />
              <TodoList items={d.todos} />
            </aside>
          </div>
        </>
      )}
    </>
  )
}

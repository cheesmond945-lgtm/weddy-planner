import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { ApprovalList } from '@/features/adminDashboard/components/ApprovalList'
import { AttentionCards } from '@/features/adminDashboard/components/AttentionCards'
import { CategoryDonut, CommissionBars } from '@/features/adminDashboard/components/Charts'
import { DashboardTiles } from '@/features/adminDashboard/components/DashboardTiles'
import { useAdminDashboard } from '@/features/adminDashboard/hooks'
import { TableSkeleton } from '@/features/adminShared/components/AdminTable'
import { useAuth } from '@/store/auth'

/** Tổng quan quản trị: số liệu tháng, việc cần xử lý, danh sách chờ duyệt và biểu đồ. */
export default function AdminDashboardPage() {
  const { user } = useAuth()
  const { data, isPending, isError, error, refetch } = useAdminDashboard()

  return (
    <>
      <h1 className="mb-6 text-[clamp(24px,3.4vw,32px)] leading-[1.2]">Chào mừng trở lại, {user?.name ?? 'Quản trị viên'} 👋</h1>
      {isPending ? (
        <TableSkeleton label="Đang tải tổng quan" height={520} />
      ) : isError ? (
        <EmptyState title="Chưa tải được tổng quan" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
      ) : (
        <>
          <DashboardTiles data={data} />
          <AttentionCards data={data} />
          <ApprovalList data={data} />
          <div className="grid grid-cols-[minmax(0,1.9fr)_minmax(0,1fr)] gap-5 max-[1000px]:grid-cols-1">
            <section className="min-w-0 rounded-md border border-line bg-surface px-6 py-5 shadow-portal">
              <h2 className="text-[19px] font-semibold">Hoa hồng 6 tháng gần nhất</h2>
              <p className="mt-0.5 mb-3 text-[13px] text-muted-foreground">So sánh hoa hồng thu về theo tháng</p>
              <CommissionBars data={data.commissionByMonth} />
              <p className="mt-1 flex items-center justify-center gap-2 text-[13px] text-muted-foreground">
                <i aria-hidden className="size-2.5 rounded-full bg-sage opacity-80" />
                Hoa hồng
              </p>
            </section>
            <section className="min-w-0 rounded-md border border-line bg-surface px-6 py-5 shadow-portal">
              <h2 className="text-[19px] font-semibold">Đơn theo loại dịch vụ</h2>
              <p className="mt-0.5 mb-4 text-[13px] text-muted-foreground">Phân bổ khối lượng đơn hàng</p>
              <CategoryDonut data={data.ordersByCategory} />
            </section>
          </div>
        </>
      )}
    </>
  )
}

import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { accessOf } from '@/features/weddings/access'
import { PLAN_TAB_LINKS, PlanHubHeader, PlanTabs, type PlanOutletContext } from '@/features/weddings/components/PlanHub'
import { WeddingEditDialog } from '@/features/weddings/components/WeddingDialogs'
import { WeddingForm } from '@/features/weddings/components/WeddingForm'
import { useSaveWedding, useWedding } from '@/features/weddings/hooks'

/**
 * Trang Kế hoạch của tôi: đầu trang, thanh subtab và nội dung subtab (route con).
 * Chưa có thông tin đám cưới thì hiện form thiết lập (4.1) thay cho các subtab.
 */
export default function PlanLayoutPage() {
  const wedding = useWedding()
  const save = useSaveWedding()
  const [editing, setEditing] = useState(false)
  const { pathname, search } = useLocation()

  if (wedding.isPending) return <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải" />
  if (wedding.isError) {
    return (
      <EmptyState
        title="Không tải được kế hoạch"
        description={wedding.error.message}
        action={
          <Button variant="outline" onClick={() => wedding.refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }

  if (!wedding.data) {
    return (
      <>
        <PageTitle title="Thiết lập thông tin đám cưới" />
        <div className="max-w-[640px] rounded-lg border border-line bg-surface p-[22px]">
          <WeddingForm
            initial={null}
            submitLabel="Tạo timeline khung"
            pending={save.isPending}
            error={save.error?.message}
            onSubmit={(input) => save.mutate(input, { onSuccess: () => toast('Đã tạo timeline khung') })}
          />
        </div>
      </>
    )
  }

  // Vào /plan hoặc một tab không được xem: chuyển sang tab đầu tiên được xem (giữ query, ví dụ ?category=)
  const access = accessOf(wedding.data.access)
  const allowed = PLAN_TAB_LINKS.filter((t) => access.canSee(t.tab))
  // Lời mời cũ chỉ cho xem Timeline (tab đã bỏ): không còn phần nào để hiện
  if (!allowed.length) return <EmptyState title="Chưa có phần nào để xem" description="Chủ kế hoạch chưa chia sẻ phần nào của kế hoạch cho bạn." />
  if (!allowed.some((t) => pathname === t.to)) return <Navigate to={{ pathname: allowed[0].to, search }} replace />

  const context: PlanOutletContext = { wedding: wedding.data, access, openEdit: () => setEditing(true) }
  return (
    <>
      <PlanHubHeader wedding={wedding.data} access={access} onEdit={context.openEdit} />
      <PlanTabs access={access} />
      <Outlet context={context} />
      <WeddingEditDialog open={editing} onOpenChange={setEditing} />
    </>
  )
}

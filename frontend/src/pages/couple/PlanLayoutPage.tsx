import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
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

  // Vào /plan: chuyển sang tab đầu tiên (giữ query, ví dụ ?category=)
  if (!PLAN_TAB_LINKS.some((t) => pathname === t.to)) return <Navigate to={{ pathname: PLAN_TAB_LINKS[0].to, search }} replace />

  const context: PlanOutletContext = { wedding: wedding.data, openEdit: () => setEditing(true) }
  return (
    <>
      <PlanHubHeader wedding={wedding.data} onEdit={context.openEdit} />
      <PlanTabs />
      <Outlet context={context} />
      <WeddingEditDialog open={editing} onOpenChange={setEditing} />
    </>
  )
}

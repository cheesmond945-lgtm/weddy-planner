import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { PLAN_TAB_LINKS, PlanHubHeader, PlanTabs, type PlanOutletContext } from '@/features/weddings/components/PlanHub'
import { WeddingEditDialog, openWeddingSetup, useWeddingSetupOpen } from '@/features/weddings/components/WeddingDialogs'
import { useWedding } from '@/features/weddings/hooks'
import { paths } from '@/routes/paths'

/**
 * Trang Kế hoạch của tôi: đầu trang, thanh subtab và nội dung subtab (route con).
 * Chưa có thông tin đám cưới thì mở hộp thiết lập (WeddingSetupDialog), không có trang thiết lập riêng.
 */
export default function PlanLayoutPage() {
  const wedding = useWedding()
  const [editing, setEditing] = useState(false)
  const { pathname, search } = useLocation()
  const setupOpen = useWeddingSetupOpen()
  const needsSetup = wedding.isSuccess && !wedding.data
  // Vào Kế hoạch (kể cả tải lại trang) mà chưa có thông tin đám cưới: sang trang Dịch vụ cưới (nền có nội dung) và mở hộp thiết lập ở đó.
  // Lưu xong hộp tự đưa về Kế hoạch (WeddingSetupDialog: không có `then` thì sang tab Timeline)
  const navigate = useNavigate()
  useEffect(() => {
    if (!needsSetup) return
    if (!setupOpen) openWeddingSetup(null)
    navigate(paths.services, { replace: true })
  }, [needsSetup, setupOpen, navigate])

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

  // Chưa có thông tin đám cưới: chỉ dùng hộp thiết lập (không có trang thiết lập riêng); hiệu ứng bên trên chuyển trang và mở hộp
  if (!wedding.data) return null

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

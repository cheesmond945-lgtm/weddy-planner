import { useLocation, useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api'
import { ServiceDetailView } from '@/features/catalog/components/ServiceDetailView'
import { useService } from '@/features/catalog/hooks'
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton'
import { AddToPlanButton, OpenChatButton, usePlanItemOf } from '@/features/weddings/planActions'
import { PLAN_STATUS } from '@/features/weddings/status'
import { paths } from '@/routes/paths'

/** Trang chi tiết dịch vụ (2.2). */
export default function ServiceDetailPage() {
  const { serviceId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: service, isPending, isError, error, refetch } = useService(serviceId)
  const planItem = usePlanItemOf(serviceId)

  // Về đúng danh sách (giữ bộ lọc) nếu đi từ trang Dịch vụ cưới
  const backTo = (location.state as { from?: string } | null)?.from ?? paths.services
  const back = (
    <Button variant="outline" className="mb-[18px]" onClick={() => navigate(backTo)}>
      Quay lại danh sách
    </Button>
  )

  return (
    <div className="mx-auto max-w-[1180px]">
      {back}
      {isPending && (
        <div aria-busy="true" aria-label="Đang tải dịch vụ" className="space-y-4">
          <div className="h-12 w-2/3 animate-pulse rounded-md bg-muted" />
          <div className="h-[clamp(260px,38vw,450px)] animate-pulse rounded-[24px] bg-muted" />
        </div>
      )}
      {isError &&
        (error instanceof ApiError && error.status === 404 ? (
          <EmptyState title="Không tìm thấy dịch vụ" description="Dịch vụ này không tồn tại hoặc đã ngừng hiển thị." />
        ) : (
          <EmptyState
            title="Không tải được dịch vụ"
            description={error.message}
            action={
              <Button variant="outline" onClick={() => refetch()}>
                Thử lại
              </Button>
            }
          />
        ))}
      {service && (
        <ServiceDetailView
          service={service}
          headActions={<FavoriteButton service={service} variant="icon" />}
          sidebarActions={
            <>
              <OpenChatButton service={service} size="lg" className="min-h-12 w-full rounded-[14px] font-semibold" />
              <AddToPlanButton service={service} size="lg" addedLabel="Đã trong kế hoạch" className="min-h-12 w-full rounded-[14px] font-semibold" />
            </>
          }
          sidebarTip={
            planItem ? (
              <>
                Trạng thái trong kế hoạch của bạn: <b>{PLAN_STATUS[planItem.status].label}</b>.
              </>
            ) : (
              'Nhắn tin sẽ tự thêm dịch vụ này vào kế hoạch với trạng thái Đang trao đổi. Chọn Thêm vào kế hoạch nếu bạn muốn lưu trước, chưa liên hệ.'
            )
          }
        />
      )}
    </div>
  )
}

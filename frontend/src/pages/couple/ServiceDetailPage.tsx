import { useLocation, useNavigate, useParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/api'
import { ServiceDetailView } from '@/features/catalog/components/ServiceDetailView'
import { PackageCardSkeleton } from '@/features/catalog/components/ServiceInfoPanel'
import { useService } from '@/features/catalog/hooks'
import { FavoriteButton } from '@/features/favorites/components/FavoriteButton'
import { HallCalendar, HallsVerdict } from '@/features/halls/components/HallCalendar'
import { useMyOrders } from '@/features/orders/hooks'
import { RESTAURANT_SLUG } from '@/features/vendors/constants'
import { useWedding } from '@/features/weddings/hooks'
import { AddToPlanButton, OpenChatButton, usePlanItemOf } from '@/features/weddings/planActions'
import { PLAN_STATUS } from '@/features/weddings/status'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'

/** Trang chi tiết dịch vụ (2.2). */
export default function ServiceDetailPage() {
  const { serviceId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: service, isPending, isError, error, refetch } = useService(serviceId)
  const planItem = usePlanItemOf(serviceId)
  // Trung tâm tổ chức sự kiện: mỗi gói là một sảnh có lịch bận (docs/LICH_BAN_SANH.md); so với ngày cưới nếu khách đã thiết lập
  const { data: wedding } = useWedding()
  const halls = service?.category.slug === RESTAURANT_SLUG
  // Sảnh chính khách này đã đặt cọc: lịch hiện "Bạn đã đặt" thay vì "Bận"
  const { data: myOrders } = useMyOrders()
  const booked = (myOrders ?? []).filter((o) => o.serviceId === serviceId && o.package && (o.status === 'Deposited' || o.status === 'Completed'))
  const mineOf = (packageId: string) => booked.filter((o) => o.package!.id === packageId).map((o) => o.eventDate)
  const bookedHall = booked.find((o) => o.eventDate === wedding?.date)?.package?.name ?? null

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
          {/* Card gói giữ chỗ cùng kích thước, cùng lưới 2 cột như khi đã tải */}
          <div className="max-w-[790px] @container">
            <div className="grid grid-cols-1 gap-5 @min-[700px]:grid-cols-2">
              <PackageCardSkeleton />
              <PackageCardSkeleton />
            </div>
          </div>
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
          sidebarLead={halls ? <HallsVerdict serviceId={service.id} weddingDate={wedding?.date} bookedHall={bookedHall} /> : undefined}
          packageExtra={halls ? (pkg) => <HallCalendar packageId={pkg.id} weddingDate={wedding?.date} mine={mineOf(pkg.id)} /> : undefined}
          headActions={<FavoriteButton service={service} variant="icon" />}
          sidebarActions={
            <>
              {/* Điện thoại đã có thanh nhắn tin cố định dưới đáy */}
              <OpenChatButton service={service} className="w-full max-[900px]:hidden" />
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

      {/* Điện thoại (< 900px): thanh cố định dưới đáy, giá bên trái, nút nhắn tin bên phải; chừa chỗ để không che nội dung cuối trang */}
      {service && (
        <>
          <div aria-hidden className="h-16 min-[901px]:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur-[10px] min-[901px]:hidden">
            <div className="min-w-0">
              <span className="block text-xs text-ink-2">Giá tham khảo</span>
              <b className="block truncate text-base font-semibold text-gold-700">Từ {formatMoney(service.priceFrom)}</b>
            </div>
            <OpenChatButton service={service} label="Nhắn tin" className="shrink-0 px-5" />
          </div>
        </>
      )}
    </div>
  )
}

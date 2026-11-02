import type { ComponentProps, ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import type { ServiceSummary } from '@/types/catalog'
import { ServiceCard } from './ServiceCard'

interface ServiceResultsProps {
  /** Danh sách thường (useServices) hoặc kết quả tìm kiếm (useServiceSearch): cùng dạng pages[].data */
  query: ResultsQuery
  /** Thay khung trống mặc định (tìm kiếm có lời gợi ý riêng) */
  empty?: ReactNode
  onClearFilters: () => void
  /** Cho module khác gắn nút vào thẻ (yêu thích, thêm vào kế hoạch) */
  renderCardProps?: (s: ServiceSummary) => Partial<Pick<ComponentProps<typeof ServiceCard>, 'imageAction' | 'extraActions' | 'badge' | 'showCategory' | 'imageBadge' | 'details'>>
  /** Dịch vụ ghim lên đầu lưới (gợi ý cho bạn); bỏ khỏi phần còn lại để không lặp. Số đếm ở hàng bộ lọc vẫn là tổng. */
  pinned?: ServiceSummary[]
}

interface ResultsQuery {
  data: { pages: { data: ServiceSummary[] }[] } | undefined
  isPending: boolean
  isError: boolean
  error: Error | null
  refetch: () => unknown
  hasNextPage: boolean
  fetchNextPage: () => unknown
  isFetchingNextPage: boolean
  isPlaceholderData: boolean
}

// Lưới tự chia cột (3 → 2 → 1 theo bề rộng khung), thẻ tối thiểu 300px
const grid = 'grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-6'

/** Lưới thẻ + trạng thái trống/lỗi/đang tải + Xem thêm (số kết quả nằm ở hàng bộ lọc). */
export function ServiceResults({ query, onClearFilters, renderCardProps, pinned = [], empty }: ServiceResultsProps) {
  const { data, isPending, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isPlaceholderData } = query

  if (isPending) {
    return (
      <div className={grid} aria-busy="true" aria-label="Đang tải dịch vụ">
        {/* Khung chờ cùng dáng thẻ thật: ảnh 4:3, tên, địa chỉ, giá, nút */}
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-line bg-surface">
            <div className="aspect-[4/3] bg-muted" />
            <div className="flex flex-col gap-3 p-5">
              <div className="h-5 w-3/4 rounded-sm bg-muted" />
              <div className="h-3.5 w-1/2 rounded-sm bg-muted" />
              <div className="h-4 w-1/3 rounded-sm bg-muted" />
              <div className="mt-2 h-11 rounded-md bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (isError || !data) {
    return (
      <EmptyState
        title="Không tải được danh sách dịch vụ"
        description={error?.message}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }

  const pinnedIds = new Set(pinned.map((s) => s.id))
  const services = [...pinned, ...data.pages.flatMap((p) => p.data).filter((s) => !pinnedIds.has(s.id))]

  return (
    <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
      {services.length === 0 ? (
        (empty ?? <EmptyState
          title="Không tìm thấy dịch vụ phù hợp"
          description="Thử bỏ bớt bộ lọc."
          action={
            <Button variant="outline" onClick={onClearFilters}>
              Xóa bộ lọc
            </Button>
          }
        />)
      ) : (
        <div className={grid}>
          {services.map((s, i) => (
            <ServiceCard key={s.id} service={s} index={i} {...renderCardProps?.(s)} />
          ))}
        </div>
      )}
      {hasNextPage && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? 'Đang tải…' : 'Xem thêm dịch vụ'}
          </Button>
        </div>
      )}
    </div>
  )
}

import type { ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import type { ServiceSummary } from '@/types/catalog'
import type { useServices } from '../hooks'
import { ServiceCard } from './ServiceCard'

interface ServiceResultsProps {
  query: ReturnType<typeof useServices>
  onClearFilters: () => void
  /** Cho module khác gắn nút vào thẻ (yêu thích, thêm vào kế hoạch) */
  renderCardProps?: (s: ServiceSummary) => { imageAction?: ReactNode; extraActions?: ReactNode; badge?: ReactNode }
}

const grid = 'grid grid-cols-3 gap-4 max-md:grid-cols-2 max-[500px]:grid-cols-1'

/** Số kết quả + lưới thẻ + trạng thái trống/lỗi/đang tải + Xem thêm. */
export function ServiceResults({ query, onClearFilters, renderCardProps }: ServiceResultsProps) {
  const { data, isPending, isError, error, refetch, hasNextPage, fetchNextPage, isFetchingNextPage, isPlaceholderData } = query

  if (isPending) {
    return (
      <div className={grid} aria-busy="true" aria-label="Đang tải dịch vụ">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[300px] animate-pulse rounded-[15px] border border-line-soft bg-muted" />
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <EmptyState
        title="Không tải được danh sách dịch vụ"
        description={error.message}
        action={
          <Button variant="outline" onClick={() => refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }

  const services = data.pages.flatMap((p) => p.data)
  const total = data.pages[0]?.meta.total ?? 0

  return (
    <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
      <p className="mb-3 text-[11px] text-muted-foreground" aria-live="polite">
        {total} dịch vụ
      </p>
      {services.length === 0 ? (
        <EmptyState
          title="Không tìm thấy dịch vụ phù hợp"
          description="Thử bỏ bớt bộ lọc hoặc đổi từ khóa tìm kiếm."
          action={
            <Button variant="outline" onClick={onClearFilters}>
              Xóa bộ lọc
            </Button>
          }
        />
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

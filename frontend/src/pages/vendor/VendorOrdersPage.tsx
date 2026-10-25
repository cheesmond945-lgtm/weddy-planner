import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { OrderFilters, OrderStatusStrip } from '@/features/serviceOrders/components/OrderFilters'
import { OrderManager } from '@/features/serviceOrders/components/OrderManager'
import { OrderTable } from '@/features/serviceOrders/components/OrderTable'
import { useOrderPageState } from '@/features/serviceOrders/filters'
import { useOrderCounts, useOrders } from '@/features/serviceOrders/hooks'
import { paths } from '@/routes/paths'

/** Quản lý đơn hàng: đơn tạo từ Tin nhắn, trạng thái đơn và thanh toán tách riêng; ghi nhận thanh toán, điều chỉnh, hủy. */
export default function VendorOrdersPage() {
  const page = useOrderPageState()
  const { data, isPending, isError, error, refetch } = useOrders(page.query)
  const { data: counts } = useOrderCounts()
  const noOrders = counts && Object.values(counts).every((n) => n === 0)

  const toChat = (
    <Button asChild>
      <Link to={paths.vendor.chat}>
        <Plus />
        Tạo đơn
      </Link>
    </Button>
  )

  return (
    <>
      <PageTitle title="Quản lý đơn hàng" description="Theo dõi các đơn tạo từ Tin nhắn. Trạng thái đơn và tình trạng thanh toán tách riêng." actions={toChat} />
      <OrderStatusStrip counts={counts} value={page.query.status} onChange={(status) => page.setFilter({ status })} />
      <OrderFilters query={page.query} onChange={page.setFilter} onReset={page.resetFilters} hasFilter={page.hasFilter} />

      <section className="min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-portal">
        <div className="px-5 py-[18px]">
          <h2 className="font-sans text-[15px] font-semibold tracking-normal">
            Danh sách đơn hàng {data && <span className="ml-1 text-[13px] font-normal text-muted-foreground">({data.meta.total})</span>}
          </h2>
        </div>
        {isPending ? (
          <div aria-busy="true" aria-label="Đang tải đơn hàng" className="h-[360px] animate-pulse bg-muted" />
        ) : isError ? (
          <EmptyState className="border-0" title="Chưa tải được đơn hàng" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
        ) : data.data.length ? (
          <OrderTable orders={data.data} meta={data.meta} onOpen={(o) => page.openOrder(o.id)} onPage={(p) => page.setFilter({ page: p })} />
        ) : (
          <EmptyState
            className="border-0"
            title={noOrders ? 'Chưa có đơn hàng' : 'Không có đơn phù hợp bộ lọc'}
            description={noOrders ? 'Đơn hàng luôn tạo trong cuộc trò chuyện với khách. Mở Tin nhắn, chọn khách rồi bấm “Tạo đơn”.' : 'Thử bỏ bớt điều kiện lọc.'}
            action={
              noOrders ? (
                toChat
              ) : (
                <Button variant="outline" size="sm" onClick={page.resetFilters}>
                  Đặt lại bộ lọc
                </Button>
              )
            }
          />
        )}
      </section>

      {page.openOrderId && (
        <OrderManager key={page.openOrderId} orderId={page.openOrderId} initialAction={page.action} onClose={() => page.openOrder(null)} />
      )}
    </>
  )
}

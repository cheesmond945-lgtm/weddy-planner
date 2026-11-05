import { MessageSquare, ReceiptText } from 'lucide-react'
import { Link, Navigate, useNavigate } from 'react-router'
import { Breadcrumb } from '@/components/Breadcrumb'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { OrdersTable } from '@/features/vendorOrders/components/OrdersTable'
import { TableCard } from '@/features/adminShared/components/AdminTable'
import { OrderStatusTabs, OrderToolbar } from '@/features/vendorOrders/components/OrderToolbar'
import { OrderTiles } from '@/features/vendorOrders/components/OrderTiles'
import { LISTED_STATUSES, toApiQuery, useOrderPageState } from '@/features/vendorOrders/filters'
import { orderPageHref } from '@/features/vendorOrders/calc'
import { useOrderCounts, useOrders } from '@/features/vendorOrders/hooks'
import { useNow } from '@/lib/clock'
import { paths } from '@/routes/paths'

/**
 * Quản lý đơn hàng: danh sách đơn tạo từ Tin nhắn, cùng nguồn dữ liệu với thẻ đơn trong chat.
 * Bấm một dòng chuyển sang trang chi tiết đơn (/vendor/orders/:orderId), nơi có mọi thao tác; link cũ ?order=… cũng chuyển sang đó.
 */
export default function VendorOrdersPage() {
  const page = useOrderPageState()
  const { data, isPending, isError, error, refetch } = useOrders(toApiQuery(page.query))
  const { data: counts } = useOrderCounts()
  const navigate = useNavigate()

  // Đếm ngược hạn cọc chạy theo thời gian: dựng lại mỗi 30 giây và khi tua đồng hồ giả lập
  useNow()

  // Bản nháp chỉ xem trong Tin nhắn nên không tính vào "chưa có đơn"
  const noOrders = counts && LISTED_STATUSES.every((s) => counts[s] === 0)

  // Link cũ /vendor/orders?order=… (đã lưu, thông báo cũ) chuyển sang trang chi tiết đơn
  if (page.openOrderId) return <Navigate to={orderPageHref(page.openOrderId)} replace />

  return (
    <>
      <Breadcrumb items={[{ label: 'Trang chủ', to: paths.vendor.dashboard }, { label: 'Quản lý đơn hàng' }]} />
      <PageTitle title="Quản lý đơn hàng" />
      <OrderTiles tiles={counts?.tiles} query={page.query} onFilter={page.setFilter} />

      <TableCard>
        <OrderToolbar query={page.query} onChange={page.setFilter} onReset={page.resetFilters} hasFilter={page.hasFilter} />
        <OrderStatusTabs counts={counts} value={page.query.status} onChange={(status) => page.setFilter({ status })} />
        {isPending ? (
          <div aria-busy="true" aria-label="Đang tải đơn hàng" className="h-[360px] animate-pulse bg-muted" />
        ) : isError ? (
          <EmptyState className="border-0" title="Chưa tải được đơn hàng" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
        ) : data.data.length ? (
          <OrdersTable orders={data.data} meta={data.meta} onOpen={(id) => navigate(orderPageHref(id))} onPage={(p) => page.setFilter({ page: p })} />
        ) : (
          <div className="grid place-items-center px-6 py-14 text-center">
            <span className="mb-3 grid size-14 place-items-center rounded-full bg-gold-soft text-gold-ink">{noOrders ? <MessageSquare className="size-6" /> : <ReceiptText className="size-6" />}</span>
            <h3 className="mb-1.5 text-xl">{noOrders ? 'Chưa có đơn hàng' : 'Không có đơn phù hợp bộ lọc'}</h3>
            <p className="mb-4 max-w-[44ch] text-muted-foreground">{noOrders ? 'Đơn hàng luôn được tạo trong cuộc trò chuyện với khách.' : 'Thử bỏ bớt điều kiện lọc.'}</p>
            {noOrders ? (
              <Button asChild className="rounded-pill">
                <Link to={paths.vendor.chat}>
                  <MessageSquare />
                  Mở Tin nhắn để tạo đơn
                </Link>
              </Button>
            ) : (
              page.hasFilter && (
                <Button variant="outline" size="sm" className="rounded-pill" onClick={page.resetFilters}>
                  Đặt lại bộ lọc
                </Button>
              )
            )}
          </div>
        )}
      </TableCard>
    </>
  )
}

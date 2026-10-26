import { MessageSquare, Plus, ReceiptText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { useOrderActionRunner } from '@/features/vendorOrders/actions'
import { InvoiceDialog } from '@/features/vendorOrders/components/InvoiceDialog'
import { NewOrderDialog } from '@/features/vendorOrders/components/NewOrderDialog'
import { OrderDetailDialog } from '@/features/vendorOrders/components/OrderDetailDialog'
import { OrderFormDialog, type OrderFormMode } from '@/features/vendorOrders/components/OrderFormDialog'
import { OrdersTable } from '@/features/vendorOrders/components/OrdersTable'
import { OrderStatusTabs, OrderToolbar } from '@/features/vendorOrders/components/OrderToolbar'
import { OrderTiles } from '@/features/vendorOrders/components/OrderTiles'
import { TimeTravelMenu } from '@/features/vendorOrders/components/TimeTravelMenu'
import { useOrderPageState } from '@/features/vendorOrders/filters'
import { useOrder, useOrderCounts, useOrders } from '@/features/vendorOrders/hooks'
import { orderTiles } from '@/features/vendorOrders/summary'
import { paths } from '@/routes/paths'
import type { InvoiceType, Order } from '@/types/vendorOrder'

// Số liệu 4 thẻ tính từ mọi đơn; 100 là trang lớn nhất API cho phép (README mục 6)
const ALL_ORDERS = { page: 1, pageSize: 100 }

/**
 * Quản lý đơn hàng: danh sách đơn tạo từ Tin nhắn, cùng nguồn dữ liệu với thẻ đơn trong chat.
 * Bấm dòng mở màn Xem chi tiết như trong chat; thao tác giống thẻ đơn.
 */
export default function VendorOrdersPage() {
  const page = useOrderPageState()
  const { data, isPending, isError, error, refetch } = useOrders(page.query)
  const { data: counts } = useOrderCounts()
  const { data: all } = useOrders(ALL_ORDERS)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<OrderFormMode | null>(null)
  const [invoice, setInvoice] = useState<{ order: Order; type: InvoiceType } | null>(null)

  // Đếm ngược hạn cọc chạy theo thời gian: dựng lại mỗi 30 giây
  const [, setTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // Đơn đang mở chi tiết (?order=…): lấy từ danh sách nếu có, không thì tải riêng
  const open = useOrder(page.openOrderId)
  const detail = open.data
  useEffect(() => {
    if (page.openOrderId && open.isError) {
      toast('Không tìm thấy đơn hàng này.')
      page.openOrder(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page.openOrderId, open.isError])

  const runner = useOrderActionRunner({
    onOpenForm: (mode) => {
      page.openOrder(null)
      setForm(mode)
    },
    onView: (o) => page.openOrder(o.id),
    onViewInvoice: (order, type) => setInvoice({ order, type }),
  })

  const tiles = useMemo(() => orderTiles(all?.data ?? []), [all?.data])
  const noOrders = counts && Object.values(counts).every((n) => n === 0)

  const newOrder = (
    <span className="flex flex-wrap items-center gap-2.5">
      <TimeTravelMenu />
      <Button className="rounded-pill" onClick={() => setCreating(true)}>
        <Plus />
        Tạo đơn
      </Button>
    </span>
  )

  return (
    <>
      <PageTitle title="Quản lý đơn hàng" description="Theo dõi các đơn tạo từ Tin nhắn: chờ cọc, đã cọc, hoàn thành." actions={newOrder} />
      <OrderTiles tiles={tiles} query={page.query} onFilter={page.setFilter} />
      <OrderStatusTabs counts={counts} value={page.query.status} onChange={(status) => page.setFilter({ status })} />
      <OrderToolbar query={page.query} onChange={page.setFilter} onReset={page.resetFilters} hasFilter={page.hasFilter} />

      <section className="min-w-0 overflow-hidden rounded-[22px] border border-line bg-surface shadow-panel">
        {isPending ? (
          <div aria-busy="true" aria-label="Đang tải đơn hàng" className="h-[360px] animate-pulse bg-muted" />
        ) : isError ? (
          <EmptyState className="border-0" title="Chưa tải được đơn hàng" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
        ) : data.data.length ? (
          <OrdersTable orders={data.data} meta={data.meta} busy={runner.busy} onOpen={(id) => page.openOrder(id)} onRun={runner.run} onPage={(p) => page.setFilter({ page: p })} />
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
      </section>

      {detail && <OrderDetailDialog order={detail} onClose={() => page.openOrder(null)} onOpenForm={(mode) => setForm(mode)} onViewInvoice={(order, type) => setInvoice({ order, type })} />}
      {invoice && <InvoiceDialog order={all?.data.find((o) => o.id === invoice.order.id) ?? invoice.order} type={invoice.type} onClose={() => setInvoice(null)} />}
      {form && (
        <OrderFormDialog
          key={`${form.kind}-${'order' in form ? form.order.id : form.kind === 'again' ? form.from.id : 'new'}`}
          conversationId={'order' in form ? form.order.conversationId : form.kind === 'again' ? form.from.conversationId : ''}
          customer={
            'order' in form ? { name: form.order.customerName, phone: form.order.customerPhone } : form.kind === 'again' ? { name: form.from.customerName, phone: form.from.customerPhone } : { name: '', phone: '' }
          }
          mode={form}
          onClose={() => setForm(null)}
          onSent={(o) => page.openOrder(o.id)}
        />
      )}
      {creating && <NewOrderDialog onClose={() => setCreating(false)} />}
      {runner.dialogs}
    </>
  )
}

import { useState } from 'react'
import { useParams } from 'react-router'
import { Breadcrumb } from '@/components/Breadcrumb'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { orderHint, formatDayTime } from '@/features/vendorOrders/calc'
import { InvoiceDialog } from '@/features/vendorOrders/components/InvoiceDialog'
import { OrderActions } from '@/features/vendorOrders/components/OrderActions'
import { OrderStatusBadge, PaidInFullBadge } from '@/features/vendorOrders/components/OrderBadges'
import { OrderDetailSections } from '@/features/vendorOrders/components/OrderDetailDialog'
import { OrderFormDialog, type OrderFormMode } from '@/features/vendorOrders/components/OrderFormDialog'
import { useOrder } from '@/features/vendorOrders/hooks'
import { useNow } from '@/lib/clock'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { InvoiceType } from '@/types/vendorOrder'

/** Trang chi tiết một đơn của NCC (/vendor/orders/:orderId): đường dẫn Trang chủ > Quản lý đơn hàng > Chi tiết đơn hàng, đầu trang, các nút thao tác, rồi thông tin, hạng mục, thanh toán, lịch sử, chứng từ. */
export default function VendorOrderDetailPage() {
  const { orderId = '' } = useParams()
  const { data: order, isError, error, refetch } = useOrder(orderId)
  const [form, setForm] = useState<OrderFormMode | null>(null)
  const [invoiceType, setInvoiceType] = useState<InvoiceType | null>(null)
  // Đếm ngược hạn cọc chạy theo thời gian
  useNow()

  const back = (
    <Breadcrumb
      items={[
        { label: 'Trang chủ', to: paths.vendor.dashboard },
        { label: 'Quản lý đơn hàng', to: paths.vendor.orders },
        { label: 'Chi tiết đơn hàng' },
      ]}
    />
  )

  if (isError) {
    return (
      <>
        {back}
        <EmptyState title="Không tìm thấy đơn hàng" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
      </>
    )
  }
  if (!order) {
    return (
      <>
        {back}
        <div aria-busy="true" aria-label="Đang tải đơn hàng" className="h-[360px] animate-pulse rounded-[22px] bg-muted" />
      </>
    )
  }

  const hint = orderHint(order)
  return (
    <>
      {back}
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[clamp(24px,3.6vw,34px)] leading-[1.15]">Đơn dịch vụ {order.orderCode}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <OrderStatusBadge status={order.status} />
            <PaidInFullBadge order={order} />
            <span>Tạo {formatDayTime(order.createdDate)}</span>
          </p>
        </div>
      </header>

      <section className="mb-5 rounded-[22px] border border-line bg-surface p-5 shadow-panel">
        <p className={cn('text-[13.5px]', hint.tone === 'warn' ? 'text-warn' : hint.tone === 'ok' ? 'text-sage' : 'text-muted-foreground')}>{hint.text}</p>
        <OrderActions order={order} onOpenForm={setForm} onViewInvoice={(_, type) => setInvoiceType(type)} />
      </section>

      <section className="rounded-[22px] border border-line bg-surface p-6 shadow-panel max-sm:p-4">
        <OrderDetailSections order={order} vendorView onViewInvoice={(_, type) => setInvoiceType(type)} />
      </section>

      {invoiceType && <InvoiceDialog order={order} type={invoiceType} onClose={() => setInvoiceType(null)} />}
      {form && (
        <OrderFormDialog
          key={`${form.kind}-${'order' in form ? form.order.id : form.kind === 'again' ? form.from.id : 'new'}`}
          conversationId={order.conversationId}
          customer={{ name: order.customerName, phone: order.customerPhone }}
          mode={form}
          onClose={() => setForm(null)}
          onSent={() => setForm(null)}
        />
      )}
    </>
  )
}

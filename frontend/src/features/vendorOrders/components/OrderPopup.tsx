import { useState } from 'react'
import type { InvoiceType } from '@/types/vendorOrder'
import { useOrder } from '../hooks'
import { InvoiceDialog } from './InvoiceDialog'
import { OrderDetailDialog } from './OrderDetailDialog'
import { OrderFormDialog, type OrderFormMode } from './OrderFormDialog'

/** Chi tiết một đơn dạng popup, mở tại chỗ (không chuyển sang trang Quản lý đơn hàng): kèm xem hóa đơn và form chỉnh sửa. */
export function OrderPopup({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const order = useOrder(orderId).data
  const [form, setForm] = useState<OrderFormMode | null>(null)
  const [invoiceType, setInvoiceType] = useState<InvoiceType | null>(null)
  if (!order) return null
  return (
    <>
      {!form && !invoiceType && <OrderDetailDialog order={order} onClose={onClose} onOpenForm={setForm} onViewInvoice={(_, type) => setInvoiceType(type)} />}
      {invoiceType && <InvoiceDialog order={order} type={invoiceType} onClose={() => setInvoiceType(null)} />}
      {form && (
        <OrderFormDialog
          key={`${form.kind}-${'order' in form ? form.order.id : form.kind === 'again' ? form.from.id : 'new'}`}
          conversationId={order.conversationId}
          customer={{ name: order.customerName, phone: order.customerPhone }}
          mode={form}
          onClose={onClose}
          onSent={() => setForm(null)}
        />
      )}
    </>
  )
}

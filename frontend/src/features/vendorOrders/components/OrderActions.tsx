import { Button } from '@/components/ui/button'
import type { InvoiceType, Order } from '@/types/vendorOrder'
import { actionsOf, useOrderActionRunner } from '../actions'
import type { OrderFormMode } from './OrderFormDialog'

interface OrderActionsProps {
  order: Order
  onOpenForm: (mode: OrderFormMode) => void
  /** Thẻ đơn có nút "Xem chi tiết"; màn chi tiết thì không */
  onView?: (order: Order) => void
  onViewInvoice: (order: Order, type: InvoiceType) => void
}

/** Nút của NCC trên thẻ đơn và màn chi tiết (danh sách thao tác ở features/vendorOrders/actions.tsx). */
export function OrderActions({ order: o, onOpenForm, onView, onViewInvoice }: OrderActionsProps) {
  const { run, busy, dialogs } = useOrderActionRunner({
    onOpenForm,
    onView,
    onViewInvoice,
  })
  const actions = actionsOf(o, { withView: !!onView })
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {actions.map((a) => (
          <Button
            key={a.key}
            size="sm"
            variant={a.primary ? 'default' : 'outline'}
            className={a.primary ? '' : a.danger ? 'border-warn/60 text-warn hover:bg-warn-soft hover:text-warn' : 'border-line-strong'}
            disabled={busy && (a.key === 'complete' || a.key === 'invoice')}
            onClick={() => run(a.key, o)}
          >
            {a.label}
          </Button>
        ))}
      </div>
      {dialogs}
    </>
  )
}

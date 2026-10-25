import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import type { InvoiceType, Order } from '@/types/vendorOrder'
import { eventPassed } from '../calc'
import { useCompleteOrder, useIssueFinalInvoice } from '../hooks'
import type { OrderFormMode } from './OrderFormDialog'

interface OrderActionsProps {
  order: Order
  onOpenForm: (mode: OrderFormMode) => void
  /** Thẻ đơn có nút "Xem chi tiết"; màn chi tiết thì không */
  onView?: (order: Order) => void
  onViewInvoice: (order: Order, type: InvoiceType) => void
}

/**
 * Nút của NCC trên thẻ đơn và màn chi tiết, theo docs/api/THE_DON_HANG.md mục 4:
 * Pending: Sửa và gửi lại. NeedRevision: Sửa và gửi lại (chính). Expired: Tạo đơn mới từ đơn này.
 * Deposited: Sửa đơn, Đánh dấu hoàn thành (chỉ khi đã qua ngày sự kiện), Xuất hóa đơn cuối.
 * Completed: Xuất hóa đơn cuối (nếu chưa xuất). NCC không hủy được đơn.
 */
export function OrderActions({ order: o, onOpenForm, onView, onViewInvoice }: OrderActionsProps) {
  const complete = useCompleteOrder()
  const invoice = useIssueFinalInvoice()
  const [confirm, setConfirm] = useState<'complete' | 'invoice' | null>(null)
  const hasFinal = o.invoices.some((i) => i.type === 'FinalInvoice')
  const busy = complete.isPending || invoice.isPending
  const outline = 'border-line-strong'

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        {onView && (
          <Button size="sm" variant="outline" className={outline} onClick={() => onView(o)}>
            Xem chi tiết
          </Button>
        )}
        {o.status === 'Pending' && (
          <Button size="sm" variant="outline" className={outline} onClick={() => onOpenForm({ kind: 'resend', order: o })}>
            Sửa và gửi lại
          </Button>
        )}
        {o.status === 'NeedRevision' && (
          <Button size="sm" onClick={() => onOpenForm({ kind: 'resend', order: o })}>
            Sửa và gửi lại
          </Button>
        )}
        {o.status === 'Expired' && (
          <Button size="sm" onClick={() => onOpenForm({ kind: 'again', from: o })}>
            Tạo đơn mới từ đơn này
          </Button>
        )}
        {o.status === 'Deposited' && (
          <Button size="sm" variant="outline" className={outline} onClick={() => onOpenForm({ kind: 'edit', order: o })}>
            Sửa đơn
          </Button>
        )}
        {o.status === 'Deposited' && eventPassed(o) && (
          <Button size="sm" disabled={busy} onClick={() => setConfirm('complete')}>
            Đánh dấu hoàn thành
          </Button>
        )}
        {(o.status === 'Deposited' || o.status === 'Completed') &&
          (hasFinal ? (
            <Button size="sm" variant="outline" className={outline} onClick={() => onViewInvoice(o, 'FinalInvoice')}>
              Xem hóa đơn cuối
            </Button>
          ) : (
            <Button size="sm" variant="outline" className={outline} disabled={busy} onClick={() => setConfirm('invoice')}>
              Xuất hóa đơn cuối
            </Button>
          ))}
      </div>

      <ConfirmDialog
        open={confirm === 'complete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Đánh dấu hoàn thành?"
        confirmLabel="Hoàn thành"
        onConfirm={() => complete.mutate(o.id)}
      >
        <p>
          Đơn <b>{o.orderCode}</b> (ngày thực hiện {formatDate(o.eventDate)}) chuyển sang <b>Hoàn thành</b> và bị khóa. Hệ thống tính hoa hồng trên tổng {formatMoney(o.totalAmount)} vào bảng kê của tháng này.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm === 'invoice'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Xuất hóa đơn cuối?"
        confirmLabel="Xuất hóa đơn"
        onConfirm={() => invoice.mutate(o.id)}
      >
        <p>
          Hóa đơn cuối của đơn <b>{o.orderCode}</b> được gửi vào cuộc trò chuyện với khách. Mỗi đơn chỉ xuất một lần.
        </p>
      </ConfirmDialog>
    </>
  )
}

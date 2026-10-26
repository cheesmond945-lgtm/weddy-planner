import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import type { InvoiceType, Order } from '@/types/vendorOrder'
import { eventPassed, openRevision } from './calc'
import type { OrderFormMode } from './components/OrderFormDialog'
import { useCompleteOrder, useIssueFinalInvoice } from './hooks'

export type ActionKey = 'view' | 'continue' | 'resend' | 'edit' | 'again' | 'complete' | 'invoice' | 'viewInvoice'

export interface OrderAction {
  key: ActionKey
  label: string
  /** Nút chính (tô vàng) */
  primary: boolean
}

/**
 * Thao tác của NCC trên một đơn, theo docs/api/THE_DON_HANG.md mục 4 (dùng chung cho thẻ đơn, màn chi tiết, bảng đơn):
 * Draft: Tiếp tục soạn. Pending: Cập nhật đơn. NeedRevision: Cập nhật đơn (chính). Expired, Cancelled: Tạo lại đơn (chính).
 * Deposited: Chỉnh sửa, Hoàn tất (chỉ khi đã qua ngày sự kiện), Xuất hóa đơn.
 * Completed: Xuất hóa đơn (nếu chưa xuất) hoặc Xem hóa đơn. NCC không hủy được đơn.
 */
export function actionsOf(o: Order, opts: { withView?: boolean } = {}): OrderAction[] {
  const out: OrderAction[] = []
  const hasFinal = o.invoices.some((i) => i.type === 'FinalInvoice')
  if (opts.withView) out.push({ key: 'view', label: 'Xem chi tiết', primary: false })
  if (o.status === 'Draft') out.push({ key: 'continue', label: 'Tiếp tục soạn', primary: false })
  if (o.status === 'Pending') out.push({ key: 'resend', label: 'Cập nhật đơn', primary: false })
  if (o.status === 'NeedRevision') out.push({ key: 'resend', label: 'Cập nhật đơn', primary: true })
  if (o.status === 'Expired' || o.status === 'Cancelled') out.push({ key: 'again', label: 'Tạo lại đơn', primary: true })
  if (o.status === 'Deposited') out.push({ key: 'edit', label: 'Chỉnh sửa', primary: !!openRevision(o) })
  if (o.status === 'Deposited' && eventPassed(o)) out.push({ key: 'complete', label: 'Hoàn tất', primary: true })
  if (o.status === 'Deposited' || o.status === 'Completed') {
    out.push(hasFinal ? { key: 'viewInvoice', label: 'Xem hóa đơn', primary: false } : { key: 'invoice', label: 'Xuất hóa đơn', primary: false })
  }
  return out
}

/**
 * Nút chính trong bảng: chỉ đơn cần NCC xử lý mới có (Chỉnh sửa khi khách yêu cầu sửa sau cọc, Cập nhật đơn, Hoàn tất,
 * Tạo lại đơn); đơn khác để trống. Có yêu cầu sửa sau cọc thì Chỉnh sửa đứng trước Hoàn tất.
 */
export function mainActionKey(o: Order): ActionKey | null {
  if (o.status === 'Deposited' && openRevision(o)) return 'edit'
  if (o.status === 'Deposited' && eventPassed(o)) return 'complete'
  if (o.status === 'NeedRevision') return 'resend'
  if (o.status === 'Expired' || o.status === 'Cancelled') return 'again'
  return null
}

interface RunnerOptions {
  onOpenForm: (mode: OrderFormMode) => void
  onView?: (order: Order) => void
  onViewInvoice: (order: Order, type: InvoiceType) => void
}

/**
 * Chạy thao tác của NCC trên đơn. Hoàn tất, Xuất hóa đơn và Tạo lại đơn hỏi xác nhận trước (hộp thoại nằm ở `dialogs`,
 * cần render một lần cùng nơi dùng). Gửi đơn, Cập nhật đơn, Chỉnh sửa xác nhận ngay trong form đơn.
 */
export function useOrderActionRunner({ onOpenForm, onView, onViewInvoice }: RunnerOptions): {
  run: (key: ActionKey, order: Order) => void
  busy: boolean
  dialogs: ReactNode
} {
  const complete = useCompleteOrder()
  const invoice = useIssueFinalInvoice()
  const [confirm, setConfirm] = useState<{
    type: 'complete' | 'invoice' | 'again'
    order: Order
  } | null>(null)

  const run = (key: ActionKey, o: Order) => {
    switch (key) {
      case 'view':
        return onView?.(o)
      case 'continue':
        return onOpenForm({ kind: 'draft', order: o })
      case 'resend':
        return onOpenForm({ kind: 'resend', order: o })
      case 'edit':
        return onOpenForm({ kind: 'edit', order: o })
      case 'again':
        return setConfirm({ type: 'again', order: o })
      case 'complete':
        return setConfirm({ type: 'complete', order: o })
      case 'invoice':
        return setConfirm({ type: 'invoice', order: o })
      case 'viewInvoice':
        return onViewInvoice(o, 'FinalInvoice')
    }
  }

  const o = confirm?.order
  const close = (open: boolean) => !open && setConfirm(null)
  const dialogs = (
    <>
      <ConfirmDialog open={confirm?.type === 'complete'} onOpenChange={close} title="Hoàn tất đơn?" confirmLabel="Hoàn tất" onConfirm={() => o && complete.mutate(o.id)}>
        <p>Xác nhận đơn {o && <b>{o.orderCode}</b>} đã hoàn tất? Hoa hồng của đơn sẽ được tính.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm?.type === 'invoice'} onOpenChange={close} title="Xuất hóa đơn?" confirmLabel="Xuất hóa đơn" onConfirm={() => o && invoice.mutate(o.id)}>
        {o && (
          <p>
            Hóa đơn của đơn <b>{o.orderCode}</b> được gửi vào cuộc trò chuyện với khách. Mỗi đơn chỉ xuất một lần.
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog open={confirm?.type === 'again'} onOpenChange={close} title="Tạo lại đơn?" confirmLabel="Tạo lại đơn" onConfirm={() => o && onOpenForm({ kind: 'again', from: o })}>
        <p>Tạo đơn mới với cùng hạng mục, mã đơn mới.</p>
      </ConfirmDialog>
    </>
  )

  return { run, busy: complete.isPending || invoice.isPending, dialogs }
}

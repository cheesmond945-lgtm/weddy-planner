import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import type { CancelReason, InvoiceType, Order } from '@/types/vendorOrder'
import { canCancel, completeFromText, eventPassed, openRevision } from './calc'
import type { OrderFormMode } from './components/OrderFormDialog'
import { CancelOrderDialog } from './components/CancelOrderDialog'
import { RejectRevisionDialog } from './components/RejectRevisionDialog'
import { formatMoney } from '@/lib/format'
import { RestReceivedDialog } from './components/RestReceivedDialog'
import { useCancelOrder, useCompleteOrder, useIssueFinalInvoice, useRejectRevision } from './hooks'
import { useRestAction } from './taskActions'

export type ActionKey = 'view' | 'continue' | 'resend' | 'edit' | 'reject' | 'again' | 'complete' | 'invoice' | 'viewInvoice' | 'cancel' | 'receiveRest' | 'unreceiveRest'

export interface OrderAction {
  key: ActionKey
  label: string
  /** Có thì nút bị mờ, lý do hiện ở tooltip */
  disabledReason?: string
  /** Nút chính (tô vàng) */
  primary: boolean
  /** Hủy đơn: viền đỏ */
  danger?: boolean
}

/**
 * Thao tác của NCC trên một đơn, theo docs/api/THE_DON_HANG.md mục 4 (dùng chung cho thẻ đơn, màn chi tiết, bảng đơn):
 * Draft: Tiếp tục soạn. Pending: Cập nhật đơn. NeedRevision: Cập nhật đơn (chính). Expired, Cancelled: Tạo lại đơn (chính).
 * Deposited: Chỉnh sửa (chính khi khách đang yêu cầu chỉnh sửa, kèm Từ chối yêu cầu), Hoàn tất (luôn hiện; trước ngày sự kiện bị khóa
 * kèm chữ "Hoàn tất được từ <ngày>"), Ghi nhận / Bỏ ghi nhận tiền mặt (Bỏ ghi nhận khóa khi đã có hóa đơn cuối),
 * Xuất hóa đơn (khóa tới khi đã ghi nhận tiền mặt), Hủy đơn (chỉ khi còn trước ngày sự kiện).
 * Completed: Xuất hóa đơn (nếu chưa xuất) hoặc Xem hóa đơn. Đơn chưa cọc tự hết hạn, NCC không hủy.
 */
export function actionsOf(o: Order, opts: { withView?: boolean } = {}): OrderAction[] {
  const out: OrderAction[] = []
  const hasFinal = o.invoices.some((i) => i.type === 'FinalInvoice')
  const requested = o.status === 'Deposited' && !!openRevision(o)
  if (opts.withView) out.push({ key: 'view', label: 'Xem chi tiết', primary: false })
  if (o.status === 'Draft') out.push({ key: 'continue', label: 'Tiếp tục soạn', primary: false })
  if (o.status === 'Pending') out.push({ key: 'resend', label: 'Cập nhật đơn', primary: false })
  if (o.status === 'NeedRevision') out.push({ key: 'resend', label: 'Cập nhật đơn', primary: true })
  if (o.status === 'Expired' || o.status === 'Cancelled') out.push({ key: 'again', label: 'Tạo lại đơn', primary: true })
  if (o.status === 'Deposited') out.push({ key: 'edit', label: requested ? 'Chỉnh sửa theo yêu cầu' : 'Chỉnh sửa', primary: requested })
  if (requested) out.push({ key: 'reject', label: 'Từ chối yêu cầu', primary: false })
  // Hoàn tất luôn hiện với đơn Đã cọc; trước ngày thực hiện thì khóa kèm chữ "Hoàn tất được từ <ngày>"
  if (o.status === 'Deposited') out.push(eventPassed(o) ? { key: 'complete', label: 'Hoàn tất', primary: true } : { key: 'complete', label: 'Hoàn tất', primary: false, disabledReason: completeFromText(o) })
  if (o.status === 'Deposited' || o.status === 'Completed') {
    const rest = o.restPayment?.status
    // Đợt 2 (tiền mặt phần còn lại): NCC ghi nhận đã nhận; hóa đơn cuối chỉ xuất sau khi đã ghi nhận
    if (rest === 'Pending') out.push({ key: 'receiveRest', label: 'Ghi nhận đã nhận tiền', primary: false })
    if (rest === 'Received') out.push({ key: 'unreceiveRest', label: 'Bỏ ghi nhận đã nhận tiền', primary: false, ...(hasFinal && { disabledReason: 'Đã xuất hóa đơn cuối, không thể bỏ ghi nhận đã nhận tiền.' }) })
    out.push(
      hasFinal
        ? { key: 'viewInvoice', label: 'Xem hóa đơn', primary: false }
        : { key: 'invoice', label: 'Xuất hóa đơn', primary: false, ...(rest !== 'Received' && { disabledReason: 'Ghi nhận đã nhận tiền trước khi xuất hóa đơn.' }) },
    )
  }
  if (canCancel(o)) out.push({ key: 'cancel', label: 'Hủy đơn', primary: false, danger: true })
  return out
}

/** Nút chính trong bảng: chỉ đơn cần NCC xử lý mới có (Cập nhật đơn, Hoàn tất, Tạo lại đơn); đơn khác để trống. */
export function mainActionKey(o: Order): ActionKey | null {
  if (o.status === 'Deposited' && openRevision(o)) return 'edit'
  if (o.status === 'Deposited' && eventPassed(o)) return 'complete'
  if (o.status === 'NeedRevision') return 'resend'
  if (o.status === 'Expired' || o.status === 'Cancelled') return 'again'
  return null
}

interface RunnerOptions {
  onOpenForm: (mode: OrderFormMode) => void
  /** "Tạo lại đơn": có thì gọi thay cho mở form tại chỗ (trang Quản lý đơn hàng chuyển sang chat, đơn luôn soạn trong chat) */
  onAgain?: (order: Order) => void
  onView?: (order: Order) => void
  onViewInvoice: (order: Order, type: InvoiceType) => void
}

/**
 * Chạy thao tác của NCC trên đơn. Hoàn tất, Xuất hóa đơn và Tạo lại đơn hỏi xác nhận trước (hộp thoại nằm ở `dialogs`,
 * cần render một lần cùng nơi dùng). Gửi đơn, Cập nhật đơn, Chỉnh sửa xác nhận ngay trong form đơn.
 */
export function useOrderActionRunner({ onOpenForm, onAgain, onView, onViewInvoice }: RunnerOptions): {
  run: (key: ActionKey, order: Order) => void
  busy: boolean
  dialogs: ReactNode
} {
  const complete = useCompleteOrder()
  const invoice = useIssueFinalInvoice()
  const cancel = useCancelOrder()
  const reject = useRejectRevision()
  const restAction = useRestAction()
  const [confirm, setConfirm] = useState<{
    type: 'complete' | 'invoice' | 'again' | 'cancel' | 'reject' | 'receiveRest' | 'unreceiveRest'
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
      case 'reject':
        return setConfirm({ type: 'reject', order: o })
      case 'again':
        return setConfirm({ type: 'again', order: o })
      case 'complete':
        return eventPassed(o) ? setConfirm({ type: 'complete', order: o }) : undefined
      case 'invoice':
        return o.restPayment?.status === 'Received' ? setConfirm({ type: 'invoice', order: o }) : undefined
      case 'receiveRest':
        return setConfirm({ type: 'receiveRest', order: o })
      case 'unreceiveRest':
        return o.invoices.some((i) => i.type === 'FinalInvoice') ? undefined : setConfirm({ type: 'unreceiveRest', order: o })
      case 'viewInvoice':
        return onViewInvoice(o, 'FinalInvoice')
      case 'cancel':
        return setConfirm({ type: 'cancel', order: o })
    }
  }

  const o = confirm?.order
  const close = (open: boolean) => !open && setConfirm(null)
  const dialogs = (
    <>
      {/* Hoàn tất: đã ghi nhận tiền mặt thì xác nhận thường; chưa thì hỏi đã nhận đủ chưa */}
      <ConfirmDialog open={confirm?.type === 'complete' && o?.restPayment?.status === 'Received'} onOpenChange={close} title="Hoàn tất đơn?" confirmLabel="Hoàn tất" onConfirm={() => o && complete.mutate({ orderId: o.id })}>
        <p>Xác nhận đơn {o && <b>{o.orderCode}</b>} đã hoàn tất? Hoa hồng của đơn sẽ được tính.</p>
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.type === 'complete' && o?.restPayment?.status !== 'Received'}
        onOpenChange={close}
        title="Đã nhận đủ tiền?"
        confirmLabel="Đã nhận, hoàn tất"
        cancelLabel="Chưa, để sau"
        onConfirm={() => o && complete.mutate({ orderId: o.id, restReceived: true })}
      >
        <p>
          Bạn đã nhận đủ <b>{o ? formatMoney(o.restPayment?.amount ?? o.totalAmount - o.depositAmount) : ''}</b> phần còn lại chưa? Bấm "Đã nhận, hoàn tất" để ghi nhận và hoàn tất đơn {o && <b>{o.orderCode}</b>}.
        </p>
      </ConfirmDialog>
      <RestReceivedDialog open={confirm?.type === 'receiveRest'} amount={o?.restPayment?.amount} onOpenChange={close} onConfirm={() => o && void restAction(o.id, true, o.orderCode)} />
      <ConfirmDialog open={confirm?.type === 'unreceiveRest'} onOpenChange={close} title="Bỏ ghi nhận đã nhận tiền?" confirmLabel="Bỏ ghi nhận" onConfirm={() => o && void restAction(o.id, false, o.orderCode)}>
        <p>Đơn {o && <b>{o.orderCode}</b>} sẽ quay về trạng thái chưa nhận tiền phần còn lại.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm?.type === 'invoice'} onOpenChange={close} title="Xuất hóa đơn?" confirmLabel="Xuất hóa đơn" onConfirm={() => o && invoice.mutate(o.id)}>
        {o && (
          <p>
            Hóa đơn của đơn <b>{o.orderCode}</b> được gửi vào cuộc trò chuyện với khách. Mỗi đơn chỉ xuất một lần.
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog open={confirm?.type === 'again'} onOpenChange={close} title="Tạo lại đơn?" confirmLabel="Tạo lại đơn" onConfirm={() => o && (onAgain ? onAgain(o) : onOpenForm({ kind: 'again', from: o }))}>
        <p>Tạo đơn mới với cùng thông tin, mã đơn mới.</p>
      </ConfirmDialog>
      {confirm?.type === 'reject' && o && (
        <RejectRevisionDialog
          order={o}
          busy={reject.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={(note: string) => reject.mutate({ orderId: o.id, note }, { onSuccess: () => setConfirm(null) })}
        />
      )}
      {confirm?.type === 'cancel' && o && (
        <CancelOrderDialog
          order={o}
          busy={cancel.isPending}
          onClose={() => setConfirm(null)}
          onConfirm={(reason: CancelReason, note: string) => cancel.mutate({ orderId: o.id, reason, note }, { onSuccess: () => setConfirm(null) })}
        />
      )}
    </>
  )

  return { run, busy: complete.isPending || invoice.isPending || cancel.isPending || reject.isPending, dialogs }
}

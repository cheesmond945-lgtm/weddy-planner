import { useState, type ReactNode } from 'react'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import type { CancelReason, InvoiceType, Order } from '@/types/vendorOrder'
import { canCancel, eventPassed, openRevision } from './calc'
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
 * Draft: Tiếp tục soạn. Pending: Chỉnh sửa đơn. NeedRevision: Chỉnh sửa đơn (chính). Expired, Cancelled: Tạo lại đơn (chính).
 * Đơn đã cọc / hoàn thành, mỗi giai đoạn một nút chính (nhóm chốt 15/11/2026):
 * - Trước ngày thực hiện: Chỉnh sửa, Ghi nhận đã nhận tiền (khách trả sớm), Xuất hóa đơn (mở khi đã ghi nhận), Hủy đơn. Không hiện Hoàn tất.
 * - Sau ngày thực hiện, chưa hoàn tất: Hoàn tất (chính; chưa ghi nhận tiền thì hỏi "đã nhận đủ chưa" và ghi nhận luôn), Chỉnh sửa.
 * - Đã hoàn thành: Xuất hóa đơn (chính; chưa ghi nhận tiền, vd đơn tự hoàn thành, thì hỏi và ghi nhận luôn) hoặc Xem hóa đơn.
 * Bỏ ghi nhận (sửa ghi nhận nhầm) là nút phụ ở cuối, chỉ khi đã ghi nhận và chưa xuất hóa đơn cuối.
 */
export function actionsOf(o: Order, opts: { withView?: boolean } = {}): OrderAction[] {
  const out: OrderAction[] = []
  const hasFinal = o.invoices.some((i) => i.type === 'FinalInvoice')
  const requested = o.status === 'Deposited' && !!openRevision(o)
  const rest = o.restPayment?.status
  const passed = eventPassed(o)
  if (opts.withView) out.push({ key: 'view', label: 'Xem chi tiết', primary: false })
  if (o.status === 'Draft') out.push({ key: 'continue', label: 'Tiếp tục soạn', primary: false })
  if (o.status === 'Pending') out.push({ key: 'resend', label: 'Chỉnh sửa đơn', primary: false })
  if (o.status === 'NeedRevision') out.push({ key: 'resend', label: 'Chỉnh sửa đơn', primary: true })
  if (o.status === 'Expired' || o.status === 'Cancelled') out.push({ key: 'again', label: 'Tạo lại đơn', primary: true })
  if (o.status === 'Deposited') {
    // Sau ngày thực hiện: Hoàn tất là nút chính (gồm cả ghi nhận tiền), không hiện Ghi nhận / Xuất hóa đơn riêng
    if (passed && !requested) out.push({ key: 'complete', label: 'Hoàn tất', primary: true })
    out.push({ key: 'edit', label: requested ? 'Chỉnh sửa theo yêu cầu' : 'Chỉnh sửa', primary: requested })
    if (requested) out.push({ key: 'reject', label: 'Từ chối yêu cầu', primary: false })
    if (passed && requested) out.push({ key: 'complete', label: 'Hoàn tất', primary: false })
    if (!passed) {
      // Trước ngày thực hiện: khách trả sớm thì ghi nhận; hóa đơn cuối mở khi đã ghi nhận
      if (rest === 'Pending') out.push({ key: 'receiveRest', label: 'Ghi nhận đã nhận tiền', primary: false })
      if (!hasFinal) out.push({ key: 'invoice', label: 'Xuất hóa đơn', primary: false, ...(rest !== 'Received' && { disabledReason: 'Ghi nhận đã nhận tiền trước khi xuất hóa đơn.' }) })
    }
  }
  if (o.status === 'Completed') {
    // Chưa ghi nhận tiền (đơn tự hoàn thành, NCC quên bấm): Xuất hóa đơn hỏi "đã nhận đủ chưa" rồi ghi nhận luôn
    out.push(hasFinal ? { key: 'viewInvoice', label: 'Xem hóa đơn', primary: false } : { key: 'invoice', label: 'Xuất hóa đơn', primary: true })
  }
  if (o.status === 'Deposited' && hasFinal) out.push({ key: 'viewInvoice', label: 'Xem hóa đơn', primary: false })
  // Nút phụ: sửa ghi nhận nhầm, chỉ khi chưa xuất hóa đơn cuối (hóa đơn ghi "đã thanh toán đủ" không hủy được)
  if ((o.status === 'Deposited' || o.status === 'Completed') && rest === 'Received' && !hasFinal) out.push({ key: 'unreceiveRest', label: 'Bỏ ghi nhận đã nhận tiền', primary: false })
  if (canCancel(o)) out.push({ key: 'cancel', label: o.cancelRequest ? 'Đồng ý hủy đơn' : 'Hủy đơn', primary: false, danger: true })
  return out
}

/** Nút chính trong bảng: chỉ đơn cần NCC xử lý mới có (Chỉnh sửa đơn, Hoàn tất, Tạo lại đơn); đơn khác để trống. */
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
 * cần render một lần cùng nơi dùng). Gửi đơn, Chỉnh sửa đơn, Chỉnh sửa xác nhận ngay trong form đơn.
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
    type: 'complete' | 'invoice' | 'invoiceRecord' | 'again' | 'cancel' | 'reject' | 'receiveRest' | 'unreceiveRest'
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
        // Đã ghi nhận tiền: xác nhận xuất; đơn đã hoàn thành mà chưa ghi nhận: hỏi đã nhận đủ chưa rồi ghi nhận và xuất
        if (o.restPayment?.status === 'Received') return setConfirm({ type: 'invoice', order: o })
        return o.status === 'Completed' ? setConfirm({ type: 'invoiceRecord', order: o }) : undefined
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
      <ConfirmDialog open={confirm?.type === 'invoice'} onOpenChange={close} title="Xuất hóa đơn?" confirmLabel="Xuất hóa đơn" onConfirm={() => o && invoice.mutate({ orderId: o.id })}>
        {o && (
          <p>
            Hóa đơn của đơn <b>{o.orderCode}</b> được gửi vào cuộc trò chuyện với khách. Mỗi đơn chỉ xuất một lần.
          </p>
        )}
      </ConfirmDialog>
      <ConfirmDialog
        open={confirm?.type === 'invoiceRecord'}
        onOpenChange={close}
        title="Đã nhận đủ tiền?"
        confirmLabel="Đã nhận, xuất hóa đơn"
        cancelLabel="Chưa, để sau"
        onConfirm={() => o && invoice.mutate({ orderId: o.id, restReceived: true })}
      >
        <p>
          Hóa đơn cuối ghi khách đã thanh toán đủ. Bạn đã nhận đủ <b>{o ? formatMoney(o.restPayment?.amount ?? o.totalAmount - o.depositAmount) : ''}</b> phần còn lại chưa? Bấm "Đã nhận, xuất hóa đơn" để ghi nhận và gửi hóa đơn của đơn {o && <b>{o.orderCode}</b>} cho khách.
        </p>
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

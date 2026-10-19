import { Ban, CreditCard, MessageSquare, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { ApiError } from '@/api'
import { Button } from '@/components/ui/button'
import type { ServiceOrder } from '@/types/serviceOrder'
import { currentVersion } from '../calc'
import { adjustmentStateOf, canCancelOrder } from '../constants'
import { useOrder } from '../hooks'
import { AdjustmentDialog } from './AdjustmentDialog'
import { CancelOrderDialog } from './CancelOrderDialog'
import { OrderDetailDialog } from './OrderDetailDialog'
import { chatHref } from './OrderTable'
import { PanelDialog } from './PanelDialog'
import { RecordPaymentDialog } from './RecordPaymentDialog'

type Action = 'pay' | 'adjust' | 'cancel'

/** Những việc NCC làm được với đơn lúc này (nút ở chân hộp chi tiết). */
function availableActions(o: ServiceOrder) {
  const st = o.status === 'CONFIRMED' ? adjustmentStateOf(o) : null
  return {
    pay: o.status === 'CONFIRMED' && (currentVersion(o)?.content.installments.length ?? 0) > 0,
    /** null: không lập được (đang chờ khách duyệt phương án, hoặc đơn chưa xác nhận) */
    adjust:
      o.status !== 'CONFIRMED' || st?.kind === 'AWAITING_CONFIRMATION'
        ? null
        : st?.kind === 'REVISION_REQUESTED'
          ? { label: 'Sửa phương án', revise: st.adjustment }
          : { label: o.adjustmentRequest ? 'Lập phương án điều chỉnh' : 'Đề nghị điều chỉnh', revise: undefined },
    cancel: canCancelOrder(o),
  }
}

interface OrderManagerProps {
  orderId: string
  /** Mở luôn hộp thao tác (link từ thẻ đơn trong chat) */
  initialAction: 'pay' | 'adjust' | null
  onClose: () => void
}

/** Chi tiết một đơn ở trang Quản lý đơn hàng, cùng các hộp ghi nhận thanh toán, điều chỉnh, hủy đơn. */
export function OrderManager({ orderId, initialAction, onClose }: OrderManagerProps) {
  const { data: order, isPending, isError, error } = useOrder(orderId)
  const [action, setAction] = useState<Action | null>(initialAction)

  if (isPending) return null
  if (isError || !order) {
    return (
      <PanelDialog open size="md" onRequestClose={onClose} title="Không mở được đơn" footer={<Button onClick={onClose}>Đóng</Button>}>
        <p className="text-sm">{error instanceof ApiError && error.status === 404 ? `Đơn ${orderId} không tồn tại hoặc thuộc tài khoản khác.` : error?.message}</p>
      </PanelDialog>
    )
  }

  const can = availableActions(order)
  return (
    <>
      <OrderDetailDialog
        order={order}
        onClose={onClose}
        actions={
          <>
            {can.cancel && (
              <Button variant="ghost" className="mr-auto text-warn hover:bg-warn-soft hover:text-warn max-sm:mr-0" onClick={() => setAction('cancel')}>
                <Ban />
                Hủy đơn
              </Button>
            )}
            <Button asChild variant="outline" className="border-line-strong">
              <Link to={chatHref(order)}>
                <MessageSquare />
                Mở trò chuyện
              </Link>
            </Button>
            {can.adjust && (
              <Button variant="outline" className="border-line-strong" onClick={() => setAction('adjust')}>
                <SlidersHorizontal />
                {can.adjust.label}
              </Button>
            )}
            {can.pay && (
              <Button onClick={() => setAction('pay')}>
                <CreditCard />
                Ghi nhận thanh toán
              </Button>
            )}
          </>
        }
      />
      {action === 'pay' && can.pay && <RecordPaymentDialog order={order} onClose={() => setAction(null)} />}
      {action === 'adjust' && can.adjust && <AdjustmentDialog order={order} revise={can.adjust.revise} onClose={() => setAction(null)} />}
      {action === 'cancel' && can.cancel && <CancelOrderDialog order={order} onClose={() => setAction(null)} />}
    </>
  )
}

import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { controlClass, Field } from '@/features/vendors/components/FormParts'
import { cn } from '@/lib/utils'
import type { ServiceOrder } from '@/types/serviceOrder'
import { useCancelOrder } from '../hooks'
import { PanelDialog } from './PanelDialog'

/** Hủy đơn: chỉ khi chưa có khoản thu nào (chưa nhận cọc), cần lý do. Đơn đã gửi khách thì khách nhận tin trong chat. */
export function CancelOrderDialog({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const cancel = useCancelOrder(order.id)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function submit() {
    if (!reason.trim()) return setError('Nhập lý do hủy đơn.')
    setError('')
    cancel.mutate(reason.trim(), { onSuccess: onClose, onError: (e) => setError(e.message) })
  }

  return (
    <PanelDialog
      open
      size="md"
      onRequestClose={() => !cancel.isPending && onClose()}
      title={`Hủy đơn ${order.code}?`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={cancel.isPending}>
            Không hủy
          </Button>
          <Button variant="destructive" onClick={submit} disabled={cancel.isPending}>
            {cancel.isPending && <LoaderCircle className="animate-spin" />}
            Hủy đơn
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm leading-relaxed">
        Đơn chưa có khoản thu nào nên hủy được. Sau khi hủy, đơn không sửa, gửi lại hay nhận thanh toán được nữa.
        {order.versions.length > 0 ? ' Khách sẽ thấy thông báo hủy kèm lý do trong cuộc trò chuyện.' : ' Đơn chưa gửi khách nên khách không nhận thông báo.'}
      </p>
      <Field label="Lý do hủy *" error={error}>
        <textarea
          rows={3}
          autoFocus
          className={cn(controlClass, 'h-auto py-2 leading-relaxed')}
          aria-invalid={error ? true : undefined}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="VD: Khách đổi địa điểm tổ chức, xin hủy trước khi đặt cọc."
        />
      </Field>
    </PanelDialog>
  )
}

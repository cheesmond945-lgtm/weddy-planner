import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { controlClass, Field } from '@/features/vendors/components/FormParts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderPaymentMethod, ServiceOrder } from '@/types/serviceOrder'
import { OFFLINE_METHODS, PAYMENT_METHOD_LABEL } from '../constants'
import { useRecordPayment } from '../hooks'
import { PanelDialog } from './PanelDialog'

/** Giờ hiện tại dạng "YYYY-MM-DDTHH:mm" cho ô datetime-local. */
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

/**
 * NCC xác nhận đã nhận phần còn lại (đợt 2) khách trả trực tiếp. Đặt cọc do hệ thống ghi nhận khi khách thanh toán trực tuyến.
 * Ghi nhận xong đơn hoàn thành: lập hóa đơn và tính hoa hồng.
 */
export function RecordPaymentDialog({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const record = useRecordPayment(order.id)
  const rest = order.totalAmount - order.paidAmount

  const [method, setMethod] = useState<OrderPaymentMethod>('CASH')
  const [paidAt, setPaidAt] = useState(nowLocal)
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  function submit() {
    const e: Record<string, string> = {}
    if (!paidAt) e.paidAt = 'Chọn thời điểm nhận.'
    if (!confirmed) e.confirmed = 'Xác nhận đã nhận thực tế khoản tiền.'
    setErrors(e)
    if (Object.keys(e).length) return
    setFormError('')
    record.mutate(
      { installmentId: 'final', amount: rest, paidAt: new Date(paidAt).toISOString(), method, proofFile: null, note: null },
      { onSuccess: onClose, onError: (err) => setFormError(err.message) },
    )
  }

  return (
    <PanelDialog
      open
      size="md"
      onRequestClose={() => !record.isPending && onClose()}
      title={`Xác nhận thu đủ ${order.code}`}
      subtitle={`Tổng ${formatMoney(order.totalAmount)} · đã thu ${formatMoney(order.paidAmount)} · còn lại ${formatMoney(rest)}`}
      footer={
        <>
          {formError && <p role="alert" className="mr-auto text-[13px] text-destructive max-sm:basis-full">{formError}</p>}
          <Button variant="ghost" onClick={onClose} disabled={record.isPending}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={record.isPending || rest <= 0}>
            {record.isPending && <LoaderCircle className="animate-spin" />}
            Xác nhận đã thu đủ
          </Button>
        </>
      }
    >
      <fieldset disabled={record.isPending} className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3.5 max-sm:grid-cols-1">
        <Field label="Số tiền thực nhận" full hint="Phần còn lại sau khi trừ tiền cọc. Xác nhận xong, đơn được đánh dấu hoàn thành.">
          <p className="rounded-sm border border-line bg-surface-2 px-3 py-2 text-[15px] font-semibold tabular-nums">{formatMoney(rest)}</p>
        </Field>
        <Field label="Thời điểm nhận *" error={errors.paidAt}>
          <Input type="datetime-local" className={controlClass} value={paidAt} max={nowLocal()} onChange={(e) => setPaidAt(e.target.value)} />
        </Field>
        <Field label="Phương thức thực tế" group>
          <div role="radiogroup" className="inline-flex w-fit gap-1 rounded-sm border border-line-strong bg-surface-2 p-1">
            {OFFLINE_METHODS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={cn('rounded-[6px] px-3.5 py-1.5 text-[13px] text-muted-foreground', method === m && 'bg-surface font-semibold text-ink shadow-soft')}
              >
                {PAYMENT_METHOD_LABEL[m]}
              </button>
            ))}
          </div>
        </Field>
        <div className="col-span-full">
          <label className="flex items-start gap-2 text-[13.5px]">
            <input
              type="checkbox"
              className="mt-1 accent-gold"
              checked={confirmed}
              onChange={(e) => {
                setConfirmed(e.target.checked)
                if (e.target.checked) setErrors(({ confirmed: _, ...r }) => r)
              }}
            />
            Tôi xác nhận đã nhận thực tế khoản tiền này.
          </label>
          {errors.confirmed && (
            <p role="alert" className="mt-1 text-[13px] text-destructive">
              {errors.confirmed}
            </p>
          )}
        </div>
      </fieldset>
    </PanelDialog>
  )
}

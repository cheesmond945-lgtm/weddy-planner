import { LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { controlClass, Field, Notice } from '@/features/vendors/components/FormParts'
import { ProofFileField } from '@/features/vendors/components/ProofFileField'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderPaymentMethod, ServiceOrder } from '@/types/serviceOrder'
import type { VendorFile } from '@/types/vendor'
import { currentVersion } from '../calc'
import { OFFLINE_METHODS, PAYMENT_METHOD_LABEL } from '../constants'
import { useRecordPayment } from '../hooks'
import { PanelDialog } from './PanelDialog'

/** Giờ hiện tại dạng "YYYY-MM-DDTHH:mm" cho ô datetime-local. */
const nowLocal = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16)

/**
 * NCC ghi nhận khoản thu thực tế cho một đợt (PaymentModal trong prototype NCC).
 * Đặt cọc mặc định khách trả qua VNPay và hệ thống tự ghi nhận; NCC chỉ ghi nhận cọc khi khách trả trực tiếp.
 */
export function RecordPaymentDialog({ order, onClose }: { order: ServiceOrder; onClose: () => void }) {
  const record = useRecordPayment(order.id)
  const insts = currentVersion(order)?.content.installments ?? []
  const paidOf = (id: string) => order.payments.filter((p) => p.installmentId === id).reduce((s, p) => s + p.amount, 0)
  const first = insts.find((i) => paidOf(i.id) < i.amount) ?? insts[0]

  const [instId, setInstId] = useState(first?.id ?? '')
  const inst = insts.find((i) => i.id === instId)
  const [amount, setAmount] = useState(first ? Math.max(0, first.amount - paidOf(first.id)) : 0)
  const [method, setMethod] = useState<OrderPaymentMethod>(first?.method === 'CASH' ? 'CASH' : 'BANK_TRANSFER')
  const [paidAt, setPaidAt] = useState(nowLocal)
  const [note, setNote] = useState('')
  const [proof, setProof] = useState<VendorFile | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  const total = order.totalAmount
  const over = order.paidAmount + amount - total

  function submit() {
    const e: Record<string, string> = {}
    if (!inst) e.inst = 'Chọn đợt liên quan.'
    if (!(amount > 0)) e.amount = 'Số tiền phải lớn hơn 0.'
    if (!paidAt) e.paidAt = 'Chọn thời điểm nhận.'
    if (!confirmed) e.confirmed = 'Xác nhận đã nhận thực tế khoản tiền.'
    setErrors(e)
    if (Object.keys(e).length) return
    setFormError('')
    record.mutate(
      { installmentId: instId, amount, paidAt: new Date(paidAt).toISOString(), method, proofFile: proof, note: note.trim() || null },
      { onSuccess: onClose, onError: (err) => setFormError(err.message) },
    )
  }

  return (
    <PanelDialog
      open
      size="md"
      onRequestClose={() => !record.isPending && onClose()}
      title={`Ghi nhận thanh toán ${order.code}`}
      subtitle={`Tổng ${formatMoney(total)} · đã thu ${formatMoney(order.paidAmount)}`}
      footer={
        <>
          {formError && <p role="alert" className="mr-auto text-[13px] text-destructive max-sm:basis-full">{formError}</p>}
          <Button variant="ghost" onClick={onClose} disabled={record.isPending}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={record.isPending || !insts.length}>
            {record.isPending && <LoaderCircle className="animate-spin" />}
            Ghi nhận khoản thu
          </Button>
        </>
      }
    >
      {!insts.length ? (
        <p className="text-sm text-muted-foreground">Đơn chưa có đợt thanh toán nào.</p>
      ) : (
        <fieldset disabled={record.isPending} className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3.5 max-sm:grid-cols-1">
          <Field
            label="Đợt liên quan"
            error={errors.inst}
            full
            hint={
              inst?.id === insts[0]?.id
                ? 'Đặt cọc trả qua VNPay được hệ thống tự ghi nhận. Chỉ ghi nhận ở đây khi khách trả cọc trực tiếp (chuyển khoản, tiền mặt).'
                : undefined
            }
          >
            <select
              className={controlClass}
              value={instId}
              onChange={(e) => {
                const next = insts.find((i) => i.id === e.target.value)
                if (!next) return
                setInstId(next.id)
                setAmount(Math.max(0, next.amount - paidOf(next.id)))
                setMethod(next.method === 'CASH' ? 'CASH' : 'BANK_TRANSFER')
              }}
            >
              {insts.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {formatMoney(i.amount)} · đã thu {formatMoney(paidOf(i.id))}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Số tiền thực nhận *" error={errors.amount}>
            <MoneyInput className={cn(controlClass, 'text-right tabular-nums')} aria-invalid={errors.amount ? true : undefined} value={amount} onChange={setAmount} />
          </Field>
          <Field label="Thời điểm nhận *" error={errors.paidAt}>
            <Input type="datetime-local" className={controlClass} value={paidAt} max={nowLocal()} onChange={(e) => setPaidAt(e.target.value)} />
          </Field>
          <Field
            label="Phương thức thực tế"
            full
            group
            hint={
              inst && method !== inst.method ? (
                <span className="text-gold-ink">
                  Khác phương thức dự kiến ({PAYMENT_METHOD_LABEL[inst.method]}). Giao dịch lưu theo thực tế, giữ thông tin dự kiến để đối chiếu.
                </span>
              ) : undefined
            }
          >
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
          <Field label="Tệp minh chứng" full group hint="Tùy chọn · Ảnh chuyển khoản, phiếu thu… PDF hoặc ảnh, tối đa 10MB.">
            <ProofFileField value={proof} onChange={setProof} />
          </Field>
          <Field label="Ghi chú đối chiếu" full>
            <Input className={controlClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Mã giao dịch, người nhận tiền mặt…" />
          </Field>
          <div className="col-span-full">
            {over > 0 && (
              <Notice tone="warn" title={`Khoản này vượt số còn phải thu ${formatMoney(over)}. Hệ thống ghi nhận thanh toán thừa, không tự đánh dấu đã hoàn tiền.`} />
            )}
            <label className="flex items-start gap-2 text-[13.5px]">
              <input
                type="checkbox"
                className="mt-1 accent-gold"
                checked={confirmed}
                onChange={(e) => {
                  setConfirmed(e.target.checked)
                  if (e.target.checked) setErrors(({ confirmed: _, ...rest }) => rest)
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
      )}
    </PanelDialog>
  )
}

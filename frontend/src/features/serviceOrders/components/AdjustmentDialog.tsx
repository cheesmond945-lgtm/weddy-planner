import { AlertCircle, LoaderCircle, MessageSquare } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { controlClass, Field, Notice } from '@/features/vendors/components/FormParts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderAdjustment, OrderContent, OrderInstallment, OrderLine, ServiceOrder } from '@/types/serviceOrder'
import { cleanContent, currentVersion, diffContent, newLine, totalOf } from '../calc'
import { useProposeAdjustment } from '../hooks'
import { validateAdjustment, type OrderErrors } from '../validation'
import { InstallmentsEditor } from './InstallmentsEditor'
import { OrderLinesEditor } from './OrderLinesEditor'
import { PanelDialog } from './PanelDialog'

const DEFAULT_FEE_NAME = 'Phí giảm số lượng (theo chính sách đã thỏa thuận)'

/**
 * Tổng mới đổi: chia lại phần còn phải thu cho các đợt chưa có khoản thu, theo tỷ trọng hiện tại;
 * đợt chưa thu cuối cùng nhận phần lẻ (như prototype NCC). Đợt đã thu giữ nguyên.
 */
function redistribute(insts: OrderInstallment[], total: number, locked: string[]): OrderInstallment[] {
  const open = insts.filter((i) => !locked.includes(i.id))
  if (!open.length) return insts
  const lockedSum = insts.filter((i) => locked.includes(i.id)).reduce((s, i) => s + i.amount, 0)
  const rest = Math.max(0, total - lockedSum)
  const base = open.reduce((s, i) => s + i.amount, 0) || open.length
  let left = rest
  return insts.map((i) => {
    if (locked.includes(i.id)) return i
    const amount = i.id === open[open.length - 1].id ? left : Math.round((rest * (i.amount || 1)) / base)
    left -= amount
    return { ...i, amount, rate: null }
  })
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-[18px] border-b border-line pb-[18px] last:mb-0 last:border-b-0 last:pb-1">
      <h4 className="mb-3 font-sans text-[15px] font-semibold tracking-normal">{title}</h4>
      {children}
    </section>
  )
}

interface AdjustmentDialogProps {
  order: ServiceOrder
  /** Có: sửa lại phương án khách yêu cầu sửa */
  revise?: OrderAdjustment
  onClose: () => void
}

/** Lập / sửa phương án điều chỉnh đơn đã xác nhận, gửi khách qua chat (AdjustmentModal trong prototype NCC). */
export function AdjustmentDialog({ order, revise, onClose }: AdjustmentDialogProps) {
  const propose = useProposeAdjustment(order.id)
  const base = currentVersion(order)!.content
  const locked = [...new Set(order.payments.map((p) => p.installmentId))]
  const source = revise ? revise.after : base
  // Phí theo chính sách đang có (từ phương án đang sửa, hoặc từ lần điều chỉnh trước đã có hiệu lực)
  const existingFee = source.lines.find((l) => l.isPolicyFee)

  const [lines, setLines] = useState<OrderLine[]>(() => structuredClone(source.lines.filter((l) => !l.isPolicyFee)))
  const [fee, setFee] = useState({ on: !!existingFee, name: existingFee?.name ?? DEFAULT_FEE_NAME, amount: existingFee?.unitPrice ?? 0 })
  const [insts, setInsts] = useState<OrderInstallment[]>(() => structuredClone(source.installments))
  const [reason, setReason] = useState(revise?.reason ?? '')
  const [checked, setChecked] = useState(false)
  const [formError, setFormError] = useState('')

  const feeLine = (f = fee): OrderLine[] =>
    f.on && f.amount > 0 ? [{ ...newLine(), id: 'policy-fee', name: f.name, unit: 'Khoản', quantity: 1, unitPrice: f.amount, isPolicyFee: true }] : []
  const allLines = [...lines, ...feeLine()]
  const total = totalOf(allLines)
  const after: OrderContent = { ...base, lines: allLines, installments: insts }
  const changes = diffContent(base, cleanContent(after))
  const paid = order.paidAmount
  const rest = total - paid
  const beforeTotal = totalOf(base.lines)

  const errors: OrderErrors = checked ? validateAdjustment(after, locked) : {}
  if (checked && !reason.trim()) errors.reason = 'Nhập lý do điều chỉnh.'
  if (checked && fee.on && !(fee.amount > 0)) errors.fee = 'Nhập số tiền phí đã thỏa thuận hoặc tắt mục phí.'

  // Đổi báo giá hoặc phí thì chia lại các đợt chưa thanh toán theo tổng mới
  const changeLines = (next: OrderLine[], nextFee = fee) => {
    setLines(next)
    setFee(nextFee)
    setInsts((cur) => redistribute(cur, totalOf([...next, ...feeLine(nextFee)]), locked))
  }

  function submit() {
    setChecked(true)
    setFormError('')
    const found = validateAdjustment(after, locked)
    if (!reason.trim() || (fee.on && !(fee.amount > 0)) || Object.keys(found).length) return
    if (!changes.length) return setFormError('Chưa có thay đổi so với đơn hiệu lực.')
    propose.mutate({ reason: reason.trim(), after, revisionOf: revise?.id ?? null }, { onSuccess: onClose, onError: (e) => setFormError(e.message) })
  }

  const request = revise ? { title: 'Khách yêu cầu sửa phương án', text: revise.customerNote } : order.adjustmentRequest ? { title: 'Khách yêu cầu điều chỉnh', text: order.adjustmentRequest.note } : null
  const title = revise ? `Sửa phương án điều chỉnh ${order.code}` : order.adjustmentRequest ? `Lập phương án điều chỉnh ${order.code}` : `Đề nghị điều chỉnh ${order.code}`

  return (
    <PanelDialog
      open
      size="xl"
      onRequestClose={() => !propose.isPending && onClose()}
      title={title}
      subtitle={paid > 0 ? 'Đơn đã có khoản thu, thay đổi chỉ có hiệu lực khi khách đồng ý.' : 'Thay đổi chỉ có hiệu lực khi khách đồng ý.'}
      footer={
        <>
          {formError && (
            <p role="alert" className="mr-auto flex items-center gap-1.5 text-[13px] text-destructive max-sm:basis-full">
              <AlertCircle className="size-[15px] flex-none" />
              {formError}
            </p>
          )}
          <Button variant="ghost" onClick={onClose} disabled={propose.isPending}>
            Hủy
          </Button>
          <Button onClick={submit} disabled={propose.isPending}>
            {propose.isPending ? (
              <>
                <LoaderCircle className="animate-spin" />
                Đang gửi…
              </>
            ) : revise ? (
              'Gửi lại cho khách'
            ) : (
              'Gửi khách xác nhận'
            )}
          </Button>
        </>
      }
    >
      {request && (
        <div className="mb-4 rounded-md border border-warn/35 bg-warn-soft px-3.5 py-2.5">
          <p className="flex items-center gap-2 text-warn">
            <MessageSquare className="size-4" />
            <strong className="font-semibold">{request.title}</strong>
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">{request.text}</p>
        </div>
      )}

      <fieldset disabled={propose.isPending} className="min-w-0">
        <Section title="Báo giá sau điều chỉnh">
          <OrderLinesEditor lines={lines} onChange={(next) => changeLines(next)} errors={errors} packages={[]} />
          <div className="mt-3 grid gap-1.5 rounded-md border border-dashed border-line-strong px-3.5 py-3">
            <label className="flex items-center gap-2 text-[13.5px]">
              <input type="checkbox" className="accent-gold" checked={fee.on} onChange={(e) => changeLines(lines, { ...fee, on: e.target.checked })} />
              Áp dụng phí điều chỉnh theo chính sách đã thỏa thuận với khách
            </label>
            {fee.on && (
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
                <Field label="Tên khoản phí">
                  <Input className={controlClass} value={fee.name} onChange={(e) => setFee({ ...fee, name: e.target.value })} />
                </Field>
                <Field label="Số tiền phí" error={errors.fee}>
                  <MoneyInput className={cn(controlClass, 'text-right tabular-nums')} value={fee.amount} onChange={(amount) => changeLines(lines, { ...fee, amount })} />
                </Field>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Phí hiển thị thành dòng riêng, không cộng vào đơn giá.</p>
          </div>
        </Section>

        <Section title="Các khoản chưa thanh toán">
          <InstallmentsEditor installments={insts} onChange={setInsts} total={total} errors={errors} showAllocation={false} locked={locked} />
        </Section>

        <Section title="Lý do & đối chiếu">
          <Field label="Lý do điều chỉnh *" error={errors.reason}>
            <textarea
              rows={2}
              className={cn(controlClass, 'h-auto py-2 leading-relaxed')}
              aria-invalid={errors.reason ? true : undefined}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Khách giảm từ 20 xuống 15 bàn."
            />
          </Field>
          <dl className="m-0 mt-3 grid grid-cols-4 gap-2.5 max-sm:grid-cols-2">
            {[
              ['Tổng trước', formatMoney(beforeTotal), ''],
              ['Tổng sau', formatMoney(total), 'font-semibold'],
              ['Đã thu (giữ nguyên)', formatMoney(paid), ''],
              [rest >= 0 ? 'Còn phải thu' : 'Thanh toán thừa', formatMoney(Math.abs(rest)), rest < 0 ? 'text-warn' : ''],
            ].map(([k, v, tone]) => (
              <div key={k} className="rounded-[9px] border border-line bg-surface-2 px-3 py-2.5">
                <dt className="text-xs text-muted-foreground">{k}</dt>
                <dd className={cn('m-0 text-base tabular-nums', tone)}>{v}</dd>
              </div>
            ))}
          </dl>
          {rest < 0 && (
            <div className="mt-3">
              <Notice tone="warn" title={`Tiền đã thu vượt tổng mới ${formatMoney(-rest)}. Ghi nhận khoản cần xử lý hoàn, hệ thống không tự đánh dấu đã hoàn tiền.`} />
            </div>
          )}
          {changes.length > 0 && (
            <div className="mt-3 rounded-md bg-info-soft px-3.5 py-3 text-[13.5px]">
              <strong className="text-info">Thay đổi sẽ gửi khách</strong>
              <ul className="mt-1.5 grid list-disc gap-0.5 pl-5">
                {changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      </fieldset>
    </PanelDialog>
  )
}

import { Check, Copy, FlaskConical, LoaderCircle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { USE_MOCK } from '@/api'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDay, formatStamp } from '@/features/serviceOrders/calc'
import { StatusBadge } from '@/features/serviceOrders/components/OrderBadges'
import { orderPageHref } from '@/features/serviceOrders/components/OrderCard'
import { PanelDialog } from '@/features/serviceOrders/components/PanelDialog'
import { PAYMENT_METHOD_LABEL } from '@/features/serviceOrders/constants'
import { controlClass, Field, Notice } from '@/features/vendors/components/FormParts'
import { ProofFileField } from '@/features/vendors/components/ProofFileField'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { CommissionStatement } from '@/types/commission'
import type { VendorFile } from '@/types/vendor'
import { canSubmitProof, COMMISSION_PAYMENT_STATUS, COMMISSION_STATUS, formatPeriod, remainingOf } from '../constants'
import { useCommissionStatement, useSimulateReview, useSubmitCommissionPayment } from '../hooks'

const H = ({ children }: { children: ReactNode }) => (
  <h4 className="mt-[22px] mb-2.5 font-sans text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase first:mt-0">{children}</h4>
)
const th = 'border-y border-line bg-surface-2 px-3 py-2 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
const td = 'border-b border-line px-3 py-2.5 align-top text-[13.5px]'
const num = 'text-right tabular-nums whitespace-nowrap'

/** Thông tin chuyển khoản WebPlan, sao chép nội dung chuyển khoản (bank-card trong prototype NCC). */
function TransferCard({ statement: s }: { statement: CommissionStatement }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard
      ?.writeText(s.transfer.content)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {})
  }
  const rows: [string, ReactNode][] = [
    ['Tên', s.transfer.accountName],
    ['Ngân hàng', s.transfer.bankName],
    ['Tài khoản', s.transfer.accountNumber],
    [
      'Nội dung',
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <code className="rounded-sm bg-surface-2 px-1.5 py-0.5 select-all">{s.transfer.content}</code>
        <button type="button" aria-label="Sao chép nội dung chuyển khoản" title="Sao chép" onClick={copy} className="grid size-7 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-ink">
          {copied ? <Check className="size-3.5 text-sage" /> : <Copy className="size-3.5" />}
        </button>
      </span>,
    ],
  ]
  return (
    <dl className="m-0 grid gap-2 rounded-md border border-line bg-surface-2 px-4 py-3 text-[13.5px]">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="m-0 min-w-0 [overflow-wrap:anywhere]">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Gửi minh chứng đã chuyển tiền hoa hồng (số tiền, tệp, ghi chú đối chiếu). */
function ProofForm({ statement: s }: { statement: CommissionStatement }) {
  const submit = useSubmitCommissionPayment(s.id)
  const rest = remainingOf(s)
  const [amount, setAmount] = useState(rest)
  const [proof, setProof] = useState<VendorFile | null>(null)
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')

  function send() {
    const e: Record<string, string> = {}
    if (!(amount > 0)) e.amount = 'Số tiền phải lớn hơn 0.'
    else if (amount > rest) e.amount = `Không vượt số còn phải trả (${formatMoney(rest)}).`
    if (!proof) e.proof = 'Cần tải tệp minh chứng.'
    setErrors(e)
    if (Object.keys(e).length || !proof) return
    setFormError('')
    submit.mutate({ amount, proofFile: proof, note: note.trim() || null }, { onError: (err) => setFormError(err.message) })
  }

  return (
    <fieldset disabled={submit.isPending} className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 max-sm:grid-cols-1">
      <Field label="Số tiền *" error={errors.amount}>
        <MoneyInput className={cn(controlClass, 'text-right tabular-nums')} aria-invalid={errors.amount ? true : undefined} value={amount} onChange={setAmount} />
      </Field>
      <Field label="Tệp minh chứng *" group>
        <ProofFileField value={proof} onChange={setProof} error={errors.proof} disabled={submit.isPending} />
      </Field>
      <Field label="Ghi chú đối chiếu" full>
        <Input className={controlClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Ngân hàng, mã giao dịch, ngày chuyển…" />
      </Field>
      <div className="col-span-full flex flex-wrap items-center gap-3">
        <Button onClick={send}>
          {submit.isPending && <LoaderCircle className="animate-spin" />}
          Gửi minh chứng
        </Button>
        {formError && <span role="alert" className="text-[13px] text-destructive">{formError}</span>}
      </div>
      <p className="col-span-full text-[12.5px] text-muted-foreground">Chỉ khi WebPlan (Admin) xác nhận, số tiền còn trả mới giảm.</p>
    </fieldset>
  )
}

/** CHỈ CÓ KHI DÙNG MOCK: giả lập Admin xác nhận / từ chối minh chứng đang chờ. */
function MockReview({ id }: { id: string }) {
  const review = useSimulateReview(id)
  if (!USE_MOCK) return null
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-sm border border-dashed border-info/50 bg-info-soft px-3 py-2 text-[12.5px] text-info">
      <FlaskConical className="size-4" />
      Dữ liệu giả, giả lập Admin:
      <Button size="sm" variant="outline" className="border-info/40" disabled={review.isPending} onClick={() => review.mutate('CONFIRMED')}>
        Xác nhận
      </Button>
      <Button size="sm" variant="outline" className="border-info/40" disabled={review.isPending} onClick={() => review.mutate('REJECTED')}>
        Từ chối
      </Button>
    </div>
  )
}

/** Chi tiết một kỳ đối soát (prototype NCC: popup "Đối soát MM/YYYY"). */
export function StatementDetailDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: s, isPending, isError, error } = useCommissionStatement(id)
  if (isPending) return null
  if (isError || !s) {
    return (
      <PanelDialog open size="md" onRequestClose={onClose} title="Không mở được bảng kê" footer={<Button onClick={onClose}>Đóng</Button>}>
        <p className="text-sm">{error?.message}</p>
      </PanelDialog>
    )
  }
  const rest = remainingOf(s)

  return (
    <PanelDialog
      open
      onRequestClose={onClose}
      title={`Đối soát ${formatPeriod(s.period)}`}
      subtitle={`${s.code} · ${s.orderCount} đơn hoàn thành${s.supplementCount ? ` + ${s.supplementCount} khoản bổ sung` : ''} · chốt ${formatDate(s.closingDate)} · hạn ${formatDate(s.dueDate)}`}
      footer={<Button onClick={onClose}>Đóng</Button>}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusBadge tone={COMMISSION_STATUS[s.status].tone}>{COMMISSION_STATUS[s.status].label}</StatusBadge>
        {s.isOverdue && <StatusBadge tone="warn">Quá hạn</StatusBadge>}
      </div>
      <div className="mb-1 grid grid-cols-3 gap-2.5 max-sm:grid-cols-1">
        {[
          ['Hoa hồng', formatMoney(s.commissionAmount), ''],
          ['Đã xác nhận', formatMoney(s.paidAmount), 'text-sage'],
          ['Còn trả', formatMoney(rest), rest ? 'text-gold-ink' : 'text-sage'],
        ].map(([k, v, tone]) => (
          <p key={k} className="grid gap-0.5 rounded-[9px] border border-line bg-surface-2 px-3 py-2.5 text-xs text-muted-foreground">
            <span>{k}</span>
            <strong className={cn('text-base text-ink tabular-nums', tone)}>{v}</strong>
          </p>
        ))}
      </div>
      {s.status === 'OPEN' && (
        <div className="mt-3">
          <Notice tone="info" title={`Kỳ đang tạm tính. Bảng kê chốt ngày ${formatDate(s.closingDate)}, sau đó mới thanh toán được.`} />
        </div>
      )}

      <H>Đơn và đợt tính hoa hồng</H>
      {s.lines.length ? (
        <div className="relative overflow-x-auto rounded-md border border-line">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>Đơn</th>
                <th className={th}>Ngày sự kiện</th>
                <th className={th}>Các khoản đã thu</th>
                <th className={cn(th, 'text-right')}>Căn cứ</th>
                <th className={cn(th, 'text-right')}>Tỷ lệ</th>
                <th className={cn(th, 'text-right')}>Hoa hồng</th>
              </tr>
            </thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.id} className="last:[&>td]:border-b-0">
                  <td className={td}>
                    <Link to={orderPageHref({ id: l.orderId })} className="font-semibold text-gold-ink tabular-nums hover:underline">
                      {l.orderCode}
                    </Link>
                    <span className="block">{l.customerName}</span>
                    {l.kind === 'SUPPLEMENT' && (
                      <span className="mt-1 inline-block rounded-pill bg-info-soft px-2 text-[11px] text-info">Bổ sung · đơn kỳ {formatPeriod(l.originPeriod ?? '')}</span>
                    )}
                  </td>
                  <td className={cn(td, 'whitespace-nowrap')}>{formatDay(l.eventDate)}</td>
                  <td className={cn(td, 'min-w-[200px]')}>
                    <ul className="grid gap-1">
                      {l.payments.map((p) => (
                        <li key={p.paymentId} className="flex flex-wrap justify-between gap-x-3 text-[12.5px]">
                          <span>
                            {p.installmentName}
                            <span className="text-muted-foreground"> · {formatStamp(p.paidAt)} · {PAYMENT_METHOD_LABEL[p.method]}</span>
                          </span>
                          <span className="tabular-nums">{formatMoney(p.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={cn(td, num)}>{formatMoney(l.baseAmount)}</td>
                  <td className={cn(td, num)}>
                    {l.rate}%<span className="block text-[11.5px] text-muted-foreground">{l.category.name}</span>
                  </td>
                  <td className={cn(td, num, 'font-semibold')}>{formatMoney(l.commissionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-[13px] text-muted-foreground">Chưa có đơn hoàn thành nào trong kỳ.</p>
      )}
      <p className="mt-2 text-[12.5px] text-muted-foreground">
        Đơn hoàn thành: đơn đã xác nhận có ngày sự kiện trong kỳ, tính trên các khoản đã thu tới ngày chốt. Khoản thu sau ngày chốt được cộng vào kỳ của tháng thu (dòng bổ sung).
      </p>

      {s.status !== 'OPEN' && (
        <>
          <H>Chuyển khoản WebPlan</H>
          <TransferCard statement={s} />
        </>
      )}

      {s.payments.length > 0 && (
        <>
          <H>Thanh toán hoa hồng</H>
          <ul className="grid gap-2">
            {s.payments.map((p) => (
              <li key={p.id} className="grid gap-1 rounded-md border border-line px-3.5 py-2.5 text-[13.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <strong className="tabular-nums">{formatMoney(p.amount)}</strong>
                  <StatusBadge tone={COMMISSION_PAYMENT_STATUS[p.status].tone}>{COMMISSION_PAYMENT_STATUS[p.status].label}</StatusBadge>
                </div>
                <p className="text-[12.5px] text-muted-foreground">
                  Gửi {formatStamp(p.submittedAt)}
                  {p.reviewedAt && ` · xử lý ${formatStamp(p.reviewedAt)}`} · Minh chứng:{' '}
                  {p.proofFile.url ? (
                    <a href={p.proofFile.url} target="_blank" rel="noreferrer" className="text-gold-ink hover:underline">
                      {p.proofFile.fileName}
                    </a>
                  ) : (
                    p.proofFile.fileName
                  )}
                </p>
                {p.note && <p className="text-[12.5px]">Ghi chú đối chiếu: {p.note}</p>}
                {p.reviewNote && <p className="text-[12.5px] text-warn">WebPlan: {p.reviewNote}</p>}
              </li>
            ))}
          </ul>
          {s.pendingAmount > 0 && <MockReview id={s.id} />}
        </>
      )}

      {canSubmitProof(s) && (
        <>
          <H>Minh chứng thanh toán</H>
          <ProofForm key={`${s.paidAmount}-${s.payments.length}`} statement={s} />
        </>
      )}
    </PanelDialog>
  )
}

import { CheckCircle2, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { ApiError } from '@/api'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { FormField } from '@/components/FormField'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { useAdminStatement, useRecordStatementPayment } from '@/features/adminPayments/hooks'
import { AdminConfirm } from '@/features/adminShared/components/AdminConfirm'
import { formatDay, formatPeriod } from '@/features/adminShared/format'
import { controlClass, FormSection, Notice } from '@/features/vendors/components/FormParts'
import { formatDate, toISODate, today } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'

const card = 'rounded-md border border-line bg-surface px-7 pt-[26px] pb-6 shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4'

/**
 * Chi tiết thanh toán một bảng kê hoa hồng: nhà cung cấp, kỳ, doanh thu, tỷ lệ, tiền hoa hồng, hạn, ngày thanh toán, mã giao dịch.
 * Ngày thanh toán và mã giao dịch do hệ thống ghi khi NCC thanh toán qua VietQR. Bảng kê đã chốt mà chưa thanh toán thì Admin
 * nhập thẳng hai ô này để ghi nhận khi NCC chuyển khoản trực tiếp (vd tài khoản bị khóa vì quá hạn), có thể mở khóa tài khoản luôn.
 */
export default function AdminPaymentDetailPage() {
  const { id = '' } = useParams()
  const { data: s, isPending, isError, error, refetch } = useAdminStatement(id)
  const record = useRecordStatementPayment()
  const [code, setCode] = useState('')
  const [paidOn, setPaidOn] = useState(() => toISODate(today()))
  const [unlock, setUnlock] = useState(true)
  const [errors, setErrors] = useState<{ transactionCode?: string; paidAt?: string; form?: string }>({})
  const [confirm, setConfirm] = useState(false)

  if (isPending) return <div aria-busy="true" aria-label="Đang tải bảng kê" className="mx-auto h-[560px] max-w-[980px] animate-pulse rounded-md bg-muted" />
  if (isError || !s) {
    return (
      <div className="mx-auto max-w-[980px]">
        <EmptyState
          title="Chưa mở được bảng kê"
          description={error?.message}
          action={
            <div className="flex gap-2">
              <Button onClick={() => refetch()}>Thử lại</Button>
              <Button asChild variant="outline">
                <Link to={paths.admin.payments}>Về danh sách</Link>
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const unpaid = s.status === 'UNPAID'
  // Kỳ đã chốt (trước tháng hiện tại, giờ Việt Nam) và có hoa hồng mới ghi nhận thanh toán được
  const recordable = unpaid && s.commissionAmount > 0 && s.period < new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7)
  const locked = s.vendorInfo.accountLocked
  const readOnly = cn(controlClass, 'bg-surface-2')
  const busy = record.isPending

  function openConfirm() {
    const found: typeof errors = {}
    if (!code.trim()) found.transactionCode = 'Nhập mã giao dịch.'
    if (!paidOn) found.paidAt = 'Chọn ngày giao dịch.'
    else if (paidOn > toISODate(today())) found.paidAt = 'Ngày giao dịch không được ở tương lai.'
    setErrors(found)
    if (!Object.keys(found).length) setConfirm(true)
  }

  function submit() {
    record.mutate(
      { id: s!.id, transactionCode: code.trim(), paidAt: paidOn, unlock: locked && unlock },
      {
        onSuccess: () => setConfirm(false),
        onError: (e) => {
          setConfirm(false)
          const details = e instanceof ApiError && e.details && typeof e.details === 'object' ? (e.details as typeof errors) : {}
          setErrors({ ...details, form: Object.keys(details).length ? undefined : e.message })
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <PageTitle
        title="Chi tiết thanh toán"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={s.status === 'PAID' ? 'done' : 'warn'} className="gap-2 border border-current/25 px-5 py-2 text-base font-bold shadow-portal">
              <i aria-hidden className="size-2.5 rounded-full bg-current" />
              {s.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán'}
            </Badge>
            {s.isOverdue && <Badge tone="warn">Quá hạn</Badge>}
            {s.lateDays && <Badge tone="warn">Trả trễ {s.lateDays} ngày</Badge>}
          </div>
        }
      />

      {recordable && (
        <Notice tone="info" title="Nhà cung cấp chuyển khoản trực tiếp cho WebPlan (ví dụ tài khoản bị khóa nên không thanh toán qua VietQR được)? Nhập ngày thanh toán và mã giao dịch rồi bấm “Ghi nhận đã thanh toán”." />
      )}

      <div className={card}>
        <FormSection title="Thông tin thanh toán">
          <div className="grid grid-cols-2 gap-x-5 gap-y-4 max-sm:grid-cols-1">
            <FormField label="Mã bảng kê" className={readOnly} disabled value={s.code} />
            <FormField label="Kỳ hoa hồng" className={readOnly} disabled value={`Tháng ${formatPeriod(s.period)}`} />
            <FormField label="Nhà cung cấp" className={readOnly} disabled value={s.vendorInfo.businessName} />
            <FormField label="Số điện thoại" className={readOnly} disabled value={s.vendorInfo.phone ?? '—'} />
            <FormField label="Lĩnh vực" className={readOnly} disabled value={s.category.name} />
            <FormField label="Số đơn hoàn thành" className={readOnly} disabled value={`${s.orderCount} đơn`} />
            <FormField label="Doanh thu (VND)" className={cn(readOnly, 'text-right tabular-nums')} disabled value={formatMoney(s.revenue)} />
            <FormField label="Tỷ lệ hoa hồng" className={cn(readOnly, 'text-right tabular-nums')} disabled value={`${s.averageRate}%`} />
            <FormField label="Tiền hoa hồng (VND)" className={cn(readOnly, 'text-right font-semibold tabular-nums')} disabled value={formatMoney(s.commissionAmount)} />
            <FormField label="Hạn thanh toán" className={readOnly} disabled value={formatDate(s.dueDate)} />
            {recordable ? (
              <>
                <FormField
                  label="Ngày thanh toán *"
                  type="date"
                  className={controlClass}
                  max={toISODate(today())}
                  value={paidOn}
                  disabled={busy}
                  onChange={(e) => setPaidOn(e.target.value)}
                  error={errors.paidAt}
                />
                <FormField
                  label="Mã giao dịch *"
                  className={controlClass}
                  placeholder="VD: FT26299123456"
                  maxLength={100}
                  value={code}
                  disabled={busy}
                  onChange={(e) => setCode(e.target.value)}
                  error={errors.transactionCode}
                />
              </>
            ) : (
              <>
                <FormField label="Ngày thanh toán" className={readOnly} disabled value={unpaid ? '—' : formatDay(s.paidAt)} />
                <FormField label="Mã giao dịch" className={readOnly} disabled value={unpaid ? '—' : (s.transactionCode ?? '—')} />
              </>
            )}
          </div>

          {recordable && (
            <div className="mt-4 grid gap-3">
              {locked && (
                <label className="flex items-center gap-2 text-[13.5px]">
                  <input type="checkbox" className="accent-gold" checked={unlock} disabled={busy} onChange={(e) => setUnlock(e.target.checked)} />
                  Tài khoản nhà cung cấp đang bị khóa: mở khóa sau khi ghi nhận
                </label>
              )}
              {errors.form && (
                <p role="alert" className="text-[13px] text-destructive">
                  {errors.form}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="button" variant="success" className="h-10" onClick={openConfirm} disabled={busy}>
                  {busy ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}
                  Ghi nhận đã thanh toán
                </Button>
              </div>
            </div>
          )}
        </FormSection>
      </div>

      <AdminConfirm
        open={confirm}
        onOpenChange={(o) => !o && !busy && setConfirm(false)}
        icon={CheckCircle2}
        confirmIcon={CheckCircle2}
        title="Ghi nhận đã thanh toán?"
        confirmLabel="Ghi nhận"
        pending={busy}
        notice={
          locked && unlock
            ? 'Bảng kê chuyển sang Đã thanh toán, tài khoản nhà cung cấp được mở khóa. Nhà cung cấp nhận được thông báo.'
            : 'Bảng kê chuyển sang Đã thanh toán. Nhà cung cấp nhận được thông báo.'
        }
        onConfirm={submit}
      >
        Bảng kê <strong className="text-ink">{s.code}</strong> của {s.vendorInfo.businessName}: {formatMoney(s.commissionAmount)}, thanh toán ngày {formatDate(paidOn)}, mã giao dịch “{code.trim()}”.
      </AdminConfirm>
    </div>
  )
}

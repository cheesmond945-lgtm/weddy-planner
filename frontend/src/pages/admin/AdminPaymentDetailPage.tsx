import { Link, useParams } from 'react-router'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { FormField } from '@/components/FormField'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { useAdminStatement } from '@/features/adminPayments/hooks'
import { formatDateTime, formatPeriod } from '@/features/adminShared/format'
import { controlClass, FormSection } from '@/features/vendors/components/FormParts'
import { formatDate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'

const card = 'rounded-md border border-line bg-surface px-7 pt-[26px] pb-6 shadow-portal max-sm:px-4 max-sm:pt-5 max-sm:pb-4'

/**
 * Chi tiết thanh toán một bảng kê hoa hồng, chỉ đọc: nhà cung cấp, kỳ, doanh thu, tỷ lệ, tiền hoa hồng, hạn, ngày thanh toán, mã giao dịch.
 * Ngày thanh toán và mã giao dịch do hệ thống ghi nhận khi NCC thanh toán qua VNPay (Admin chỉ xem, không nhập).
 */
export default function AdminPaymentDetailPage() {
  const { id = '' } = useParams()
  const { data: s, isPending, isError, error, refetch } = useAdminStatement(id)

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
  const readOnly = cn(controlClass, 'bg-surface-2')

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
          </div>
        }
      />

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
            <FormField label="Ngày thanh toán" className={readOnly} disabled value={unpaid ? '—' : formatDateTime(s.paidAt)} />
            <FormField label="Mã giao dịch" className={readOnly} disabled value={unpaid ? '—' : (s.transactionCode ?? '—')} />
          </div>
        </FormSection>
      </div>
    </div>
  )
}

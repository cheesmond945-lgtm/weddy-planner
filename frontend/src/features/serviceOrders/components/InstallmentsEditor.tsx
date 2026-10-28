import { Input } from '@/components/ui/input'
import { controlClass } from '@/features/vendors/components/FormParts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderInstallment } from '@/types/serviceOrder'
import { rebalance } from '../calc'
import { PAYMENT_METHOD_LABEL } from '../constants'
import type { OrderErrors } from '../validation'

interface InstallmentsEditorProps {
  installments: OrderInstallment[]
  onChange: (installments: OrderInstallment[]) => void
  total: number
  errors: OrderErrors
  /** Giữ để tương thích với nơi gọi; không còn dùng (đơn luôn có đúng hai đợt, cộng đủ tổng đơn) */
  showAllocation?: boolean
  locked?: string[]
}

const cell = cn(controlClass, 'h-10')

/**
 * Hai đợt thanh toán của đơn (khớp CSDL): đợt 1 đặt cọc theo tỷ lệ phần trăm, khách trả trực tuyến qua cổng thanh toán;
 * đợt 2 là phần còn lại, khách trả trực tiếp cho nhà cung cấp. Chỉ nhập tỷ lệ cọc và hạn đặt cọc.
 */
export function InstallmentsEditor({ installments, onChange, total, errors }: InstallmentsEditorProps) {
  const deposit = installments[0]
  const rest = installments[1]
  const rate = deposit?.rate ?? null

  const commit = (nextRate: number | null, dueDate: string) => {
    const base = (i: OrderInstallment | undefined, fallback: Partial<OrderInstallment>): OrderInstallment => ({
      id: i?.id ?? fallback.id!,
      name: fallback.name!,
      rate: null,
      amount: 0,
      dueDate: '',
      method: fallback.method!,
      note: null,
    })
    const d = { ...base(deposit, { id: 'deposit', name: 'Đợt 1 – Đặt cọc', method: 'VIETQR' }), rate: nextRate, dueDate }
    const r = { ...base(rest, { id: 'final', name: 'Đợt 2 – Thanh toán còn lại', method: 'CASH' }), rate: nextRate === null ? null : 100 - nextRate, dueDate: rest?.dueDate ?? '' }
    onChange(rebalance([d, r], total))
  }

  const th = 'border-b border-line pr-2 pb-2 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
  const td = 'border-b border-dashed border-line py-1.5 pr-2 align-top'
  const err = (m?: string) => m && <span className="mt-0.5 block text-xs leading-snug text-destructive">{m}</span>
  const rateError = errors[`inst:${deposit?.id}:rate`] ?? errors.installments

  return (
    <div className="grid gap-3">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[200px]" />
            <col className="w-[110px]" />
            <col className="w-[160px]" />
            <col className="w-[160px]" />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>Đợt</th>
              <th className={th}>Tỷ lệ (%)</th>
              <th className={th}>Số tiền (VNĐ)</th>
              <th className={th}>Hạn thanh toán</th>
              <th className={th}>Cách thanh toán</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className={cn(td, 'pt-3 text-[13.5px]')}>Đợt 1 – Đặt cọc</td>
              <td className={td}>
                <div className="relative">
                  <Input
                    className={cn(cell, 'pr-7 text-right tabular-nums')}
                    inputMode="numeric"
                    placeholder="VD: 30"
                    aria-label="Tỷ lệ đặt cọc (%)"
                    aria-invalid={rateError ? true : undefined}
                    value={rate === null ? '' : String(rate)}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '')
                      if (v !== '' && Number(v) > 99) return
                      commit(v === '' ? null : Number(v), deposit?.dueDate ?? '')
                    }}
                  />
                  <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[13px] text-muted-foreground">%</span>
                </div>
                {err(rateError)}
              </td>
              <td className={cn(td, 'pt-3 text-right text-[13.5px] tabular-nums')}>{formatMoney(deposit?.amount ?? 0)}</td>
              <td className={td}>
                <Input
                  type="date"
                  className={cn(cell, 'px-2')}
                  aria-label="Hạn đặt cọc"
                  aria-invalid={errors[`inst:${deposit?.id}:dueDate`] ? true : undefined}
                  value={deposit?.dueDate ?? ''}
                  onChange={(e) => commit(rate, e.target.value)}
                />
                {err(errors[`inst:${deposit?.id}:dueDate`])}
              </td>
              <td className={cn(td, 'pt-3 text-[13px] text-muted-foreground')}>{PAYMENT_METHOD_LABEL.VIETQR}</td>
            </tr>
            <tr>
              <td className={cn(td, 'pt-3 text-[13.5px]')}>Đợt 2 – Thanh toán còn lại</td>
              <td className={cn(td, 'pt-3 text-right text-[13.5px] tabular-nums')}>{rate === null ? '—' : `${100 - rate}%`}</td>
              <td className={cn(td, 'pt-3 text-right text-[13.5px] tabular-nums')}>{formatMoney(rest?.amount ?? 0)}</td>
              <td className={cn(td, 'pt-3 text-[13px] text-muted-foreground')}>Ngày sự kiện</td>
              <td className={cn(td, 'pt-3 text-[13px] text-muted-foreground')}>Khách trả trực tiếp cho nhà cung cấp</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { Info, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { Input } from '@/components/ui/input'
import { controlClass } from '@/features/vendors/components/FormParts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderInstallment, OrderPaymentMethod } from '@/types/serviceOrder'
import { newInstallment, scheduledOf, withAmount, withRate } from '../calc'
import { OFFLINE_METHODS, PAYMENT_METHOD_LABEL } from '../constants'
import type { OrderErrors } from '../validation'

interface InstallmentsEditorProps {
  installments: OrderInstallment[]
  onChange: (installments: OrderInstallment[]) => void
  total: number
  errors: OrderErrors
  /** Đã bấm gửi: hiện cảnh báo phân bổ ngay cả khi chưa có lỗi từ kiểm tra */
  showAllocation: boolean
}

const cell = cn(controlClass, 'h-10')

/** Ô tỷ lệ %: tối đa 2 chữ số thập phân, không quá 100 (RateInput trong prototype NCC). */
function RateInput({ value, onChange, label, invalid }: { value: number | null; onChange: (v: number | null) => void; label: string; invalid?: boolean }) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? (value === null ? '' : String(value))
  return (
    <div className="relative">
      <Input
        className={cn(cell, 'pr-7 text-right tabular-nums')}
        inputMode="decimal"
        placeholder="0"
        aria-label={label}
        aria-invalid={invalid || undefined}
        value={shown}
        onFocus={() => setText(shown)}
        onBlur={() => setText(null)}
        onChange={(e) => {
          const v = e.target.value.replace(',', '.').replace(/\s/g, '')
          if (!/^\d{0,3}(\.\d{0,2})?$/.test(v) || Number(v) > 100) return
          setText(v)
          onChange(v === '' || v === '.' ? null : Number(v))
        }}
      />
      <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[13px] text-muted-foreground">%</span>
    </div>
  )
}

/**
 * Các đợt thanh toán: tên, tỷ lệ, số tiền, hạn, phương thức, ghi chú (InstallmentTable trong prototype NCC).
 * Đợt 1 là đặt cọc, khách trả qua VNPay; các đợt sau chuyển khoản hoặc tiền mặt.
 */
export function InstallmentsEditor({ installments, onChange, total, errors, showAllocation }: InstallmentsEditorProps) {
  const update = (id: string, fn: (i: OrderInstallment) => OrderInstallment) => onChange(installments.map((i) => (i.id === id ? fn(i) : i)))
  const e = (i: OrderInstallment, f: string) => errors[`inst:${i.id}:${f}`]
  const err = (m?: string) => m && <span className="mt-0.5 block text-xs leading-snug text-destructive">{m}</span>

  const diff = total - scheduledOf(installments)
  // Chênh lệch nhỏ do làm tròn khi mọi đợt đều nhập theo tỷ lệ và tổng tỷ lệ đúng 100%
  const rounding =
    diff !== 0 &&
    Math.abs(diff) <= installments.length * 2 &&
    installments.every((i) => i.rate !== null) &&
    Math.abs(installments.reduce((s, i) => s + (i.rate ?? 0), 0) - 100) < 1e-4

  const allocation = errors.allocation ?? (showAllocation && total > 0 && diff !== 0 && !rounding
    ? diff > 0
      ? `Các đợt thanh toán còn thiếu ${formatMoney(diff)}.`
      : `Các đợt thanh toán đang vượt tổng đơn ${formatMoney(-diff)}.`
    : undefined)

  const th = 'border-b border-line pr-2 pb-2 text-left text-[11.5px] font-medium tracking-[0.04em] whitespace-nowrap text-muted-foreground uppercase'
  const td = 'border-b border-dashed border-line py-1.5 pr-2 align-top'

  return (
    <div className="grid gap-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] table-fixed border-collapse">
          <colgroup>
            <col className="w-[180px]" />
            <col className="w-[100px]" />
            <col className="w-[160px]" />
            <col className="w-[150px]" />
            <col className="w-[160px]" />
            <col />
            <col className="w-9" />
          </colgroup>
          <thead>
            <tr>
              <th className={th}>Tên đợt</th>
              <th className={th}>Tỷ lệ (%)</th>
              <th className={th}>Số tiền (VNĐ)</th>
              <th className={th}>Hạn thanh toán</th>
              <th className={th}>Phương thức</th>
              <th className={th}>Ghi chú</th>
              <th className={th}>
                <span className="sr-only">Xóa</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {installments.map((i, idx) => (
              <tr key={i.id}>
                <td className={td}>
                  <Input
                    className={cell}
                    aria-label={`Tên đợt ${idx + 1}`}
                    aria-invalid={e(i, 'name') ? true : undefined}
                    value={i.name}
                    onChange={(ev) => update(i.id, (x) => ({ ...x, name: ev.target.value }))}
                  />
                  {err(e(i, 'name'))}
                </td>
                <td className={td}>
                  <RateInput label={`Tỷ lệ đợt ${idx + 1}`} value={i.rate} invalid={!!e(i, 'rate')} onChange={(rate) => update(i.id, (x) => withRate(x, rate, total))} />
                  {err(e(i, 'rate'))}
                </td>
                <td className={td}>
                  <MoneyInput
                    className={cn(cell, 'text-right tabular-nums')}
                    aria-label={`Số tiền đợt ${idx + 1}`}
                    aria-invalid={e(i, 'amount') ? true : undefined}
                    value={i.amount}
                    onChange={(amount) => update(i.id, (x) => withAmount(x, amount, total))}
                  />
                  {err(e(i, 'amount'))}
                </td>
                <td className={td}>
                  <Input
                    type="date"
                    className={cn(cell, 'px-2')}
                    aria-label={`Hạn thanh toán đợt ${idx + 1}`}
                    aria-invalid={e(i, 'dueDate') ? true : undefined}
                    value={i.dueDate}
                    onChange={(ev) => update(i.id, (x) => ({ ...x, dueDate: ev.target.value }))}
                  />
                  {err(e(i, 'dueDate'))}
                </td>
                <td className={td}>
                  {idx === 0 ? (
                    <div className={cn(cell, 'flex items-center bg-surface-2 px-2 text-[13px] text-muted-foreground')} title="Khách đặt cọc trực tuyến qua VNPay">
                      {PAYMENT_METHOD_LABEL.VNPAY}
                    </div>
                  ) : (
                    <select
                      className={cn(cell, 'px-2')}
                      aria-label={`Phương thức đợt ${idx + 1}`}
                      value={i.method}
                      onChange={(ev) => update(i.id, (x) => ({ ...x, method: ev.target.value as OrderPaymentMethod }))}
                    >
                      {OFFLINE_METHODS.map((m) => (
                        <option key={m} value={m}>
                          {PAYMENT_METHOD_LABEL[m]}
                        </option>
                      ))}
                    </select>
                  )}
                </td>
                <td className={td}>
                  <Input
                    className={cell}
                    aria-label={`Ghi chú đợt ${idx + 1}`}
                    placeholder="Ghi chú"
                    value={i.note ?? ''}
                    onChange={(ev) => update(i.id, (x) => ({ ...x, note: ev.target.value || null }))}
                  />
                </td>
                <td className={cn(td, 'pt-2 text-right')}>
                  {idx > 0 && (
                    <button
                      type="button"
                      aria-label={`Xóa ${i.name}`}
                      title="Xóa đợt"
                      onClick={() => onChange(installments.filter((x) => x.id !== i.id))}
                      className="grid size-7 place-items-center rounded-sm text-warn hover:bg-warn-soft"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => onChange([...installments, newInstallment(installments.length, total, installments)])}
          className="inline-flex items-center gap-1.5 py-1.5 text-[13px] font-medium text-gold-ink hover:underline"
        >
          <Plus className="size-4" />
          Thêm đợt thanh toán
        </button>
        {rounding && (
          <p className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-gold-ink">
            <Info className="size-3.5" />
            Chênh lệch làm tròn {formatMoney(Math.abs(diff))}.
            <button
              type="button"
              className="font-medium underline-offset-2 hover:underline"
              onClick={() => {
                const last = installments[installments.length - 1]
                onChange(installments.map((i) => (i.id === last.id ? withAmount(i, i.amount + diff, total) : i)))
              }}
            >
              Dồn vào đợt cuối
            </button>
          </p>
        )}
      </div>
      {allocation && (
        <p role="alert" data-field-error className="text-[13px] text-destructive">
          {allocation}
        </p>
      )}
    </div>
  )
}

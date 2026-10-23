import { Plus, X } from 'lucide-react'
import { useId } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { Input } from '@/components/ui/input'
import { controlClass } from '@/features/vendors/components/FormParts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { OrderLine } from '@/types/serviceOrder'
import { isBlankLine, lineAmount, newLine, totalOf } from '../calc'
import { UNIT_OPTIONS } from '../constants'
import type { OrderErrors } from '../validation'

/** Gói đã đăng dùng để điền nhanh một dòng. */
export interface QuickFillPackage {
  id: string
  name: string
  price: number | null
  /** Nhà hàng tính theo Bàn, lĩnh vực khác theo Gói */
  unit: string
}

interface OrderLinesEditorProps {
  lines: OrderLine[]
  onChange: (lines: OrderLine[]) => void
  errors: OrderErrors
  packages: QuickFillPackage[]
}

const cell = cn(controlClass, 'h-[38px]')
const err = (m?: string) => m && <span className="mt-0.5 block text-xs leading-snug text-destructive">{m}</span>

/** Báo giá chi tiết: hạng mục, đơn vị, số lượng, đơn giá, thành tiền (QuoteEditor trong prototype NCC). */
export function OrderLinesEditor({ lines, onChange, errors, packages }: OrderLinesEditorProps) {
  const unitsId = useId()
  const update = (id: string, patch: Partial<OrderLine>) => onChange(lines.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  const remove = (id: string) => {
    const rest = lines.filter((l) => l.id !== id)
    onChange(rest.length ? rest : [newLine()])
  }

  function quickFill(id: string) {
    const p = packages.find((x) => x.id === id)
    if (!p) return
    const filled: OrderLine = { ...newLine(), packageId: p.id, name: p.name, unit: p.unit, quantity: 1, unitPrice: p.price ?? 0 }
    const blank = lines.findIndex(isBlankLine)
    onChange(blank >= 0 ? lines.map((l, i) => (i === blank ? filled : l)) : [...lines, filled])
  }

  const grid = 'grid grid-cols-[36px_minmax(160px,2.4fr)_minmax(90px,1fr)_minmax(80px,.8fr)_minmax(130px,1.3fr)_minmax(120px,1.2fr)_36px] items-start gap-2.5'

  return (
    <div>
      {packages.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2.5">
          <span className="text-[12.5px] text-muted-foreground">Điền nhanh từ gói đã đăng (vẫn sửa được):</span>
          <select aria-label="Điền nhanh từ gói" value="" onChange={(e) => quickFill(e.target.value)} className={cn(controlClass, 'h-[34px] w-auto text-[13px]')}>
            <option value="">Chọn gói…</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div aria-hidden className={cn(grid, 'border-b border-line pb-1.5 text-[11.5px] font-medium tracking-[0.04em] text-muted-foreground uppercase max-md:hidden')}>
        <span>STT</span>
        <span>Hạng mục</span>
        <span>Đơn vị tính</span>
        <span>Số lượng</span>
        <span>Đơn giá</span>
        <span className="text-right">Thành tiền</span>
        <span />
      </div>

      {lines.map((l, i) => (
        <div
          key={l.id}
          className={cn(
            grid,
            'border-b border-dashed border-line py-1.5',
            'max-md:grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_32px] max-md:gap-y-2 max-md:py-3 max-md:[grid-template-areas:"stt_name_name_del"_"._unit_qty_."_"._price_amt_."]',
            l.isPolicyFee && 'rounded-sm bg-gold-soft',
          )}
        >
          <span className="pt-2.5 text-center text-muted-foreground tabular-nums max-md:[grid-area:stt]">{i + 1}</span>
          <div className="min-w-0 max-md:[grid-area:name]">
            <Input
              className={cell}
              aria-label={`Hạng mục ${i + 1}`}
              aria-invalid={errors[`line:${l.id}:name`] ? true : undefined}
              placeholder="VD: Tiệc cưới – Menu A"
              value={l.name}
              onChange={(e) => update(l.id, { name: e.target.value })}
            />
            {l.isPolicyFee && <span className="mt-1 inline-block rounded-pill bg-gold-soft px-2 text-[11px] text-gold-ink">Phí theo chính sách đã thỏa thuận</span>}
            {err(errors[`line:${l.id}:name`])}
          </div>
          <div className="min-w-0 max-md:[grid-area:unit]">
            <Input className={cell} aria-label={`Đơn vị tính ${i + 1}`} list={unitsId} placeholder="Bàn" value={l.unit} onChange={(e) => update(l.id, { unit: e.target.value })} />
          </div>
          <div className="min-w-0 max-md:[grid-area:qty]">
            <Input
              className={cn(cell, 'text-right tabular-nums')}
              type="number"
              min={1}
              step="any"
              placeholder="0"
              aria-label={`Số lượng ${i + 1}`}
              aria-invalid={errors[`line:${l.id}:quantity`] ? true : undefined}
              value={l.quantity || ''}
              onChange={(e) => update(l.id, { quantity: Number(e.target.value) || 0 })}
            />
            {err(errors[`line:${l.id}:quantity`])}
          </div>
          <div className="min-w-0 max-md:[grid-area:price]">
            <MoneyInput
              className={cn(cell, 'text-right tabular-nums')}
              aria-label={`Đơn giá ${i + 1}`}
              placeholder="Đơn giá"
              aria-invalid={errors[`line:${l.id}:unitPrice`] ? true : undefined}
              value={l.unitPrice}
              onChange={(unitPrice) => update(l.id, { unitPrice })}
            />
            {err(errors[`line:${l.id}:unitPrice`])}
          </div>
          <span className="pt-2.5 text-right font-semibold whitespace-nowrap tabular-nums max-md:[grid-area:amt] max-md:self-center max-md:pt-0">{formatMoney(lineAmount(l))}</span>
          <button
            type="button"
            aria-label={`Xóa dòng ${i + 1}`}
            onClick={() => remove(l.id)}
            className="grid size-9 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-ink max-md:[grid-area:del]"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
      <datalist id={unitsId}>
        {UNIT_OPTIONS.map((u) => (
          <option key={u} value={u} />
        ))}
      </datalist>

      {errors.lines && (
        <p role="alert" data-field-error className="mt-1.5 text-[13px] text-destructive">
          {errors.lines}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => onChange([...lines, newLine()])} className="inline-flex items-center gap-1.5 py-1.5 text-[13px] font-medium text-gold-ink hover:underline">
          <Plus className="size-4" />
          Thêm hạng mục
        </button>
        <div className="ml-auto flex items-baseline gap-4 pt-1.5">
          <span className="text-[13.5px] text-muted-foreground">Tổng giá trị đơn</span>
          <strong className="text-[22px] font-bold tracking-tight text-gold-ink tabular-nums">{formatMoney(totalOf(lines))}</strong>
        </div>
      </div>
    </div>
  )
}

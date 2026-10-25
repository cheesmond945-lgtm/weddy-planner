import { Plus, X } from 'lucide-react'
import { MoneyInput } from '@/components/MoneyInput'
import { Input } from '@/components/ui/input'
import { controlClass } from '@/features/vendors/components/FormParts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ORDER_UNITS, type OrderUnit } from '@/types/vendorOrder'
import { isBlankItem, itemAmount, newItem, totalOf, type FormItem } from '../calc'
import type { OrderErrors } from '../validation'

/** Gói đã đăng dùng để điền nhanh một dòng (chỉ tiện nhập, đơn không liên kết với gói). */
export interface QuickFillPackage {
  id: string
  name: string
  price: number
  /** Nhà hàng tính theo Bàn, lĩnh vực khác theo Gói */
  unit: OrderUnit
}

interface OrderItemsEditorProps {
  items: FormItem[]
  onChange: (items: FormItem[]) => void
  errors: OrderErrors
  packages: QuickFillPackage[]
}

const cell = cn(controlClass, 'h-[38px]')
const err = (m?: string) => m && <span className="mt-0.5 block text-xs leading-snug text-destructive">{m}</span>

/** Báo giá chi tiết: hạng mục, đơn vị (Gói hoặc Bàn), số lượng, đơn giá, thành tiền (OrderItems). */
export function OrderItemsEditor({ items, onChange, errors, packages }: OrderItemsEditorProps) {
  const update = (key: string, patch: Partial<FormItem>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const remove = (key: string) => {
    const rest = items.filter((i) => i.key !== key)
    onChange(rest.length ? rest : [newItem()])
  }

  function quickFill(id: string) {
    const p = packages.find((x) => x.id === id)
    if (!p) return
    const filled: FormItem = { ...newItem(p.unit), itemName: p.name, unitPrice: p.price }
    const blank = items.findIndex(isBlankItem)
    onChange(blank >= 0 ? items.map((i, k) => (k === blank ? filled : i)) : [...items, filled])
  }

  const grid = 'grid grid-cols-[36px_minmax(160px,2.4fr)_minmax(90px,.9fr)_minmax(80px,.8fr)_minmax(130px,1.3fr)_minmax(120px,1.2fr)_36px] items-start gap-2.5'

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

      {items.map((it, i) => (
        <div
          key={it.key}
          className={cn(
            grid,
            'border-b border-dashed border-line py-1.5',
            'max-md:grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_32px] max-md:gap-y-2 max-md:py-3 max-md:[grid-template-areas:"stt_name_name_del"_"._unit_qty_."_"._price_amt_."]',
          )}
        >
          <span className="pt-2.5 text-center text-muted-foreground tabular-nums max-md:[grid-area:stt]">{i + 1}</span>
          <div className="min-w-0 max-md:[grid-area:name]">
            <Input
              className={cell}
              aria-label={`Hạng mục ${i + 1}`}
              aria-invalid={errors[`item:${i}:itemName`] ? true : undefined}
              placeholder="VD: Tiệc cưới – Menu A"
              value={it.itemName}
              onChange={(e) => update(it.key, { itemName: e.target.value })}
            />
            {err(errors[`item:${i}:itemName`])}
          </div>
          <div className="min-w-0 max-md:[grid-area:unit]">
            <select
              className={cell}
              aria-label={`Đơn vị tính ${i + 1}`}
              value={it.unit}
              // Gói: số lượng mặc định 1; Bàn: số lượng tùy chỉnh
              onChange={(e) => {
                const unit = e.target.value as OrderUnit
                update(it.key, { unit, ...(unit === 'Gói' && { quantity: 1 }) })
              }}
            >
              {ORDER_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 max-md:[grid-area:qty]">
            <Input
              className={cn(cell, 'text-right tabular-nums')}
              type="number"
              min={1}
              step={1}
              placeholder="0"
              aria-label={`Số lượng ${i + 1}`}
              aria-invalid={errors[`item:${i}:quantity`] ? true : undefined}
              value={it.quantity || ''}
              onChange={(e) => update(it.key, { quantity: Number(e.target.value) || 0 })}
            />
            {err(errors[`item:${i}:quantity`])}
          </div>
          <div className="min-w-0 max-md:[grid-area:price]">
            <MoneyInput
              className={cn(cell, 'text-right tabular-nums')}
              aria-label={`Đơn giá ${i + 1}`}
              placeholder="Đơn giá"
              aria-invalid={errors[`item:${i}:unitPrice`] ? true : undefined}
              value={it.unitPrice}
              onChange={(unitPrice) => update(it.key, { unitPrice })}
            />
            {err(errors[`item:${i}:unitPrice`])}
          </div>
          <span className="pt-2.5 text-right font-semibold whitespace-nowrap tabular-nums max-md:[grid-area:amt] max-md:self-center max-md:pt-0">{formatMoney(itemAmount(it))}</span>
          <button
            type="button"
            aria-label={`Xóa dòng ${i + 1}`}
            onClick={() => remove(it.key)}
            className="grid size-9 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-ink max-md:[grid-area:del]"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}

      {errors.items && (
        <p role="alert" data-field-error className="mt-1.5 text-[13px] text-destructive">
          {errors.items}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => onChange([...items, newItem()])} className="inline-flex items-center gap-1.5 py-1.5 text-[13px] font-medium text-gold-ink hover:underline">
          <Plus className="size-4" />
          Thêm hạng mục
        </button>
        <div className="ml-auto flex items-baseline gap-4 pt-1.5">
          <span className="text-[13.5px] text-muted-foreground">Tổng giá trị đơn</span>
          <strong className="text-[22px] font-bold tracking-tight text-gold-ink tabular-nums">{formatMoney(totalOf(items))}</strong>
        </div>
      </div>
    </div>
  )
}

import { Plus, X } from 'lucide-react'
import { MoneyInput } from '@/components/MoneyInput'
import { Input } from '@/components/ui/input'
import { controlClass } from '@/features/vendors/components/FormParts'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ORDER_UNITS, type OrderUnit } from '@/types/vendorOrder'
import { itemAmount, newItem, totalOf, type FormItem } from '../calc'
import { packageNote, suggestPackage, type LinkPackage } from '../orderLines'
import type { OrderErrors } from '../validation'

interface OrderItemsEditorProps {
  items: FormItem[]
  onChange: (items: FormItem[]) => void
  errors: OrderErrors
  /** Gói có thể gắn vào dòng (lĩnh vực không có sảnh). Rỗng với Trung tâm tiệc cưới: chỉ gắn sảnh, qua ô Sảnh */
  packages: LinkPackage[]
  /** Mọi gói / sảnh của NCC, chỉ để hiện tên và số công việc ở chữ nhỏ dưới dòng */
  lookup: LinkPackage[]
  /** Trung tâm tiệc cưới: sảnh đã chọn. Dòng gắn sảnh này khoá tên, đơn vị, gói; không xoá được */
  hall: LinkPackage | null
  /** Sửa đơn sau khi khách cọc: vẫn đổi được gói (việc chi tiết đổi theo khi lưu: trùng tên giữ tiến độ, gói cũ bỏ, gói mới thêm); chỉ đổi chữ nhỏ dưới dòng */
  lockPackages: boolean
  /** Sửa sau cọc: gói của đơn lúc cọc (việc đã tạo); gói vừa đổi sang thì chữ nhỏ ghi "sẽ đổi khi lưu" */
  depositedPackageIds?: readonly string[]
}

const cell = cn(controlClass, 'h-[38px]')
const err = (m?: string) => m && <span className="mt-0.5 block text-xs leading-snug text-destructive">{m}</span>

/**
 * Báo giá chi tiết: hạng mục, đơn vị (Gói hoặc Bàn), số lượng, đơn giá, thành tiền (OrderItems).
 * Liên kết việc chi tiết chỉ dựa vào gói của dòng (không dựa vào tên dòng): sửa tên thoải mái.
 * - Lĩnh vực không có sảnh: dropdown gói dưới mỗi dòng ("Gói tùy chỉnh" cho dòng tự nhập); dòng gắn gói khoá đơn vị theo gói.
 * - Trung tâm tiệc cưới: chỉ ô Sảnh (ngoài bảng); dòng sảnh tự tạo, còn lại là dòng tự nhập.
 */
export function OrderItemsEditor({ items, onChange, errors, packages, lookup, hall, lockPackages, depositedPackageIds }: OrderItemsEditorProps) {
  const update = (key: string, patch: Partial<FormItem>) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  const remove = (key: string) => {
    const rest = items.filter((i) => i.key !== key)
    onChange(rest.length ? rest : [newItem()])
  }

  /**
   * Chọn gói cho một dòng: gắn gói, đơn giá và đơn vị luôn nhảy theo gói (NCC điều chỉnh giá thì nhập lại sau); tên nhảy theo nếu còn trống
   * hoặc đang là tên một gói (tên tự đặt thì giữ). Bỏ gói thì giữ nguyên nội dung.
   */
  function pickPackage(it: FormItem, id: string) {
    const p = packages.find((x) => x.id === id)
    if (!p) return update(it.key, { packageId: null })
    const autoName = it.itemName.trim() === '' || lookup.some((x) => x.name === it.itemName)
    update(it.key, {
      packageId: p.id,
      unit: p.unit,
      unitPrice: p.price,
      ...(autoName && { itemName: p.name }),
      ...(p.unit === 'Gói' && { quantity: 1 }),
    })
  }

  const grid = 'grid grid-cols-[36px_minmax(160px,2.4fr)_minmax(90px,.9fr)_minmax(80px,.8fr)_minmax(130px,1.3fr)_minmax(120px,1.2fr)_36px] items-start gap-2.5'

  return (
    <div>
      <div aria-hidden className={cn(grid, 'border-b border-line pb-1.5 text-[11.5px] font-medium tracking-[0.04em] text-muted-foreground uppercase max-md:hidden')}>
        <span>STT</span>
        <span>Hạng mục</span>
        <span>Đơn vị tính</span>
        <span>Số lượng</span>
        <span>Đơn giá</span>
        <span className="text-right">Thành tiền</span>
        <span />
      </div>

      {items.map((it, i) => {
        const isHall = !!hall && it.packageId === hall.id
        const linked = !!it.packageId
        const pkg = lookup.find((p) => p.id === it.packageId)
        const switched = lockPackages && !!it.packageId && !!depositedPackageIds && !depositedPackageIds.includes(it.packageId)
        const note = switched ? `Đổi sang ${isHall ? 'sảnh' : 'gói'} ${pkg?.name ?? ''} · công việc đổi theo khi lưu (trùng tên giữ tiến độ)` : packageNote(it, pkg, isHall ? 'hall' : 'package', lockPackages)
        const suggestion = !isHall ? suggestPackage(it, packages) : null
        // Dòng gắn gói (không phải sảnh) khoá đơn vị theo gói; dòng tự nhập cho chọn đơn vị
        const unitFixed = isHall || (linked && packages.length > 0)
        return (
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
                placeholder={isHall ? undefined : 'Tự nhập, VD: Tiệc cưới – Menu A'}
                disabled={isHall}
                value={it.itemName}
                onChange={(e) => update(it.key, { itemName: e.target.value })}
              />
              {err(errors[`item:${i}:itemName`])}
              {/* Lĩnh vực không có sảnh: một dropdown gói duy nhất cho mỗi dòng (đổi được cả sau khi khách cọc) */}
              {!isHall && packages.length > 0 && (
                <select className={cn(cell, 'mt-1 h-8 text-[12.5px]')} aria-label={`Gói dịch vụ ${i + 1}`} value={it.packageId ?? ''} onChange={(e) => pickPackage(it, e.target.value)}>
                  <option value="">Gói tùy chỉnh</option>
                  {it.packageId && !packages.some((p) => p.id === it.packageId) && <option value={it.packageId}>Gói đã gắn (đang ẩn)</option>}
                  {packages.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {note && <span className="mt-1 block text-xs text-muted-foreground">{note}</span>}
              {linked && pkg?.taskCount === 0 && <span className="mt-0.5 block text-xs text-warn">{isHall ? 'Sảnh' : 'Gói'} này chưa có công việc nào</span>}
              {suggestion && (
                <span className="mt-1 block text-xs text-gold-ink">
                  Có phải bạn muốn gắn gói “{suggestion.name}”?{' '}
                  <button type="button" className="font-semibold underline underline-offset-2" onClick={() => pickPackage(it, suggestion.id)}>
                    Gắn gói
                  </button>
                </span>
              )}
            </div>
            <div className="min-w-0 max-md:[grid-area:unit]">
              {unitFixed ? (
                <span className="block pt-2 text-[13.5px]" aria-label={`Đơn vị tính ${i + 1}`}>
                  {it.unit}
                </span>
              ) : (
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
              )}
            </div>
            <div className="min-w-0 max-md:[grid-area:qty]">
              <Input
                className={cn(cell, 'text-right tabular-nums')}
                type="number"
                // Dòng sảnh: không đặt dưới số bàn tối thiểu của gói (nút giảm dừng ở mức tối thiểu, gõ thấp hơn thì rời ô tự nâng lên), chỉ tăng thêm
                min={isHall && hall?.minTables ? hall.minTables : 1}
                step={1}
                placeholder="0"
                aria-label={`Số lượng ${i + 1}`}
                aria-invalid={errors[`item:${i}:quantity`] ? true : undefined}
                value={it.quantity || ''}
                onChange={(e) => update(it.key, { quantity: Number(e.target.value) || 0 })}
                onBlur={() => {
                  const min = isHall && hall?.minTables ? hall.minTables : 0
                  if (min && it.quantity < min) update(it.key, { quantity: min })
                }}
              />
              {err(errors[`item:${i}:quantity`])}
              {/* Dòng sảnh: luôn hiện số bàn tối thiểu của gói, không đợi nhập sai */}
              {isHall && hall?.minTables && !errors[`item:${i}:quantity`] ? <span className="mt-0.5 block text-xs text-muted-foreground">Tối thiểu {hall.minTables} bàn</span> : null}
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
            {isHall ? (
              <span aria-hidden className="size-9 max-md:[grid-area:del]" />
            ) : (
              <button
                type="button"
                aria-label={`Xóa dòng ${i + 1}`}
                onClick={() => remove(it.key)}
                className="grid size-9 place-items-center rounded-sm text-muted-foreground hover:bg-surface-2 hover:text-ink max-md:[grid-area:del]"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        )
      })}

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

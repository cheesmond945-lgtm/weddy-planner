import { ChevronDown, Lock } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import type { Budget, BudgetVendor, PlanItem } from '@/types/wedding'
import { packageLabel, packageOptionText } from '../budgetView'
import { useChoosePackage, usePatchWedding } from '../hooks'

/**
 * Ô "Gói" trên một dòng của bảng Ngân sách: bấm để đổi gói (cùng danh sách gói với tab Dịch vụ).
 * `withTables` (nhà hàng, gói tính theo bàn): số bàn hiện trong ô và sửa được ở đầu danh sách gói.
 * Đã có đơn thì khóa. Không có `item` (không xem được tab Dịch vụ) thì chưa có danh sách gói, chỉ sửa được số bàn.
 */
export function BudgetPackagePicker({ vendor, item, budget, withTables }: { vendor?: BudgetVendor; item?: PlanItem; budget: Budget; withTables: boolean }) {
  const choose = useChoosePackage()
  const patch = usePatchWedding()
  const [open, setOpen] = useState(false)
  const [tables, setTables] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const pkg = item?.package ?? vendor?.package ?? null
  const locked = pkg?.source === 'ORDER'
  const { count, auto, override } = budget.tables
  const options = item?.packages ?? []

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  const select = (packageId: string | null) => {
    setOpen(false)
    if (item) choose.mutate({ vendorId: item.id, packageId })
  }

  function saveTables(next: number | null) {
    const previous = override
    setOpen(false)
    patch.mutate(
      { tableCountOverride: next },
      {
        onSuccess: () =>
          toast(next === null ? `Đã dùng số tự tính (${auto} bàn)` : `Đã đổi thành ${next} bàn`, {
            action: { label: 'Hoàn tác', onClick: () => patch.mutate({ tableCountOverride: previous }) },
          }),
      },
    )
  }

  function submitTables(e: FormEvent) {
    e.preventDefault()
    const n = Number(tables)
    if (!Number.isInteger(n) || n < 1 || n > 500) return toast('Số bàn là số nguyên từ 1 đến 500.')
    if (n === count) return setOpen(false)
    saveTables(n)
  }

  const name = vendor || item ? packageLabel(pkg).replace(', bấm để đổi', '') : null
  const tablesText = `${count} bàn`
  const text = name && withTables ? `${name} · ${tablesText}` : (name ?? tablesText)
  const canOpen = !locked && (options.length > 0 || withTables)
  const unavailable = pkg?.unavailable && <div className="mt-1 text-warn">Gói bạn chọn đã ngừng bán, đang tính theo gói dự kiến.</div>

  if (!canOpen) {
    return (
      <div className="text-[13px]">
        <span className="inline-flex items-start gap-1.5">
          {locked && <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />}
          {text}
        </span>
        {locked && <div className="text-muted-foreground">Giá theo đơn nhà cung cấp gửi.</div>}
        {unavailable}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={choose.isPending || patch.isPending}
        onClick={() => (setTables(String(count)), setOpen((o) => !o))}
        className={cn(
          'flex w-full min-w-[200px] items-center justify-between gap-2 rounded-sm border border-input bg-surface px-2.5 py-1.5 text-left text-sm text-ink transition-colors hover:border-primary disabled:opacity-60',
          open && 'border-ring',
        )}
      >
        <span>{text}</span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {withTables && <div className="mt-1 text-[12px] text-muted-foreground">{override === null ? `Số bàn tự tính từ ${budget.guestCount} khách` : `Bạn đã sửa số bàn, tự tính là ${auto}`}</div>}
      {unavailable}

      {open && (
        <div
          role="dialog"
          aria-label={item ? `Đổi gói của ${item.service.name}` : 'Sửa số bàn'}
          className="absolute top-full right-0 z-30 mt-1 w-[min(420px,90vw)] overflow-hidden rounded-md border border-line bg-surface shadow-[0_8px_24px_rgb(var(--shadow-rgb)/0.16)]"
        >
          {withTables && (
            <form onSubmit={submitTables} className="flex flex-col gap-2 border-b border-line p-3">
              <label className="flex items-center gap-2 text-[13px] font-medium">
                Số bàn
                <Input type="number" min={1} max={500} value={tables} onChange={(e) => setTables(e.target.value)} className="w-24 px-2.5 py-1.5 text-sm" autoFocus />
                <Button type="submit" size="sm" disabled={patch.isPending}>
                  Lưu
                </Button>
              </label>
              <button
                type="button"
                disabled={override === null || patch.isPending}
                onClick={() => saveTables(null)}
                className="self-start text-[13px] font-medium text-gold-700 underline underline-offset-[3px] disabled:text-muted-foreground disabled:no-underline"
              >
                Dùng số tự tính ({auto} bàn)
              </button>
            </form>
          )}
          {options.length > 0 && (
            <ul role="listbox" aria-label="Gói" className="max-h-[280px] overflow-auto py-1">
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={pkg?.source === 'PLANNED'}
                  onClick={() => select(null)}
                  className={cn('block w-full px-3.5 py-2 text-left text-sm hover:bg-accent-soft', pkg?.source === 'PLANNED' && 'font-semibold text-gold-700')}
                >
                  Dùng gói dự kiến (lớn nhất vừa ngân sách hạng mục)
                </button>
              </li>
              {options.map((p) => {
                const active = pkg?.source === 'SELECTED' && pkg.id === p.id
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      onClick={() => select(p.id)}
                      className={cn('block w-full px-3.5 py-2 text-left text-sm hover:bg-accent-soft', active && 'font-semibold text-gold-700', !p.fits && 'text-muted-foreground')}
                    >
                      {packageOptionText(p, budget.guestCount, item?.tables ?? count)}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

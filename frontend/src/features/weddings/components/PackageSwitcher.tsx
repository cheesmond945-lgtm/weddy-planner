import { ChevronDown, Lock } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { PlanItem } from '@/types/wedding'
import { packageLabel, packageOptionText } from '../budgetView'
import { useChoosePackage } from '../hooks'

/**
 * Gói đang tính của một nhà cung cấp trong kế hoạch: "Gói dự kiến, bấm để đổi" hoặc tên gói đã chọn, kèm danh sách đổi gói.
 * Đã có đơn thì khóa, giá theo đơn. Gói không đủ chỗ ghi "Không đủ cho N khách".
 */
export function PackageSwitcher({ item, guestCount }: { item: PlanItem; guestCount: number }) {
  const choose = useChoosePackage()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pkg = item.package
  const locked = pkg?.source === 'ORDER'

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
    choose.mutate({ vendorId: item.id, packageId })
  }

  const label = packageLabel(pkg)
  const text = (
    <span>
      {locked ? label.replace(', bấm để đổi', '') : label}: <b className="font-semibold text-ink">{formatMoney(item.price)}</b>
    </span>
  )

  return (
    <div ref={ref} className="relative mt-1 text-[13px] text-muted-foreground">
      {locked ? (
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-3.5" aria-hidden />
          {text}. Giá theo đơn nhà cung cấp gửi.
        </span>
      ) : !item.packages.length ? (
        text
      ) : (
        <button type="button" aria-haspopup="listbox" aria-expanded={open} disabled={choose.isPending} onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-left hover:text-ink">
          {text}
          <ChevronDown className="size-3.5" aria-hidden />
        </button>
      )}
      {pkg?.unavailable && <div className="text-warn">Gói bạn chọn đã ngừng bán, đang tính theo gói dự kiến.</div>}
      {open && (
        <ul role="listbox" aria-label={`Đổi gói của ${item.service.name}`} className="absolute top-full left-0 z-30 mt-1 max-h-[320px] w-[min(420px,90vw)] overflow-auto rounded-md border border-line bg-surface py-1 shadow-[0_8px_24px_rgb(var(--shadow-rgb)/0.16)]">
          <li>
            <button type="button" role="option" aria-selected={pkg?.source === 'PLANNED'} onClick={() => select(null)} className={cn('block w-full px-3.5 py-2 text-left text-sm hover:bg-accent-soft', pkg?.source === 'PLANNED' && 'font-semibold text-gold-700')}>
              Dùng gói dự kiến (lớn nhất vừa ngân sách hạng mục)
            </button>
          </li>
          {item.packages.map((p) => {
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
                  {packageOptionText(p, guestCount, item.tables)}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

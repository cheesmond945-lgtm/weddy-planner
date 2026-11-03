import { ArrowRight, ChevronDown, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { weddingsApi } from '@/api/weddings'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { BudgetCandidatePackage } from '@/types/wedding'
import { useRefreshPlanning } from '../hooks'

/** Gói gợi ý đang hiện trên dòng (nhóm chia: tính ở client; tiệc: backend) */
export interface ShownSuggestion {
  packageId: string
  vendorId: string
  vendorName: string
  packageName: string
  chargedTables: number | null
  cost: number
}

/** Số phương án khác hiện kèm gợi ý chính (mỗi NCC một gói); muốn xem hết thì sang Dịch vụ cưới */
const ALTERNATIVES = 2

/**
 * Phương án trong ô gợi ý: gợi ý chính trước, sau đó tối đa ALTERNATIVES gói của NCC khác, vừa số tiền gợi ý
 * (gần số tiền nhất, rồi điểm đánh giá); không đủ thì thêm gói vượt rẻ nhất. Hàm thuần.
 */
export function suggestionOptions(main: ShownSuggestion, packages: readonly BudgetCandidatePackage[], limit: number): ShownSuggestion[] {
  const seen = new Set([main.vendorId])
  const within = packages.filter((p) => p.cost <= limit).sort((a, b) => b.cost - a.cost || (b.rating ?? -1) - (a.rating ?? -1))
  const over = packages.filter((p) => p.cost > limit).sort((a, b) => a.cost - b.cost)
  const out: ShownSuggestion[] = [main]
  for (const p of [...within, ...over]) {
    if (out.length > ALTERNATIVES || seen.has(p.vendorId)) continue
    seen.add(p.vendorId)
    out.push({ packageId: p.id, vendorId: p.vendorId, vendorName: p.vendorName, packageName: p.name, chargedTables: p.chargedTables, cost: p.cost })
  }
  return out
}

const label = (s: ShownSuggestion) => `${s.vendorName} · ${s.packageName}${s.chargedTables !== null ? ` · ${s.chargedTables} bàn` : ''}`
const servicesOf = (slug: string) => `${paths.services}?category=${slug}&ai=1`

/** Thêm các gợi ý vào kế hoạch (một hoặc nhiều dòng), một thông báo kèm Hoàn tác gỡ đúng những gì vừa thêm */
export function useChooseSuggestions() {
  const refresh = useRefreshPlanning()
  const [busy, setBusy] = useState(false)
  async function choose(list: ShownSuggestion[]) {
    setBusy(true)
    const added: string[] = []
    try {
      for (const s of list) added.push((await weddingsApi.addPlanItem(s.vendorId, false, s.packageId)).id)
    } catch (e) {
      toast((e as Error).message)
    }
    if (added.length) {
      const undo = () => void Promise.all(added.map((id) => weddingsApi.removePlanItem(id))).then(refresh, (e: Error) => toast(e.message))
      toast(list.length === 1 ? `Đã chọn ${label(list[0])}` : `Đã chọn ${added.length} gợi ý cho kế hoạch`, { action: { label: 'Hoàn tác', onClick: undo } })
    }
    await refresh()
    setBusy(false)
  }
  return { choose, busy }
}

/**
 * Cột "Dịch vụ / gói" của hạng mục chưa có dịch vụ: một ô chọn cùng kiểu với ô gói của dòng đã chọn, viền nét đứt và chữ "Gợi ý"
 * để biết là web đề xuất. Mở ra: gợi ý chính + vài NCC khác kèm giá, bấm là chọn (thêm vào kế hoạch, có Hoàn tác);
 * cuối danh sách là link sang Dịch vụ cưới của hạng mục.
 */
export function BudgetSuggestionPicker({
  slug,
  suggestion,
  packages,
  limit,
}: {
  slug: string
  suggestion: ShownSuggestion | null
  packages: readonly BudgetCandidatePackage[]
  limit: number
}) {
  const { choose, busy } = useChooseSuggestions()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

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

  if (!suggestion) {
    return (
      <Link to={servicesOf(slug)} className="inline-flex items-center gap-1 self-start text-[13px] font-medium text-gold-700 hover:underline">
        Chưa có gói vừa ngân sách, tìm ở Dịch vụ cưới
        <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    )
  }
  const options = suggestionOptions(suggestion, packages, limit)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex w-full min-w-[200px] items-center justify-between gap-2 rounded-sm border border-dashed border-line-strong px-2.5 py-1.5 text-left text-sm transition-colors hover:border-primary disabled:opacity-60',
          open && 'border-ring',
        )}
      >
        <span className="min-w-0">
          <span className="text-muted-foreground">{busy ? 'Đang chọn… ' : 'Gợi ý: '}</span>
          {label(suggestion)}
        </span>
        <ChevronDown className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden />
      </button>

      {open && (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 min-w-[min(380px,90vw)] overflow-hidden rounded-md border border-line bg-surface shadow-[0_8px_24px_rgb(var(--shadow-rgb)/0.16)]">
          <ul role="listbox" aria-label="Chọn nhà cung cấp" className="py-1">
            {options.map((o, i) => (
              <li key={o.packageId}>
                <button
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => (setOpen(false), void choose([o]))}
                  className="flex w-full items-baseline justify-between gap-3 px-3.5 py-2 text-left text-sm hover:bg-accent-soft"
                >
                  <span className="min-w-0">
                    {i === 0 && <Sparkles className="mr-1 inline size-3.5 align-[-2px] text-gold-700" aria-label="Phù hợp nhất" />}
                    <span className="font-medium">{o.vendorName}</span>
                    <span className="text-muted-foreground"> · {o.packageName}</span>
                  </span>
                  <span className={cn('shrink-0 tabular-nums', o.cost > limit && 'text-warn')}>{formatMoney(o.cost)}</span>
                </button>
              </li>
            ))}
          </ul>
          <Link
            to={servicesOf(slug)}
            className="flex items-center gap-1 border-t border-line px-3.5 py-2 text-[13px] font-medium text-gold-700 hover:bg-accent-soft"
          >
            Xem tất cả ở Dịch vụ cưới
            <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}
    </div>
  )
}

/** Nút đầu bảng: chọn mọi gợi ý đang hiện trong một lần bấm (khách tin gợi ý của web), có Hoàn tác */
export function ChooseAllSuggestions({ list }: { list: ShownSuggestion[] }) {
  const { choose, busy } = useChooseSuggestions()
  if (list.length < 2) return null
  return (
    <Button size="sm" disabled={busy} onClick={() => void choose(list)}>
      <Sparkles />
      {busy ? 'Đang chọn…' : `Chọn tất cả gợi ý (${list.length})`}
    </Button>
  )
}

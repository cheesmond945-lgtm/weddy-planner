import { AlertTriangle, Download, FileSpreadsheet, Info, Lock, Pencil, SlidersHorizontal, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormField'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { weddingsApi } from '@/api/weddings'
import { costSourceText, suggestionLabelText } from '@/features/weddings/budgetView'
import { BudgetPackagePicker } from '@/features/weddings/components/BudgetPackagePicker'
import { BudgetPresetPicker } from '@/features/weddings/components/BudgetPresetPicker'
import { StatCard, StatGrid } from '@/features/weddings/components/StatCard'
import { useBudget, useBudgetMutations, usePatchWedding, usePlan } from '@/features/weddings/hooks'
import { ImportDialog } from '@/features/weddings/import/ImportDialog'
import { amountFromPercent, percentFromAmount, percentText, PRESET_LABEL, rebalanceWeights } from '@/features/weddings/presets'
import { PLAN_STATUS } from '@/features/weddings/status'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Budget, BudgetCategory, PlanItem } from '@/types/wedding'

/** Popup sửa nhanh tổng ngân sách (cùng trường với "Chỉnh sửa thông tin"), kèm Hoàn tác. */
function TotalBudgetDialog({ total, open, onOpenChange }: { total: number; open: boolean; onOpenChange: (open: boolean) => void }) {
  const patch = usePatchWedding()
  const [amount, setAmount] = useState(total)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (open) {
      setAmount(total)
      setError(undefined)
    }
  }, [open, total])

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!(amount > 0)) return setError('Vui lòng nhập tổng ngân sách lớn hơn 0.')
    if (amount === total) return onOpenChange(false)
    patch.mutate(
      { budget: amount },
      {
        onSuccess: () => {
          onOpenChange(false)
          toast(`Đã đổi tổng ngân sách thành ${formatMoney(amount)}`, {
            action: {
              label: 'Hoàn tác',
              onClick: () => patch.mutate({ budget: total }),
            },
          })
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Sửa tổng ngân sách</DialogTitle>
          <DialogDescription>Đồng bộ với thông tin kế hoạch. Phần gợi ý cho các hạng mục chưa chọn được tính lại ngay.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate>
          <label className="text-[13px] font-medium">
            Tổng ngân sách (đồng)
            <MoneyInput
              value={amount}
              onChange={(v) => (setAmount(v), setError(undefined))}
              aria-invalid={error ? true : undefined}
              className="mt-1.5 h-10 rounded-xl text-sm"
              autoFocus
            />
          </label>
          <FormError message={error ?? patch.error?.message} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Hủy
            </Button>
            <Button type="submit" disabled={patch.isPending}>
              {patch.isPending ? 'Đang lưu…' : 'Lưu'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Mức chia và tiệc tự lo. Mức chia chỉ chia phần còn lại cho các dịch vụ chưa chọn; hạng mục đã chọn giữ nguyên giá.
 * "Tùy chỉnh": thanh kéo tỷ lệ cho các dịch vụ chưa cọc (đã chọn hoặc chưa), tổng luôn 100%; dịch vụ đã cọc hiện khóa.
 * Với dịch vụ đã chọn, số đặt ở đây là "Giới hạn gợi ý" của hạng mục; gói đã chọn giữ nguyên.
 */
function AllocationSettings({ b, openSignal }: { b: Budget; openSignal: number }) {
  const { settings } = useBudgetMutations()
  const [custom, setCustom] = useState<Record<string, number> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [cost, setCost] = useState<number | null>(null)
  // Dịch vụ chưa cọc, đã chọn hoặc chưa (presetWeights chỉ gồm các hạng mục này, tổng 100)
  const services = b.categories.filter((c) => c.kind === 'SERVICE' && c.slug in b.presetWeights)
  const allChosen = !b.categories.some((c) => c.kind === 'SERVICE' && c.status === 'SUGGESTED')
  // Dịch vụ đã cọc: hiện trong bảng thanh kéo nhưng khóa (giá đã chốt theo đơn, không chia lại)
  const deposited = b.categories.filter((c) => c.kind === 'SERVICE' && c.vendors.some((v) => v.costSource === 'DEPOSITED'))
  const openKey = services.map((c) => c.slug).join(',')
  const hasVenue = b.categories.some((c) => c.kind === 'VENUE')
  // Khách chọn / bỏ một hạng mục: đóng bảng thanh kéo đang mở, mở lại sẽ lấy danh sách mới (đã chuẩn hóa 100%)
  useEffect(() => setCustom(null), [openKey])
  // Bấm "Chỉnh tỷ lệ / số tiền" ở bảng: mở bảng thanh kéo và cuộn tới
  useEffect(() => {
    if (!openSignal) return
    setCustom({ ...b.presetWeights })
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
  }, [openSignal])

  return (
    <section className="mb-5 flex flex-col gap-4 rounded-lg border border-line bg-surface px-[22px] py-5">
      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">Tất cả dịch vụ đã cọc, không còn gì để chia.</p>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <BudgetPresetPicker
              value={b.preset}
              disabled={settings.isPending}
              hint={false}
              onChange={(budgetPreset) => {
                setCustom(null)
                settings.mutate(
                  { budgetPreset },
                  {
                    onSuccess: () => toast(`Đã chuyển sang mức chia ${PRESET_LABEL[budgetPreset]}`),
                  },
                )
              }}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {allChosen ? 'Tất cả hạng mục đã được chọn. ' : ''}Mức chia đặt giới hạn gợi ý cho từng dịch vụ chưa cọc; gói đã chọn giữ nguyên giá, dịch vụ đã cọc bị khóa.
            </p>
          </div>
          {services.length > 0 && (
            <Button variant={b.preset === 'CUSTOM' ? 'default' : 'outline'} size="sm" onClick={() => setCustom(custom ? null : { ...b.presetWeights })}>
              <SlidersHorizontal />
              Tùy chỉnh{b.preset === 'CUSTOM' ? ' (đang dùng)' : ''}
            </Button>
          )}
        </div>
      )}

      {custom && services.length > 0 && (
        <div ref={panelRef} className="flex flex-col gap-3 rounded-md border border-line bg-surface-2 p-4">
          <p className="text-[13px] text-muted-foreground">
            {services.length > 1
              ? `Kéo thanh, gõ % hoặc gõ số tiền; các hạng mục khác tự co giãn để tổng bằng ${formatMoney(b.sliderPool)} (tổng ngân sách trừ tiệc, các khoản đã cọc và chi phí khác).`
              : `Chỉ còn 1 dịch vụ chưa cọc. Đặt số tiền (hoặc %) cho dịch vụ này trên ${formatMoney(b.sliderPool)}; phần không đặt sẽ không giao cho hạng mục nào.`}
          </p>
          {services.map((c) => (
            <WeightRow
              key={c.slug}
              name={c.name}
              percent={custom[c.slug] ?? 0}
              pool={b.sliderPool}
              // Một hạng mục duy nhất: đặt số tiền tuyệt đối (không co giãn), phần còn lại không giao
              onPercent={(p) => setCustom(services.length > 1 ? rebalanceWeights(custom, c.slug, p) : { [c.slug]: Math.min(100, Math.max(0, p)) })}
            />
          ))}
          {deposited.map((c) => (
            <WeightRow key={c.slug} name={c.name} percent={0} pool={b.sliderPool} lockedAmount={c.cost} />
          ))}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setCustom(null)}>
              Hủy
            </Button>
            <Button
              size="sm"
              disabled={settings.isPending || !Object.values(custom).some((v) => v > 0)}
              onClick={() =>
                settings.mutate(
                  { budgetPreset: 'CUSTOM', customWeights: custom },
                  {
                    onSuccess: () => (setCustom(null), toast('Đã lưu tỷ lệ Tùy chỉnh')),
                  },
                )
              }
            >
              Lưu tỷ lệ
            </Button>
          </div>
        </div>
      )}

      {hasVenue && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line pt-3.5 text-sm">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={b.ownVenue}
              disabled={settings.isPending}
              onChange={(e) => settings.mutate({ ownVenue: e.target.checked })}
              className="size-4 accent-[var(--gold-700)]"
            />
            Tự lo tiệc ngoài nền tảng
          </label>
          {b.ownVenue && (
            <label className="inline-flex items-center gap-2 text-muted-foreground">
              Chi phí tự lo (không bắt buộc)
              <MoneyInput
                aria-label="Chi phí tiệc tự lo"
                value={cost ?? b.ownVenueCost ?? 0}
                onChange={setCost}
                onBlur={() => {
                  if (cost !== null && cost !== (b.ownVenueCost ?? 0)) settings.mutate({ ownVenueCost: cost || null })
                  setCost(null)
                }}
                className="w-[160px] px-2.5 py-1.5 text-right text-sm text-ink"
              />
            </label>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Một dòng của bảng Tùy chỉnh: thanh kéo % và ô số tiền (= tiền đang chia × %). Gõ số tiền rồi Enter / rời ô thì đổi ra %,
 * cập nhật thanh kéo; các hạng mục khác co giãn để tổng vẫn 100%. `lockedAmount`: hạng mục đã cọc, khóa cả hai.
 */
function WeightRow({
  name,
  percent,
  pool,
  onPercent,
  lockedAmount,
}: {
  name: string
  percent: number
  pool: number
  onPercent?: (p: number) => void
  lockedAmount?: number
}) {
  const [draft, setDraft] = useState<number | null>(null)
  const [pctDraft, setPctDraft] = useState<string | null>(null)
  const locked = lockedAmount !== undefined
  const readOnly = locked || !onPercent
  const commit = () => {
    if (draft !== null && onPercent) onPercent(percentFromAmount(draft, pool))
    setDraft(null)
  }
  const commitPct = () => {
    const n = Number((pctDraft ?? '').replace(',', '.'))
    if (pctDraft !== null && pctDraft.trim() && Number.isFinite(n) && onPercent) onPercent(Math.min(100, Math.max(0, n)))
    setPctDraft(null)
  }
  const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())
  return (
    <div className="grid grid-cols-[150px_1fr_84px_150px] items-center gap-3 text-sm max-[700px]:grid-cols-[1fr_84px_130px]">
      <span className={cn('inline-flex items-center gap-1.5 max-[700px]:col-span-3', locked && 'text-muted-foreground')}>
        {locked && <Lock className="size-3.5" aria-hidden />}
        {name}
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={0.1}
        value={percent}
        disabled={readOnly}
        onChange={(e) => onPercent?.(Number(e.target.value))}
        aria-label={`Tỷ lệ ${name}`}
        className="accent-[var(--gold-700)] disabled:cursor-not-allowed disabled:opacity-50"
      />
      {locked ? (
        <span className="text-right text-muted-foreground">Đã cọc</span>
      ) : (
        <label className="flex items-center gap-1 rounded-sm border border-input bg-surface px-2 py-1.5 focus-within:border-ring">
          <input
            inputMode="decimal"
            aria-label={`Tỷ lệ % ${name}`}
            value={pctDraft ?? percentText(percent).replace('%', '')}
            disabled={readOnly}
            onChange={(e) => setPctDraft(e.target.value.replace(/[^d.,]/g, ''))}
            onBlur={commitPct}
            onKeyDown={blurOnEnter}
            className="w-full min-w-0 border-0 bg-transparent text-right text-sm outline-none disabled:text-muted-foreground"
          />
          <span className="text-muted-foreground">%</span>
        </label>
      )}
      <MoneyInput
        aria-label={`Số tiền ${name}`}
        value={locked ? lockedAmount : (draft ?? amountFromPercent(percent, pool))}
        disabled={readOnly}
        onChange={setDraft}
        onBlur={commit}
        onKeyDown={blurOnEnter}
        className="px-2.5 py-1.5 text-right text-sm disabled:opacity-60"
      />
    </div>
  )
}

function AddExtraCostForm() {
  const { addExtraCost } = useBudgetMutations()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const [error, setError] = useState<string>()

  function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return setError('Nhập tên khoản chi.')
    if (amount <= 0) return setError('Nhập số tiền.')
    setError(undefined)
    addExtraCost.mutate(
      { name: name.trim(), amount },
      {
        onSuccess: () => {
          setName('')
          setAmount(0)
          toast('Đã thêm khoản chi')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-start gap-2.5 border-t border-line pt-3.5">
      <Input
        aria-label="Tên khoản chi"
        placeholder="Ví dụ: Thiệp cưới"
        maxLength={100}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="min-w-[180px] flex-[2]"
      />
      <MoneyInput aria-label="Số tiền" placeholder="Số tiền" value={amount} onChange={setAmount} className="min-w-[140px] flex-1" />
      <Button type="submit" variant="outline" disabled={addExtraCost.isPending}>
        Thêm
      </Button>
      <div className="basis-full">
        <FormError message={error ?? addExtraCost.error?.message} />
      </div>
    </form>
  )
}

/** Dòng chi phí khác: sửa số tiền tại chỗ, xóa. */
function ExtraCostRow({ e }: { e: Budget['extraCosts'][number] }) {
  const { updateExtraCost, removeExtraCost } = useBudgetMutations()
  const [amount, setAmount] = useState<number | null>(null)
  return (
    <li className="flex items-center gap-3 border-t border-line py-2 text-sm first:border-t-0">
      <span className="flex-1">{e.name}</span>
      <MoneyInput
        aria-label={`Số tiền ${e.name}`}
        value={amount ?? e.amount}
        onChange={setAmount}
        onBlur={() => {
          if (amount && amount !== e.amount) updateExtraCost.mutate({ id: e.id, amount })
          setAmount(null)
        }}
        className="w-[150px] px-2.5 py-1.5 text-right text-sm"
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={`Xóa ${e.name}`}
        disabled={removeExtraCost.isPending}
        onClick={() => removeExtraCost.mutate(e.id)}
      >
        <Trash2 className="size-4" />
      </Button>
    </li>
  )
}

/**
 * Cột "Gợi ý" (giá trị dẫn xuất, không sửa tay). Hạng mục chưa chọn: giới hạn riêng của hạng mục (dịch vụ) hoặc Mục tiêu (tiệc),
 * kèm tỷ lệ trong mức chia; gói gợi ý vượt giới hạn thì có nhãn. Hạng mục đã chọn: "Đã chọn", kèm giới hạn và nhãn vượt nếu có.
 */
function SuggestCell({ c, onEditWeights }: { c: BudgetCategory; onEditWeights: () => void }) {
  const limit = c.shareLimit ?? c.limit
  const shareLine = c.share !== null && <span className="text-[12px] text-muted-foreground">Tỷ lệ {c.share.toLocaleString('vi-VN')}%</span>
  if (c.status === 'CHOSEN') {
    const over = c.shareLimit !== null && c.cost > c.shareLimit ? c.cost - c.shareLimit : 0
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[12px] text-muted-foreground">Đã chọn</span>
        {c.shareLimit !== null && <span className="text-[12px] text-muted-foreground">Giới hạn gợi ý: {formatMoney(c.shareLimit)}</span>}
        {over > 0 && (
          <span className="self-start">
            <Badge tone="warn">Vượt {formatMoney(over)}</Badge>
          </span>
        )}
        {c.shareLimit !== null && (
          <button type="button" onClick={onEditWeights} className="self-start text-[12px] font-medium text-gold-700 underline underline-offset-[3px]">
            Chỉnh tỷ lệ / số tiền
          </button>
        )}
      </div>
    )
  }
  if (c.status !== 'SUGGESTED' || limit === null) return <span className="text-muted-foreground">—</span>
  // Gói gợi ý lớn hơn số hiển thị: luôn có nhãn (nhãn của thuật toán nếu có, không thì "Vượt X")
  const cost = c.suggestion?.cost ?? 0
  const label = c.suggestion && cost > limit ? (suggestionLabelText(c.suggestion.label) ?? `Vượt ${formatMoney(cost - limit)}`) : null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium tabular-nums">Gợi ý: {formatMoney(limit)}</span>
      {shareLine}
      {c.kind === 'VENUE' && <span className="text-[12px] text-muted-foreground">Mục tiêu cho tiệc</span>}
      {c.kind === 'SERVICE' && (
        <button type="button" onClick={onEditWeights} className="self-start text-[12px] font-medium text-gold-700 underline underline-offset-[3px]">
          Chỉnh tỷ lệ / số tiền
        </button>
      )}
      {label && (
        <span className="self-start">
          <Badge tone="warn">{label}</Badge>
        </span>
      )}
    </div>
  )
}

/** Cột "Dịch vụ / gói": đã chọn thì tên + trạng thái + ô chọn gói; chưa chọn thì gói gợi ý (kèm nhãn vượt) */
function ServiceCell({ c, b, items }: { c: BudgetCategory; b: Budget; items: PlanItem[] }) {
  const withTables = c.kind === 'VENUE' || c.vendors.some((v) => v.package.unit === 'TABLE')
  if (c.vendors.length) {
    return (
      <div className="flex flex-col gap-2.5">
        {c.vendors.map((v) => (
          <div key={v.id} className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <Link to={paths.serviceDetail(v.id)} className="font-medium hover:underline">
                {v.name}
              </Link>
              {v.status && <Badge tone={PLAN_STATUS[v.status].tone}>{PLAN_STATUS[v.status].label}</Badge>}
            </div>
            <BudgetPackagePicker vendor={v} item={items.find((i) => i.id === v.id)} budget={b} withTables={withTables} />
            {v.overCapacity && <span className="text-[12px] text-warn">Không còn phù hợp: vượt sức chứa. Hãy đổi trung tâm tiệc.</span>}
            {/* Tiệc đã cọc: số khách thay đổi thì gửi yêu cầu điều chỉnh đơn (NCC xác nhận, cọc bổ sung) ở thẻ đơn */}
            {c.kind === 'VENUE' && v.costSource === 'DEPOSITED' && (
              <span className="text-[12px] text-muted-foreground">
                Tiệc đã cọc: đổi số khách bằng nút "Đổi số khách" ở thẻ đơn trong{' '}
                <Link to={paths.planTab.services} className="font-medium text-gold-700 underline underline-offset-[3px]">
                  Dịch vụ
                </Link>{' '}
                (trước ngày tổ chức 7 ngày).
              </span>
            )}
          </div>
        ))}
      </div>
    )
  }
  if (c.status === 'OWN_VENUE') return <span className="text-muted-foreground">Tự lo tiệc ngoài nền tảng</span>
  if (c.status === 'NO_VENDOR') return <span className="text-muted-foreground">{c.message}</span>
  // Nhãn vượt nằm ở cột Gợi ý (so với số đang hiển thị), không lặp ở đây
  const s = c.suggestion
  return (
    <div className="flex flex-col gap-1">
      {s && (
        <span>
          <span className="text-muted-foreground">Gợi ý: </span>
          <Link to={paths.serviceDetail(s.vendorId)} className="font-medium hover:underline">
            {s.vendorName}
          </Link>
          <span className="text-muted-foreground"> · {s.packageName}</span>
          {s.chargedTables !== null && <span className="text-muted-foreground"> · {s.chargedTables} bàn</span>}
        </span>
      )}
      <Link to={`${paths.services}?category=${c.slug}&ai=1`} className="self-start text-[13px] font-medium text-gold-700 underline underline-offset-[3px]">
        Xem gợi ý khác
      </Link>
      {withTables && <BudgetPackagePicker budget={b} withTables />}
    </div>
  )
}

/**
 * Subtab Ngân sách (docs/api/weddings.md mục 7). Phân bổ là giá trị dẫn xuất do backend tính (allocation.ts), không sửa tay:
 * hạng mục đã chọn trừ trước, phần còn lại chia cho trung tâm tiệc (Mục tiêu / Trần cứng) rồi các dịch vụ theo mức chia.
 * Ngân sách là ràng buộc mềm: khách tự chọn gói vượt thì được, kèm cảnh báo; không có thao tác nào bị chặn theo ngân sách.
 */
export default function PlanBudgetPage() {
  const budget = useBudget()
  const planItems = usePlan().data?.items ?? []
  const [importing, setImporting] = useState(false)
  const [editingTotal, setEditingTotal] = useState(false)
  // Tăng lên mỗi lần bấm "Chỉnh tỷ lệ / số tiền" trong bảng để mở bảng thanh kéo
  const [editWeights, setEditWeights] = useState(0)

  if (budget.isPending) return <div className="h-[420px] animate-pulse rounded-lg bg-muted" aria-busy="true" aria-label="Đang tải ngân sách" />
  if (budget.isError) {
    return (
      <EmptyState
        title="Không tải được ngân sách"
        description={budget.error.message}
        action={
          <Button variant="outline" onClick={() => budget.refetch()}>
            Thử lại
          </Button>
        }
      />
    )
  }

  const b = budget.data
  const t = b.totals

  return (
    <>
      <StatGrid className="mb-3">
        <StatCard
          label={
            <span className="flex items-center justify-between gap-2">
              Tổng ngân sách
              <button
                type="button"
                aria-label="Sửa tổng ngân sách"
                title="Sửa tổng ngân sách"
                onClick={() => setEditingTotal(true)}
                className="-my-1 grid size-7 place-items-center rounded-full text-gold-700 transition-colors hover:bg-accent-soft"
              >
                <Pencil className="size-3.5" />
              </button>
            </span>
          }
          value={formatMoney(t.total)}
          sub={
            b.status === 'OVER_BUDGET' ? (
              <span className="font-medium text-warn">Vượt ngân sách</span>
            ) : (
              `${b.guestCount.toLocaleString('vi-VN')} khách · ${b.tables.count} bàn`
            )
          }
        />
        <StatCard label="Đã cọc" value={formatMoney(t.deposited)} sub={`Còn phải trả NCC ${formatMoney(t.owed)}`} />
        <StatCard label="Dự kiến chưa chốt" value={formatMoney(t.plannedTotal)} sub="Dịch vụ đã chọn, chưa có đơn" />
        <StatCard
          label={t.remaining < 0 ? 'Vượt ngân sách' : 'Còn lại'}
          value={formatMoney(Math.abs(t.remaining))}
          tone={t.remaining < 0 ? 'warn' : 'good'}
          sub="Cho các hạng mục chưa chọn"
        />
      </StatGrid>

      <TotalBudgetDialog total={t.total} open={editingTotal} onOpenChange={setEditingTotal} />

      {!b.feasibility.ok && b.feasibility.message && (
        <div role="alert" className="mb-4 rounded-lg border border-warn bg-warn-soft px-4 py-3 text-sm text-warn">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="size-[18px] shrink-0" aria-hidden />
            {b.feasibility.message}
          </p>
          <p className="mt-1 pl-[26px]">Bạn vẫn lập kế hoạch tiếp được. Có thể: {b.feasibility.options.join('; ').toLowerCase()}.</p>
        </div>
      )}
      {b.overBudget && <OverBudgetNote over={b.overBudget} />}

      <AllocationSettings b={b} openSignal={editWeights} />

      <section className="mb-5 rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-[22px] pt-5 pb-3">
          <h2 className="text-lg">
            Theo hạng mục <span className="text-sm font-normal text-muted-foreground">· Mức chia {b.presetLabel}</span>
          </h2>
          <Button variant="outline" size="sm" onClick={() => weddingsApi.downloadExport('budget').catch((e: Error) => toast(e.message))}>
            <Download />
            Tải về
          </Button>
        </div>
        {b.categories.length ? (
          <div className="overflow-x-auto lg:overflow-visible">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-[13px] text-muted-foreground">
                <tr className="border-t border-line">
                  <th className="px-[22px] py-2.5 font-medium">Hạng mục</th>
                  <th className="px-3 py-2.5 font-medium">
                    Gợi ý<span className="block text-[12px] font-normal">Chỉ gợi ý cho hạng mục chưa chọn</span>
                  </th>
                  <th className="px-3 py-2.5 font-medium">Dịch vụ / gói</th>
                  <th className="px-[22px] py-2.5 text-right font-medium">Chi phí</th>
                </tr>
              </thead>
              <tbody>
                {b.categories.map((c) => (
                  <tr key={c.categoryId} className="border-t border-line align-top">
                    <td className="px-[22px] py-3 font-medium">{c.name}</td>
                    <td className="px-3 py-3">
                      <SuggestCell c={c} onEditWeights={() => setEditWeights((n) => n + 1)} />
                    </td>
                    <td className="px-3 py-3 text-[13px]">
                      <ServiceCell c={c} b={b} items={planItems} />
                    </td>
                    <td className="px-[22px] py-3 text-right tabular-nums">
                      {c.status === 'NO_VENDOR' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className={cn(c.status === 'SUGGESTED' && 'text-muted-foreground')}>{formatMoney(c.cost)}</span>
                      )}
                      {/* Nhãn nguồn dưới số: "Dự kiến" / "Theo đơn" / "Đã cọc {x}" */}
                      {c.vendors.map((v) => (
                        <div key={v.id} className="text-[12px] text-muted-foreground">
                          {costSourceText(v.costSource, v.deposited)}
                        </div>
                      ))}
                      {c.status === 'SUGGESTED' && <div className="text-[12px] text-muted-foreground">Theo gói gợi ý</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-[22px] pb-5 text-sm text-muted-foreground">Chưa có hạng mục nào. Chọn dịch vụ muốn dùng ở phần Chỉnh sửa thông tin.</p>
        )}
        {b.categories.length > 0 && <BudgetSummary b={b} />}
        <p className="border-t border-line px-[22px] py-3 text-[13px] text-muted-foreground">
          Chi phí dự kiến tính theo gói đang chọn, giá thật theo đơn của nhà cung cấp. Số "Gợi ý" tự tính lại khi bạn đổi tổng ngân sách, số khách, mức chia
          hoặc chọn dịch vụ.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-[22px] py-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-lg">Chi phí khác ngoài WebPlan</h2>
          <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
            <FileSpreadsheet />
            Nhập từ Excel
          </Button>
        </div>
        {b.extraCosts.length ? (
          <ul>
            {b.extraCosts.map((e) => (
              <ExtraCostRow key={`${e.id}-${e.amount}`} e={e} />
            ))}
            <li className="flex justify-between border-t border-line pt-2.5 text-sm font-semibold">
              <span>Tổng</span>
              <span className={cn('pr-11')}>{formatMoney(t.extraCosts)}</span>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có khoản chi nào ngoài các dịch vụ trên WebPlan.</p>
        )}
        <AddExtraCostForm />
      </section>

      <ImportDialog type="expenses" open={importing} onOpenChange={setImporting} version={b.version} />
    </>
  )
}

/** Cảnh báo mềm (không chặn) khi tổng chi phí vượt tổng ngân sách: nhẹ khi vượt do số dự kiến, rõ khi vượt do giá đơn thật. */
function OverBudgetNote({ over }: { over: NonNullable<Budget['overBudget']> }) {
  const strong = over.level === 'strong'
  return (
    <div
      role={strong ? 'alert' : 'status'}
      className={cn(
        'mb-4 flex flex-wrap items-center gap-3 rounded-lg border px-4 py-3 text-sm',
        strong ? 'border-warn bg-warn-soft text-warn' : 'border-line bg-surface-2 text-ink-2',
      )}
    >
      <AlertTriangle className={cn('size-[18px] shrink-0', !strong && 'text-muted-foreground')} aria-hidden />
      <span className="flex-1">
        {strong
          ? `${over.message}: giá các đơn nhà cung cấp gửi đã vượt tổng ngân sách.`
          : `${over.message} nếu chốt theo chi phí dự kiến. Số này còn đổi khi nhà cung cấp gửi đơn.`}
      </span>
    </div>
  )
}

/**
 * Tổng cuối bảng: Tổng ngân sách; Đã cọc; Còn phải trả cho NCC; Dự kiến chưa chốt;
 * Còn lại = tổng − giá đơn đã chốt − dự kiến chưa chốt (không cộng thêm số đã cọc vì đã nằm trong giá đơn); Còn dư (nếu có).
 */
function BudgetSummary({ b }: { b: Budget }) {
  const t = b.totals
  const rows: [string, number, string?][] = [
    ['Tổng ngân sách', t.total],
    ['Đã cọc', t.deposited],
    ['Còn phải trả cho nhà cung cấp', t.owed, 'Giá đơn trừ số đã cọc'],
    ['Dự kiến chưa chốt', t.plannedTotal, 'Dịch vụ đã chọn, chưa có đơn'],
    ...(t.lostDeposits ? ([['Cọc của đơn đã hủy', t.lostDeposits, 'Không hoàn, vẫn trừ vào tổng']] as [string, number, string][]) : []),
    ...(t.ownVenueCost ? ([['Tiệc tự lo', t.ownVenueCost]] as [string, number][]) : []),
    ...(t.extraCosts ? ([['Chi phí khác', t.extraCosts]] as [string, number][]) : []),
  ]
  return (
    <dl className="grid gap-x-6 gap-y-2 border-t border-line px-[22px] py-4 text-sm sm:grid-cols-[1fr_auto]">
      {rows.map(([label, value, hint]) => (
        <div key={label} className="contents">
          <dt className="text-muted-foreground">
            {label}
            {hint && <span className="ml-1.5 text-[12px]">({hint})</span>}
          </dt>
          <dd className="text-right tabular-nums">{formatMoney(value)}</dd>
        </div>
      ))}
      <div className="contents">
        <dt className="border-t border-line pt-2 font-semibold">{t.remaining < 0 ? 'Vượt ngân sách' : 'Còn lại'}</dt>
        <dd className={cn('border-t border-line pt-2 text-right font-semibold tabular-nums', t.remaining < 0 ? 'text-warn' : 'text-sage')}>
          {formatMoney(Math.abs(t.remaining))}
        </dd>
      </div>
      {b.leftoverMessage && (
        <p className="col-span-full flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
          <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          {b.leftoverMessage}
        </p>
      )}
    </dl>
  )
}

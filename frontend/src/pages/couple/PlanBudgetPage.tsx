import { AlertTriangle, Download, FileSpreadsheet, Info, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
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
import { costSourceText } from '@/features/weddings/budgetView'
import { BudgetPackagePicker } from '@/features/weddings/components/BudgetPackagePicker'
import { BudgetSplitPanel } from '@/features/weddings/components/BudgetSplitPanel'
import { StatCard, StatGrid } from '@/features/weddings/components/StatCard'
import { BudgetSuggestionPicker, ChooseAllSuggestions, type ShownSuggestion } from '@/features/weddings/components/BudgetSuggestionPicker'
import { useBudget, useBudgetMutations, usePatchWedding, usePlan } from '@/features/weddings/hooks'
import { ImportDialog } from '@/features/weddings/import/ImportDialog'
import { displayMoney } from '@/features/weddings/budgetSplit'
import { fundChangeReason, fundSnapshot, presetsLocked, splitView, type SplitView } from '@/features/weddings/budgetSplitView'
import { useBudgetSplit } from '@/features/weddings/useBudgetSplit'
import { PLAN_STATUS } from '@/features/weddings/status'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { Budget, BudgetCategory, PlanItem } from '@/types/wedding'

/** Tiền phân bổ hiển thị làm tròn 10.000đ (backend giữ số chính xác) */
const money = (x: number) => formatMoney(displayMoney(x))

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
 * Cột "Gợi ý" (giá trị dẫn xuất, không sửa tay; tính lại ngay khi kéo thanh): chỉ số tiền, không chữ giải thích.
 * Hạng mục trong nhóm chia: tiền tiêu được (phân bổ lớn hơn gói đắt nhất thì là giá gói đắt nhất). Đã chọn / có đơn chưa cọc:
 * giới hạn gợi ý (tỷ lệ ảo). Đã cọc, đã bỏ khỏi phần chia: "—". Vượt thì có nhãn "Vượt Y".
 */
function SuggestCell({ c, view }: { c: BudgetCategory; view: SplitView }) {
  const r = view.rows.find((x) => x.item.id === c.categoryId)
  let amount: number | null = null
  let over = 0
  if (r) {
    amount = r.warn && c.maxPackagePrice !== null ? c.maxPackagePrice : r.amount
    over = r.suggestion?.over ?? 0
  } else if (c.status === 'CHOSEN' && !view.excluded.some((x) => x.categoryId === c.categoryId)) {
    const limit = view.limits[c.categoryId]
    if (limit !== undefined) {
      amount = limit
      over = Math.max(0, c.cost - limit)
    }
  } else if (c.kind === 'VENUE' && c.status === 'SUGGESTED' && c.limit !== null) {
    amount = c.limit
  }
  if (amount === null) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-medium tabular-nums">{money(amount)}</span>
      {over > 0 && (
        <span className="self-start">
          <Badge tone="warn">Vượt {money(over)}</Badge>
        </span>
      )}
    </div>
  )
}

/** Gói gợi ý của hạng mục chưa chọn: trong nhóm chia lấy theo bảng chia ở client, tiệc lấy theo backend */
function suggestionOf(c: BudgetCategory, view: SplitView): ShownSuggestion | null {
  const r = view.rows.find((x) => x.item.id === c.categoryId)
  if (r)
    return (
      r.suggestion && {
        packageId: r.suggestion.pkg.id,
        vendorId: r.suggestion.pkg.vendorId,
        vendorName: r.suggestion.pkg.vendorName,
        packageName: r.suggestion.pkg.name,
        chargedTables: r.suggestion.pkg.chargedTables,
        cost: r.suggestion.pkg.cost,
      }
    )
  return c.kind === 'VENUE' && c.status === 'SUGGESTED' ? c.suggestion : null
}

/** Gợi ý của mọi hạng mục chưa có dịch vụ (không tính hạng mục tự lo): dùng cho "Chọn tất cả gợi ý" */
function suggestionsToChoose(b: Budget, view: SplitView) {
  return b.categories.flatMap((c) => {
    if (c.vendors.length || c.status === 'OWN_VENUE' || c.status === 'NO_VENDOR' || view.excluded.some((x) => x.categoryId === c.categoryId)) return []
    return suggestionOf(c, view) ?? []
  })
}

/** Cột "Dịch vụ / gói": đã chọn thì tên + trạng thái + ô chọn gói; chưa chọn thì gói gợi ý */
function ServiceCell({ c, b, view, items }: { c: BudgetCategory; b: Budget; view: SplitView; items: PlanItem[] }) {
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
            <BudgetPackagePicker
              vendor={v}
              item={items.find((i) => i.id === v.id)}
              budget={b}
              withTables={withTables}
              changeVendorSlug={c.kind === 'SERVICE' ? c.slug : undefined}
            />
            {v.overCapacity && <span className="text-[12px] text-warn">Không còn phù hợp: vượt sức chứa. Hãy đổi trung tâm tiệc.</span>}
          </div>
        ))}
      </div>
    )
  }
  if (c.status === 'OWN_VENUE') return <span className="text-muted-foreground">Tự lo tiệc ngoài nền tảng</span>
  if (c.status === 'NO_VENDOR') return <span className="text-muted-foreground">{c.message}</span>
  if (view.excluded.some((x) => x.categoryId === c.categoryId)) return <span className="text-muted-foreground">Tự lo</span>
  return (
    <div className="flex flex-col gap-1.5">
      <BudgetSuggestionPicker
        slug={c.slug}
        suggestion={suggestionOf(c, view)}
        packages={c.packages}
        limit={view.rows.find((x) => x.item.id === c.categoryId)?.amount ?? c.limit ?? 0}
      />
      {withTables && <BudgetPackagePicker budget={b} withTables />}
    </div>
  )
}

/**
 * Bốn thẻ số đầu trang (StatCard: ô giấy kem trên dải ô liu); nút sửa tổng ngân sách nằm cạnh nhãn.
 * Số ước tính (Dự kiến chưa chốt, Còn lại) làm tròn 10.000đ như quỹ dịch vụ; Tổng ngân sách, Đã cọc là số thật nên giữ nguyên.
 */
function BudgetStats({ b, onEditTotal }: { b: Budget; onEditTotal: () => void }) {
  const t = b.totals
  const over = t.remaining < 0
  return (
    <StatGrid>
      <StatCard
        label={
          <span className="inline-flex items-center gap-1.5">
            Tổng ngân sách
            <button
              type="button"
              aria-label="Sửa tổng ngân sách"
              title="Sửa tổng ngân sách"
              onClick={onEditTotal}
              className="grid size-7 place-items-center rounded-full transition-colors hover:bg-white/20"
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
      <StatCard label="Dự kiến chưa chốt" value={formatMoney(displayMoney(t.plannedTotal))} sub="Dịch vụ đã chọn, chưa có đơn" />
      <StatCard
        label={over ? 'Vượt ngân sách' : 'Còn lại'}
        value={formatMoney(displayMoney(Math.abs(t.remaining)))}
        tone={over ? 'warn' : 'good'}
        sub="Cho các hạng mục chưa chọn"
      />
    </StatGrid>
  )
}

/** Thông báo "Quỹ dịch vụ vừa thay đổi vì …" hiện trong khoảng này (cờ hành vi, mục 9) */
const FUND_NOTICE_MS = 8000

/**
 * Subtab Ngân sách (docs/api/weddings.md mục 7; tài liệu "Luồng Tùy chỉnh ngân sách" v1.2). Quỹ dịch vụ và phân bổ do backend tính
 * (allocation.ts); phần chia các dịch vụ chưa chọn tính lại ngay ở client bằng cùng thuật toán (budgetSplit.ts) khi khách kéo, rồi tự lưu.
 * Ngân sách là ràng buộc mềm: khách tự chọn gói vượt thì được, kèm cảnh báo; không có thao tác nào bị chặn theo ngân sách.
 */
export default function PlanBudgetPage() {
  const budget = useBudget()
  const planItems = usePlan().data?.items ?? []

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
  return <BudgetContent b={budget.data} planItems={planItems} />
}

function BudgetContent({ b, planItems }: { b: Budget; planItems: PlanItem[] }) {
  const [importing, setImporting] = useState(false)
  const [editingTotal, setEditingTotal] = useState(false)
  const split = useBudgetSplit(b)
  // Quỹ đủ cho gói đắt nhất của mọi dịch vụ ở cả 3 mức (có biên chống nhấp nháy): mức chia không còn ý nghĩa, ẩn ba mức và Tùy chỉnh
  const surplusRef = useRef(false)
  const surplus = presetsLocked(b, surplusRef.current)
  surplusRef.current = surplus
  const view = splitView(b, split.draft, surplus)
  const t = b.totals

  // "Quỹ dịch vụ vừa thay đổi vì …": quỹ đổi do đầu vào khác (số bàn, gói, chi phí ngoài…), không phải do khách kéo thanh
  const [fundNotice, setFundNotice] = useState<string | null>(null)
  const prevFund = useRef(fundSnapshot(b))
  useEffect(() => {
    const reason = fundChangeReason(prevFund.current, fundSnapshot(b))
    prevFund.current = fundSnapshot(b)
    if (!reason) return
    setFundNotice(reason)
    const timer = setTimeout(() => setFundNotice(null), FUND_NOTICE_MS)
    return () => clearTimeout(timer)
  }, [b])

  return (
    <div className="plan-theme budget-theme budget-page">
      <BudgetStats b={b} onEditTotal={() => setEditingTotal(true)} />

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

      <BudgetSplitPanel b={b} split={split} view={view} surplus={surplus} fundNotice={fundNotice} onTouch={() => setFundNotice(null)} />

      <section className="mb-5 rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-[22px] pt-5 pb-3">
          <h2 className="text-lg">Theo hạng mục</h2>
          <span className="ml-auto" />
          <ChooseAllSuggestions list={suggestionsToChoose(b, view)} />
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
                  <th className="px-3 py-2.5 font-medium">Gợi ý</th>
                  <th className="px-3 py-2.5 font-medium">Dịch vụ / gói</th>
                  <th className="px-[22px] py-2.5 text-right font-medium">Chi phí</th>
                </tr>
              </thead>
              <tbody>
                {b.categories.map((c) => {
                  const s = c.vendors.length ? null : suggestionOf(c, view)
                  const excluded = view.excluded.some((x) => x.categoryId === c.categoryId)
                  return (
                    <tr key={c.categoryId} className="border-t border-line align-top">
                      <td className="px-[22px] py-3 font-medium">{c.name}</td>
                      <td className="px-3 py-3">
                        <SuggestCell c={c} view={view} />
                      </td>
                      <td className="px-3 py-3 text-[13px]">
                        <ServiceCell c={c} b={b} view={view} items={planItems} />
                      </td>
                      <td className="px-[22px] py-3 text-right tabular-nums">
                        {c.vendors.length || c.status === 'OWN_VENUE' ? (
                          <span>{formatMoney(c.cost)}</span>
                        ) : s && !excluded ? (
                          <span className="text-muted-foreground">{formatMoney(s.cost)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                        {/* Nhãn nguồn dưới số: "Dự kiến" / "Theo đơn" / "Đã cọc {x}" */}
                        {c.vendors.map((v) => (
                          <div key={v.id} className="text-[12px] text-muted-foreground">
                            {costSourceText(v.costSource, v.deposited)}
                          </div>
                        ))}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="px-[22px] pb-5 text-sm text-muted-foreground">Chưa có hạng mục nào. Chọn dịch vụ muốn dùng ở phần Chỉnh sửa thông tin.</p>
        )}
        {b.categories.length > 0 && <BudgetSummary b={b} />}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-[22px] py-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-lg">Chi phí khác ngoài Forever</h2>
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
          <p className="text-sm text-muted-foreground">Chưa có khoản chi nào ngoài các dịch vụ trên Forever.</p>
        )}
        <AddExtraCostForm />
      </section>

      <ImportDialog type="expenses" open={importing} onOpenChange={setImporting} version={b.version} />
    </div>
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
 * Tổng cuối bảng viết rõ thành phép trừ: Tổng ngân sách − Đã chốt với NCC (giá đơn = đã cọc + còn phải trả) − Dự kiến chưa chốt
 * − các khoản khác (cọc đơn đã hủy, tiệc tự lo, chi phí khác) = Còn lại. Dòng bằng 0 không hiện. Còn dư (nếu có) ghi chú riêng.
 */
function BudgetSummary({ b }: { b: Budget }) {
  const t = b.totals
  const rows: [string, number, string?][] = (
    [
      ['Đã chốt với nhà cung cấp', t.deposited + t.owed, t.deposited ? `đã cọc ${formatMoney(t.deposited)}, còn trả ${formatMoney(t.owed)}` : undefined],
      ['Dự kiến chưa chốt', t.plannedTotal],
      ['Cọc của đơn đã hủy', t.lostDeposits, 'không hoàn'],
      ['Tiệc tự lo', t.ownVenueCost],
      ['Chi phí khác', t.extraCosts],
    ] as [string, number, string?][]
  ).filter(([, value]) => value > 0)
  return (
    <dl className="grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-2 border-t border-line px-[22px] py-4 text-sm">
      <dt className="col-span-2 text-muted-foreground">Tổng ngân sách</dt>
      <dd className="text-right tabular-nums">{formatMoney(t.total)}</dd>
      {rows.map(([label, value, hint]) => (
        <div key={label} className="contents">
          <span className="text-muted-foreground" aria-hidden>
            −
          </span>
          <dt className="text-muted-foreground">
            {label}
            {hint && <span className="ml-1.5 text-[12px]">({hint})</span>}
          </dt>
          <dd className="text-right tabular-nums">{formatMoney(value)}</dd>
        </div>
      ))}
      <div className="contents">
        <span className="border-t border-line pt-2 font-semibold" aria-hidden>
          =
        </span>
        <dt className="border-t border-line pt-2 font-semibold">{t.remaining < 0 ? 'Vượt ngân sách' : 'Còn lại'}</dt>
        <dd className={cn('border-t border-line pt-2 text-right font-semibold tabular-nums', t.remaining < 0 ? 'text-warn' : 'text-sage')}>
          {formatMoney(Math.abs(t.remaining))}
        </dd>
      </div>
      {t.leftover > 0 && (
        <p className="col-span-full flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
          <Info className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Còn dư {money(t.leftover)}: phần quỹ dịch vụ chưa giao cho hạng mục nào.
        </p>
      )}
    </dl>
  )
}

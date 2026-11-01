import { AlertTriangle, Download, FileSpreadsheet, Pencil, RotateCcw, Scale, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Badge } from '@/components/Badge'
import { EmptyState } from '@/components/EmptyState'
import { FormError } from '@/components/FormField'
import { MoneyInput } from '@/components/MoneyInput'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { toast } from '@/components/ui/toast'
import { weddingsApi } from '@/api/weddings'
import { budgetCellAction, diffView } from '@/features/weddings/budgetView'
import { BudgetPackagePicker } from '@/features/weddings/components/BudgetPackagePicker'
import { usePlanContext } from '@/features/weddings/components/PlanHub'
import { StatCard, StatGrid } from '@/features/weddings/components/StatCard'
import { useBudget, useBudgetMutations, usePatchWedding, usePlan } from '@/features/weddings/hooks'
import { ImportDialog } from '@/features/weddings/import/ImportDialog'
import { PLAN_STATUS } from '@/features/weddings/status'
import { tierText } from '@/features/weddings/tiers'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Budget, BudgetCategory, BudgetVendor, PlanItem } from '@/types/wedding'

/** Ô ngân sách hạng mục: sửa tại chỗ, lưu khi rời ô hoặc Enter; dòng lý do dưới số, nhãn "đã sửa" và nút "Đặt lại". */
function BudgetCell({ c, readOnly }: { c: BudgetCategory; readOnly: boolean }) {
  const { setManual, clearManual } = useBudgetMutations()
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? c.budget.toLocaleString('vi-VN')

  function commit() {
    if (text === null) return
    const action = budgetCellAction(c, text)
    setText(null)
    if (action.type === 'set') setManual.mutate({ categoryId: c.categoryId, amount: action.amount })
    if (action.type === 'clear') clearManual.mutate(c.categoryId)
  }

  return (
    <div className="flex flex-col gap-1">
      {readOnly ? (
        <b className="font-semibold">{formatMoney(c.budget)}</b>
      ) : (
        <Input
          inputMode="numeric"
          aria-label={`Ngân sách ${c.name}`}
          value={shown}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '')
            setText(digits ? Number(digits).toLocaleString('vi-VN') : '')
          }}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          className={cn('w-[160px] px-2.5 py-1.5 text-right text-sm', !c.manual && 'text-muted-foreground')}
        />
      )}
      <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
        {c.manual && <Badge tone="info">đã sửa</Badge>}
        {c.reason}
        {c.manual && !readOnly && (
          <button type="button" className="font-medium text-primary underline underline-offset-[3px]" disabled={clearManual.isPending} onClick={() => clearManual.mutate(c.categoryId)}>
            Đặt lại
          </button>
        )}
      </span>
      {c.manual && <span className="text-[12px] text-muted-foreground">Gợi ý: {formatMoney(c.suggested)}</span>}
    </div>
  )
}

/** Ô "Gói" của một dòng: mỗi nhà cung cấp một ô chọn gói; nhà hàng chưa chọn nhà cung cấp vẫn có ô sửa số bàn. */
function PackageCell({ vendors, items, budget, withTables, readOnly }: { vendors: BudgetVendor[]; items: PlanItem[]; budget: Budget; withTables: boolean; readOnly: boolean }) {
  if (!vendors.length) return withTables ? <BudgetPackagePicker budget={budget} withTables readOnly={readOnly} /> : null
  return (
    <div className="flex flex-col gap-2">
      {vendors.map((v) => (
        <BudgetPackagePicker key={v.id} vendor={v} item={items.find((i) => i.id === v.id)} budget={budget} withTables={withTables} readOnly={readOnly} />
      ))}
    </div>
  )
}

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
            action: { label: 'Hoàn tác', onClick: () => patch.mutate({ budget: total }) },
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
          <DialogDescription>Đồng bộ với thông tin kế hoạch. Ngân sách hạng mục bạn đã sửa tay được giữ nguyên.</DialogDescription>
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
      <Input aria-label="Tên khoản chi" placeholder="Ví dụ: Thiệp cưới" maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="min-w-[180px] flex-[2]" />
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
function ExtraCostRow({ e, readOnly }: { e: Budget['extraCosts'][number]; readOnly: boolean }) {
  const { updateExtraCost, removeExtraCost } = useBudgetMutations()
  const [amount, setAmount] = useState<number | null>(null)
  return (
    <li className="flex items-center gap-3 border-t border-line py-2 text-sm first:border-t-0">
      <span className="flex-1">{e.name}</span>
      {readOnly ? (
        <span className="font-medium">{formatMoney(e.amount)}</span>
      ) : (
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
      )}
      {!readOnly && (
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Xóa ${e.name}`} disabled={removeExtraCost.isPending} onClick={() => removeExtraCost.mutate(e.id)}>
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  )
}

const diffClass = { left: 'text-sage', over: 'text-warn', none: 'text-muted-foreground' } as const

/**
 * Subtab Ngân sách (docs/api/weddings.md mục 7): thẻ số ở đầu (hai con số tách bạch "Ngân sách đã chia" và
 * "Chi phí theo gói đã chọn"), một dòng mức chi và số bàn, bảng hạng mục sửa được, chi phí khác. Không có biểu đồ ở tab này.
 * Tổng ngân sách, mức chi, số khách chỉnh chính thức ở "Chỉnh sửa thông tin"; ở đây chỉ có sửa nhanh tổng ngân sách và số bàn.
 */
export default function PlanBudgetPage() {
  const { access } = usePlanContext()
  const budget = useBudget()
  const planItems = usePlan().data?.items ?? []
  const { reset, rebalance } = useBudgetMutations()
  const [importing, setImporting] = useState(false)
  const [editingTotal, setEditingTotal] = useState(false)
  const readOnly = !access.canEdit

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
  const hasManual = b.categories.some((c) => c.manual)
  const banners = b.warnings.filter((w) => w.code !== 'PACKAGE_UNAVAILABLE')

  return (
    <>
      <StatGrid className="mb-3">
        <StatCard
          label={
            <span className="flex items-center justify-between gap-2">
              Tổng ngân sách
              {!readOnly && (
                <button
                  type="button"
                  aria-label="Sửa tổng ngân sách"
                  title="Sửa tổng ngân sách"
                  onClick={() => setEditingTotal(true)}
                  className="-my-1 grid size-7 place-items-center rounded-full text-gold-700 transition-colors hover:bg-accent-soft"
                >
                  <Pencil className="size-3.5" />
                </button>
              )}
            </span>
          }
          value={formatMoney(t.total)}
        />
        <StatCard
          label="Ngân sách đã chia"
          value={formatMoney(t.allocated)}
          sub={t.unallocated >= 0 ? `Chưa phân bổ ${formatMoney(t.unallocated)}` : <span className="text-warn">Vượt {formatMoney(-t.unallocated)}</span>}
        />
        <StatCard label="Chi phí theo gói đã chọn" value={formatMoney(t.packagesCost)} sub="Theo đơn, gói bạn chọn hoặc gói dự kiến" />
        <StatCard label="Chi phí khác" value={formatMoney(t.extraCosts)} />
        <StatCard
          label={t.remaining < 0 ? 'Vượt ngân sách' : 'Còn lại sau chi phí'}
          value={formatMoney(Math.abs(t.remaining))}
          tone={t.remaining < 0 ? 'warn' : 'good'}
          sub="Tổng ngân sách − chi phí theo gói − chi phí khác"
        />
      </StatGrid>

      <p className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-sm text-muted-foreground">
        <span>
          Mức chi tiêu: <b className="font-semibold text-ink">{tierText(b.tier, b.effectiveTier)}</b>
        </span>
      </p>

      <TotalBudgetDialog total={t.total} open={editingTotal} onOpenChange={setEditingTotal} />

      {banners.map((w) => (
        <div key={w.code} role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-warn bg-warn-soft px-4 py-3 text-sm text-warn">
          <AlertTriangle className="size-[18px] shrink-0" aria-hidden />
          <span className="flex-1">{w.message}</span>
        </div>
      ))}

      <section className="mb-5 rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-[22px] pt-5 pb-3">
          <h2 className="text-lg">Theo hạng mục</h2>
          <div className="flex flex-wrap gap-2">
            {!readOnly && (
              <>
                <Button variant="outline" size="sm" disabled={rebalance.isPending || !b.categories.length} onClick={() => rebalance.mutate(undefined, { onSuccess: () => toast('Đã cân đối theo ngân sách tổng') })}>
                  <Scale />
                  Cân đối theo ngân sách tổng
                </Button>
                {hasManual && (
                  <Button variant="outline" size="sm" disabled={reset.isPending} onClick={() => reset.mutate(undefined, { onSuccess: () => toast('Đã đặt lại tất cả theo số gợi ý') })}>
                    <RotateCcw />
                    Đặt lại tất cả
                  </Button>
                )}
              </>
            )}
            <Button variant="outline" size="sm" onClick={() => weddingsApi.downloadExport('budget').catch((e: Error) => toast(e.message))}>
              <Download />
              Tải về
            </Button>
          </div>
        </div>
        {b.categories.length ? (
          <div className="overflow-x-auto lg:overflow-visible">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="text-[13px] text-muted-foreground">
                <tr className="border-t border-line">
                  <th className="px-[22px] py-2.5 font-medium">Hạng mục</th>
                  <th className="px-3 py-2.5 font-medium">Ngân sách</th>
                  <th className="px-3 py-2.5 font-medium">Dịch vụ đã chọn</th>
                  <th className="px-3 py-2.5 font-medium">Gói</th>
                  <th className="px-3 py-2.5 text-right font-medium">Chi phí theo gói</th>
                  <th className="px-[22px] py-2.5 text-right font-medium">Chênh lệch</th>
                </tr>
              </thead>
              <tbody>
                {b.categories.map((c) => {
                  const d = diffView(c.diff)
                  return (
                    <tr key={c.categoryId} className="border-t border-line align-top">
                      <td className="px-[22px] py-3 font-medium">{c.name}</td>
                      <td className="px-3 py-2">
                        <BudgetCell key={`${c.categoryId}-${c.budget}-${c.manual}`} c={c} readOnly={readOnly} />
                      </td>
                      <td className="px-3 py-3">
                        {c.vendors.length ? (
                          c.vendors.map((v) => (
                            <div key={v.id} className="flex flex-wrap items-center gap-1.5">
                              {v.name}
                              {v.status && <Badge tone={PLAN_STATUS[v.status].tone}>{PLAN_STATUS[v.status].label}</Badge>}
                            </div>
                          ))
                        ) : (
                          <span className="text-muted-foreground">Chưa chọn</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-[13px]">
                        <PackageCell vendors={c.vendors} items={planItems} budget={b} withTables={c.slug === 'nha-hang' || c.vendors.some((v) => v.package.unit === 'TABLE')} readOnly={readOnly} />
                      </td>
                      <td className="px-3 py-3 text-right">{c.cost === null ? <span className="text-muted-foreground">—</span> : formatMoney(c.cost)}</td>
                      <td className={cn('px-[22px] py-3 text-right font-medium', diffClass[d.tone])}>{d.text}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot className="text-sm font-semibold">
                <tr className="border-t border-line">
                  <td className="px-[22px] py-3">Tổng</td>
                  <td className="px-3 py-3">
                    {formatMoney(t.allocated)}
                    <div className="text-[12px] font-normal text-muted-foreground">Ngân sách đã chia</div>
                  </td>
                  <td colSpan={2} />
                  <td className="px-3 py-3 text-right">
                    {formatMoney(t.packagesCost)}
                    <div className="text-[12px] font-normal text-muted-foreground">Chi phí theo gói đã chọn</div>
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <p className="px-[22px] pb-5 text-sm text-muted-foreground">Chưa có hạng mục nào. Chọn dịch vụ muốn dùng ở phần Chỉnh sửa thông tin.</p>
        )}
        {!readOnly && (
          <p className="border-t border-line px-[22px] py-3 text-[13px] text-muted-foreground">
            Số xám là ngân sách gợi ý theo giá gói. Gõ số để sửa, xóa trắng ô hoặc bấm "Đặt lại" để quay về số gợi ý. Bấm tên gói để đổi gói, nhà hàng sửa được số bàn ngay tại dòng.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-[22px] py-5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <h2 className="text-lg">Chi phí khác ngoài WebPlan</h2>
          {!readOnly && (
            <Button variant="outline" size="sm" onClick={() => setImporting(true)}>
              <FileSpreadsheet />
              Nhập từ Excel
            </Button>
          )}
        </div>
        {b.extraCosts.length ? (
          <ul>
            {b.extraCosts.map((e) => (
              <ExtraCostRow key={`${e.id}-${e.amount}`} e={e} readOnly={readOnly} />
            ))}
            <li className="flex justify-between border-t border-line pt-2.5 text-sm font-semibold">
              <span>Tổng</span>
              <span className={cn(!readOnly && 'pr-11')}>{formatMoney(t.extraCosts)}</span>
            </li>
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Chưa có khoản chi nào ngoài các dịch vụ trên WebPlan.</p>
        )}
        {!readOnly && <AddExtraCostForm />}
      </section>

      <ImportDialog type="expenses" open={importing} onOpenChange={setImporting} version={b.version} />
    </>
  )
}

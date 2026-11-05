import { useState, type KeyboardEvent } from 'react'
import { MoneyInput } from '@/components/MoneyInput'
import { toast } from '@/components/ui/toast'
import type { Budget } from '@/types/wedding'
import { useBudgetMutations } from '../hooks'
import { ownCostRow } from '../useOwnService'

const blurOnEnter = (e: KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())

/**
 * Chi phí dự kiến của dịch vụ Tự lo (không bắt buộc): một khoản "Chi phí khác" cùng tên dịch vụ, nên được trừ khỏi quỹ chưa phân bổ.
 * Nhập số mới thì thêm hoặc sửa khoản đó, xóa về 0 thì xóa khoản.
 */
export function OwnServiceCost({ b, name }: { b: Budget; name: string }) {
  const { addExtraCost, updateExtraCost, removeExtraCost } = useBudgetMutations()
  const [cost, setCost] = useState<number | null>(null)
  const row = ownCostRow(b, name)
  const busy = addExtraCost.isPending || updateExtraCost.isPending || removeExtraCost.isPending
  const commit = () => {
    const next = cost
    setCost(null)
    if (next === null || next === (row?.amount ?? 0)) return
    if (!row) addExtraCost.mutate({ name, amount: next }, { onSuccess: () => toast(`Đã ghi chi phí tự lo ${name}`) })
    else if (next > 0) updateExtraCost.mutate({ id: row.id, amount: next })
    else removeExtraCost.mutate(row.id)
  }
  return (
    <label className="inline-flex items-center gap-2 text-[13px] text-muted-foreground">
      Chi phí dự kiến
      <MoneyInput
        aria-label={`Chi phí tự lo ${name}`}
        placeholder="Không bắt buộc"
        value={cost ?? row?.amount ?? 0}
        disabled={busy}
        onChange={setCost}
        onBlur={commit}
        onKeyDown={blurOnEnter}
        className="w-[140px] px-2.5 py-1.5 text-right text-sm text-ink"
      />
    </label>
  )
}

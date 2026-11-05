import { toast } from '@/components/ui/toast'
import { formatMoney } from '@/lib/format'
import type { Budget } from '@/types/wedding'
import { displayMoney, excludeCategory, includeCategory } from './budgetSplit'
import type { SplitView } from './budgetSplitView'
import { useBudgetMutations } from './hooks'
import type { useBudgetSplit } from './useBudgetSplit'

/** Khoản "Chi phí khác" ghi chi phí tự lo của một dịch vụ: cùng tên dịch vụ, không phân biệt hoa thường */
export const ownCostRow = (b: Budget, name: string) => b.extraCosts.find((e) => e.name.trim().toLowerCase() === name.trim().toLowerCase()) ?? null

const MSG_UNLOCKED = (name: string) => `Hạng mục ${name} đã được mở khóa để cân đối tỷ lệ vì một hạng mục đã chuyển sang tự lo.`

/**
 * Đánh dấu / bỏ Tự lo một dịch vụ (một chỗ thao tác: bảng Theo hạng mục; khung Mức chia chỉ gọi khi kéo dịch vụ về 0%).
 * Mức có sẵn: lưu ngay lên máy chủ (PATCH …/budget/settings ownService), giữ nguyên khi đổi mức.
 * Tùy chỉnh: sửa bản nháp rồi lưu ngay (không chờ nút Lưu) để bảng và khung chia luôn khớp.
 * "Thêm lại" xóa luôn khoản chi phí tự lo cùng tên trong "Chi phí khác".
 */
export function useOwnService({ b, split, view, onTouch }: { b: Budget; split: ReturnType<typeof useBudgetSplit>; view: SplitView; onTouch?: () => void }) {
  const { settings, removeExtraCost } = useBudgetMutations()
  const st = split.draft
  const custom = view.custom && !!st
  const nameOf = (id: string) => b.categories.find((c) => c.categoryId === id)?.name ?? ''
  const busy = settings.isPending || removeExtraCost.isPending || split.status === 'saving'

  const exclude = (id: string) => {
    onTouch?.()
    const name = nameOf(id)
    if (!custom || !st) {
      return settings.mutate({ ownService: { categoryId: id, own: true } }, { onSuccess: () => toast(`Đã chuyển ${name} sang Tự lo. Nhập chi phí dự kiến ngay ở dòng ${name} nếu có.`) })
    }
    const r = excludeCategory(st, id)
    if (r.unlocked) toast(MSG_UNLOCKED(nameOf(r.unlocked)), 6000)
    split.update(r.state)
    split.save()
  }

  const include = (id: string) => {
    const e = b.split.eligible.find((x) => x.categoryId === id)
    if (!e) return
    onTouch?.()
    const name = nameOf(id)
    const cost = ownCostRow(b, name)
    const done = () =>
      cost
        ? removeExtraCost.mutate(cost.id, { onSuccess: () => toast(`Đã thêm lại ${name} và bỏ chi phí tự lo ${formatMoney(displayMoney(cost.amount))} khỏi Chi phí khác`) })
        : toast(`Đã thêm lại ${name} vào phần chia`)
    if (!custom || !st) return settings.mutate({ ownService: { categoryId: id, own: false } }, { onSuccess: done })
    split.update(includeCategory(st, { id, slug: e.slug, median: e.median }, [...view.group, { id, slug: e.slug, median: e.median }]))
    split.save()
    done()
  }

  return { exclude, include, busy }
}

import { useCategories } from '@/features/catalog/hooks'
import type { Wedding } from '@/types/wedding'
import { TIER_LABEL } from '../tiers'

/**
 * Thẻ "Mức chi và dịch vụ" ở Tổng quan (bỏ phong cách 30/10/2026). Không lặp số khách và tổng ngân sách (đã có ở các thẻ khác).
 * `onEdit` bỏ trống thì không hiện nút Chỉnh sửa.
 */
export function SpendingServicesCard({ wedding, onEdit }: { wedding: Wedding; onEdit?: () => void }) {
  const { data: categories = [] } = useCategories()
  const services = categories.filter((c) => wedding.categorySlugs.includes(c.slug)).map((c) => c.name)
  const rows: [string, string][] = [
    ['Mức chi tiêu', TIER_LABEL[wedding.spendingTier ?? 'AUTO']],
    ['Dịch vụ muốn dùng', services.length ? services.join(', ') : 'Chưa chọn'],
  ]

  return (
    <section className="flex flex-col gap-2.5 rounded-lg border border-line bg-surface px-[22px] py-5">
      <div className="flex items-center justify-between gap-2.5">
        <h2 className="text-lg">Mức chi và dịch vụ</h2>
        {onEdit && (
          <button type="button" className="text-[13px] font-medium text-primary underline underline-offset-[3px]" onClick={onEdit}>
            Chỉnh sửa
          </button>
        )}
      </div>
      <dl className="grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[150px_1fr] gap-2.5 text-sm max-[900px]:grid-cols-1 max-[900px]:gap-0.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

import { Sparkles, Star } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatMillions, formatMoney, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { ServiceDetail } from '@/types/catalog'
import { CAPACITY_CATEGORIES } from '../recommend.config'

interface CompareTableProps {
  services: ServiceDetail[]
  /** Phương án được đề xuất (null khi ngang nhau) */
  recommendedId: string | null
  isTie: boolean
  /** Nút thêm vào kế hoạch cho từng cột; primary = nút chính */
  renderActions?: (s: ServiceDetail, primary: boolean) => ReactNode
}

function BestBadge({ children }: { children: ReactNode }) {
  return <span className="mt-1 inline-flex rounded-pill bg-sage-soft px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap text-sage">{children}</span>
}

/** Nhãn "Đề xuất" cạnh tên trong tiêu đề cột (.rectag trong prototype). */
function RecommendTag() {
  return (
    <span
      title="Dựa trên điểm Google Maps, giá và thông tin đám cưới của bạn"
      className="inline-flex items-center gap-[5px] rounded-pill bg-primary px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap text-primary-foreground"
    >
      <Sparkles className="size-[13px]" strokeWidth={2} aria-hidden />
      Đề xuất
    </span>
  )
}

/** Bảng so sánh 2–3 nhà cung cấp cùng hạng mục (renderCompare trong prototype, 3.4). */
export function CompareTable({ services, recommendedId, isTie, renderActions }: CompareTableProps) {
  const minPrice = Math.min(...services.map((s) => s.priceFrom))
  const maxRating = Math.max(...services.map((s) => s.rating))
  // Sức chứa chỉ áp dụng cho nhà hàng
  const showCapacity = CAPACITY_CATEGORIES.includes(services[0].category.slug)
  const recCell = (s: ServiceDetail) => (s.id === recommendedId ? 'bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]' : '')

  const rows: { label: string; cell: (s: ServiceDetail) => ReactNode }[] = [
    {
      label: 'Giá từ',
      cell: (s) => (
        <>
          <b className="font-semibold">{formatMoney(s.priceFrom)}</b>
          {s.priceFrom === minPrice && (
            <>
              <br />
              <BestBadge>Giá thấp nhất</BestBadge>
            </>
          )}
        </>
      ),
    },
    {
      label: 'Điểm Google Maps',
      cell: (s) => (
        <>
          <span className="inline-flex items-center gap-[5px] text-[13px]">
            <Star className="size-3.5 fill-gold text-gold" aria-hidden />
            <b className="font-semibold">{s.rating.toFixed(1)}</b>
          </span>
          <div className="text-[13px] text-muted-foreground">{formatNumber(s.reviewCount)} đánh giá</div>
          {s.rating === maxRating && <BestBadge>Điểm cao nhất</BestBadge>}
        </>
      ),
    },
    { label: 'Khu vực', cell: (s) => s.location },
    { label: 'Phong cách', cell: (s) => s.styles.join(', ') },
    ...(showCapacity ? [{ label: 'Sức chứa tối đa', cell: (s: ServiceDetail) => (s.capacity ? `${s.capacity} khách` : '—') }] : []),
    {
      label: 'Gói dịch vụ',
      cell: (s) =>
        s.packages.map((p) => (
          <div key={p.id}>
            {p.name}: {formatMillions(p.price)}
          </div>
        )),
    },
    { label: 'Điểm nổi bật', cell: (s) => s.highlights.map((h) => <div key={h}>{h}</div>) },
    {
      label: '',
      cell: (s) => (
        <div className="flex flex-wrap items-center gap-2">
          {renderActions?.(s, isTie || s.id === recommendedId)}
          <Button asChild variant="outline" size="sm">
            <Link to={paths.serviceDetail(s.id)}>Xem chi tiết</Link>
          </Button>
        </div>
      ),
    },
  ]

  const cell = 'border-b border-line px-4 py-[13px] align-top [tr:last-child_&]:border-b-0'

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[620px] border-collapse">
        <thead>
          <tr>
            <th className="w-[150px] border-b border-line px-4 py-[13px]">
              <span className="sr-only">Tiêu chí</span>
            </th>
            {services.map((s) => (
              <th
                key={s.id}
                scope="col"
                className={cn('border-b border-line px-4 py-[13px] text-left align-top font-semibold', s.id === recommendedId && 'border-t-[3px] border-t-primary', recCell(s))}
              >
                <span className="inline-flex flex-wrap items-center gap-2">
                  {s.name}
                  {s.id === recommendedId && <RecommendTag />}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.label || i}>
              <th scope="row" className={cn(cell, 'w-[150px] text-left font-medium text-muted-foreground')}>
                {r.label || <span className="sr-only">Thao tác</span>}
              </th>
              {services.map((s) => (
                <td key={s.id} className={cn(cell, recCell(s))}>
                  {r.cell(s)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

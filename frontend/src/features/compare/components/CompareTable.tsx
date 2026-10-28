import { Sparkles, Star, TriangleAlert } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatUnitPrice, isTablePriced, tableNote } from '@/features/catalog/price'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { ServiceDetail, ServicePackage } from '@/types/catalog'
import { GoogleAttribution } from '@/features/catalog/components/GoogleAttribution'
import { GoogleMapsLink } from '@/features/catalog/components/GoogleMapsLink'

/** Điểm Google của một cột: đang tải, có điểm, hoặc chưa có (lỗi / chưa liên kết / chưa có điểm). */
export type RatingCell = { status: 'loading' } | { status: 'none' } | { status: 'ok'; rating: number; count: number }

interface CompareTableProps {
  services: ServiceDetail[]
  /** Phương án được đề xuất (null khi ngang nhau) */
  recommendedId: string | null
  isTie: boolean
  /** Điểm Google theo id (GET /vendors/{id}/google-rating, mode summary) */
  ratings: Record<string, RatingCell>
  /** Ngân sách gợi ý cho hạng mục (đồng); null khi chưa có thông tin đám cưới */
  budget: number | null
  /** Nút thêm vào kế hoạch cho từng cột; primary = nút chính */
  renderActions?: (s: ServiceDetail, primary: boolean) => ReactNode
  /** Nút cho NCC chưa có gói (nhắn tin với NCC) */
  renderQuote?: (s: ServiceDetail) => ReactNode
}

/** 34000000 -> "34", 12500000 -> "12,5" (đơn vị triệu, không kèm chữ) */
const millions = (n: number) => (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 })

const byPrice = (s: ServiceDetail) => [...s.packages].sort((a, b) => a.price - b.price)

/** Gói đắt nhất còn trong ngân sách; không có ngân sách hoặc gói nào cũng vượt thì lấy gói rẻ nhất. */
function suggestPackage(s: ServiceDetail, budget: number | null): ServicePackage | null {
  const pkgs = byPrice(s)
  if (!pkgs.length) return null
  if (budget === null) return pkgs[0]
  return pkgs.filter((p) => p.price <= budget).at(-1) ?? pkgs[0]
}

/** Tách "Hoa bàn, backdrop 5m, cổng hoa" thành từng ý để so khác nhau. */
const parts = (text: string) =>
  text
    .split(/[,;\n]/)
    .map((x) => x.trim())
    .filter(Boolean)

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

/** Ghi chú dưới ô chọn gói: gợi ý / trong ngân sách / vượt ngân sách. */
function BudgetNote({ price, budget, suggested }: { price: number; budget: number | null; suggested: boolean }) {
  if (budget === null) return null
  if (price > budget)
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-warn-soft px-2 py-1 text-xs font-medium text-warn">
        <TriangleAlert className="size-3.5" aria-hidden />
        Cao hơn ngân sách {millions(price - budget)}tr
      </span>
    )
  if (suggested)
    return (
      <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-gold">
        <Sparkles className="size-3.5" aria-hidden />
        Gợi ý theo ngân sách
      </span>
    )
  return <span className="mt-2 inline-flex text-xs text-sage">Trong ngân sách</span>
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>

type Row = { label: string; cell: (s: ServiceDetail) => ReactNode }

/** Bảng so sánh 2–3 nhà cung cấp cùng hạng mục (renderCompare trong prototype, 3.4). */
export function CompareTable({ services, recommendedId, isTie, ratings, budget, renderActions, renderQuote }: CompareTableProps) {
  // Gói đang chọn theo id NCC; chưa chọn thì dùng gói gợi ý theo ngân sách
  const [picked, setPicked] = useState<Record<string, string>>({})
  const suggested = Object.fromEntries(services.map((s) => [s.id, suggestPackage(s, budget)]))
  const pkgOf = (s: ServiceDetail) => s.packages.find((p) => p.id === picked[s.id]) ?? suggested[s.id]

  const chosen = services.map(pkgOf).filter((p): p is ServicePackage => !!p)
  const prices = chosen.map((p) => p.price)
  const minPrice = chosen.length > 1 && new Set(prices).size > 1 ? Math.min(...prices) : null
  const okRatings = services.map((s) => ratings[s.id]).filter((r): r is Extract<RatingCell, { status: 'ok' }> => r?.status === 'ok')
  const maxRating = okRatings.length > 1 ? Math.max(...okRatings.map((r) => r.rating)) : null
  const showCapacity = chosen.some((p) => p.capacity)
  // Mô tả dạng liệt kê ngắn ("Hoa bàn, backdrop 5m"): ý có trong mọi gói in thường, ý riêng in đậm.
  // Mô tả dạng đoạn văn thì không so từng ý.
  const isList = chosen.length > 1 && chosen.every((p) => parts(p.description).every((x) => x.length <= 40))
  const common = isList ? new Set(parts(chosen[0].description).filter((x) => chosen.every((p) => parts(p.description).includes(x)))) : null

  const recCell = (s: ServiceDetail) => (s.id === recommendedId ? 'bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]' : '')
  const noPkg = <Muted>—</Muted>

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: 'Về nhà cung cấp',
      rows: [
        {
          label: 'Đánh giá',
          cell: (s) => {
            const r = ratings[s.id] ?? { status: 'loading' }
            if (r.status === 'loading') return <span aria-label="Đang tải điểm Google" className="inline-block h-4 w-24 animate-pulse rounded-sm bg-muted" />
            if (r.status === 'none') return <GoogleMapsLink url={s.googleMapsUrl} label="Xem trên Google Maps" />
            return (
              <>
                <span className="inline-flex items-center gap-[5px]">
                  <Star className="size-3.5 fill-gold text-gold" aria-hidden />
                  <b className="font-semibold">{r.rating.toFixed(1)}</b>
                  <Muted>({formatNumber(r.count)})</Muted>
                </span>
                {r.rating === maxRating && (
                  <>
                    <br />
                    <BestBadge>Điểm cao nhất</BestBadge>
                  </>
                )}
              </>
            )
          },
        },
        {
          label: 'Khoảng giá',
          cell: (s) =>
            !s.packages.length ? noPkg : s.priceFrom === s.priceTo ? `${millions(s.priceFrom)} triệu` : `${millions(s.priceFrom)} – ${millions(s.priceTo)} triệu`,
        },
        { label: 'Phong cách', cell: (s) => (s.styles.length ? s.styles.join(', ') : noPkg) },
      ],
    },
    {
      title: 'Về gói đã chọn',
      rows: [
        {
          label: 'Chọn gói',
          cell: (s) => {
            const p = pkgOf(s)
            if (!p) return <Muted>Chưa cập nhật gói</Muted>
            return (
              <>
                <select
                  aria-label={`Chọn gói của ${s.name}`}
                  value={p.id}
                  onChange={(e) => setPicked((m) => ({ ...m, [s.id]: e.target.value }))}
                  className="w-full max-w-[220px] cursor-pointer rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
                >
                  {byPrice(s).map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <br />
                <BudgetNote price={p.price} budget={budget} suggested={p.id === suggested[s.id]?.id} />
              </>
            )
          },
        },
        {
          label: 'Giá',
          cell: (s) => {
            const p = pkgOf(s)
            if (!p) return <Muted>Chưa có gói đăng giá</Muted>
            return (
              <>
                <b className="font-semibold">{formatUnitPrice(p.price, s)}</b>
                {isTablePriced(s) && <div className="text-[13px] text-muted-foreground">{tableNote(p.minTables)}</div>}
                {p.price === minPrice && (
                  <>
                    <br />
                    <BestBadge>Giá thấp nhất</BestBadge>
                  </>
                )}
              </>
            )
          },
        },
        ...(showCapacity
          ? [{ label: 'Quy mô', cell: (s: ServiceDetail) => (pkgOf(s)?.capacity ? `Tối đa ${formatNumber(pkgOf(s)!.capacity!)} khách` : noPkg) }]
          : []),
        {
          label: 'Bao gồm',
          cell: (s) => {
            const p = pkgOf(s)
            if (!p) return noPkg
            const items = parts(p.description)
            if (!common || !items.length)
              return p.description ? (
                <p title={p.description} className="line-clamp-4">
                  {p.description}
                </p>
              ) : (
                noPkg
              )
            return items.map((x, i) => (
              <Fragment key={i}>
                {i > 0 && ', '}
                {common.has(x) ? x : <b className="font-semibold">{x}</b>}
              </Fragment>
            ))
          },
        },
      ],
    },
  ]

  const cell = 'border-b border-line px-4 py-[13px] align-top'
  const recActionId = isTie ? null : recommendedId

  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-surface">
      <table className="w-full min-w-[620px] border-collapse text-[14px]">
        <thead>
          <tr>
            <th className="w-[130px] border-b border-line px-4 py-[13px]">
              <span className="sr-only">Tiêu chí</span>
            </th>
            {services.map((s) => (
              <th
                key={s.id}
                scope="col"
                className={cn('border-b border-line px-4 py-[13px] text-left align-top', s.id === recommendedId && 'border-t-[3px] border-t-primary', recCell(s))}
              >
                <span className="inline-flex flex-wrap items-center gap-2 font-serif text-[17px] font-semibold">
                  {s.name}
                  {s.id === recommendedId && <RecommendTag />}
                </span>
                <div className="mt-0.5 text-[13px] font-medium text-muted-foreground">
                  {s.category.name} · {s.location}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <Fragment key={g.title}>
              <tr>
                <th scope="colgroup" colSpan={services.length + 1} className="border-b border-line bg-bg px-4 py-2 text-left text-[13px] font-semibold text-muted-foreground">
                  {g.title}
                </th>
              </tr>
              {g.rows.map((r) => (
                <tr key={r.label}>
                  <th scope="row" className={cn(cell, 'text-left font-medium text-muted-foreground')}>
                    {r.label}
                  </th>
                  {services.map((s) => (
                    <td key={s.id} className={cn(cell, recCell(s))}>
                      {r.cell(s)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr>
            <th scope="row" className="px-4 py-[13px]">
              <span className="sr-only">Thao tác</span>
            </th>
            {services.map((s) => (
              <td key={s.id} className={cn('px-4 py-[13px] align-top', recCell(s))}>
                <div className="flex flex-wrap items-center gap-2">
                  {s.packages.length ? renderActions?.(s, isTie || s.id === recActionId) : renderQuote?.(s)}
                  <Button asChild variant="ghost" size="sm">
                    <Link to={paths.serviceDetail(s.id)}>Xem chi tiết</Link>
                  </Button>
                </div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <div className="border-t border-line px-4 py-2 text-right">
        <GoogleAttribution />
      </div>
    </div>
  )
}

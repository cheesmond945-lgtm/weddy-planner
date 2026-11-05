import { CalendarCheck, CalendarX, CalendarClock } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { RESTAURANT_SLUG as VENUE_SLUG } from '@/features/vendors/constants'
import { Button } from '@/components/ui/button'
import { StarRating } from '@/features/catalog/components/StarRating'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { ServiceDetail } from '@/types/catalog'
import type { CompareColumn, CompareResult } from '@/types/compare'
import { shortVendorName } from '@/lib/vendorName'

interface CompareTableProps {
  result: CompareResult
  /** Đổi gói ở dropdown: trang gọi lại API kèm gói mới, BE tính lại các dòng và dòng tóm tắt */
  onPick: (serviceId: string, packageId: string) => void
  /** Đang tính lại sau khi đổi gói */
  updating?: boolean
  /** Nút "Thêm vào kế hoạch" (khi gói không bị khóa) */
  renderAdd: (s: ServiceDetail) => ReactNode
  /** NCC chưa có gói nào: nút nhắn tin */
  renderQuote?: (s: ServiceDetail) => ReactNode
}

/** Nhãn theo dòng (chỉ khi các bên khác nhau, BE quyết định) */
function RowBadge({ children }: { children: ReactNode }) {
  return <span className="mt-1.5 inline-flex rounded-pill bg-sage-soft px-3 py-1 text-[13px] font-semibold whitespace-nowrap text-sage">{children}</span>
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>
const Small = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('mt-1 text-[14px] text-muted-foreground', className)}>{children}</div>
)

/** Lịch ngày cưới ngay dưới tên NCC: Còn trống (xanh), Đã kín (đỏ), Chưa xác nhận (xám) */
const DAY_STYLE = {
  FREE: { icon: CalendarCheck, cls: 'bg-sage-soft text-sage' },
  FULL: { icon: CalendarX, cls: 'bg-warn-soft text-warn' },
  UNCONFIRMED: { icon: CalendarClock, cls: 'bg-line text-muted-foreground' },
  MINE: { icon: CalendarCheck, cls: 'bg-sage text-white' },
} as const

function DayBadge({ a }: { a: NonNullable<CompareColumn['availability']> }) {
  const { icon: Icon, cls } = DAY_STYLE[a.status]
  return (
    <span className={cn('mt-1.5 inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-[13px] font-semibold', cls)}>
      <Icon className="size-3.5" aria-hidden />
      {a.text}
    </span>
  )
}

/** Dòng thường: mỗi cột một ô; dòng gộp (span): một ô trải hết các cột */
type Row =
  { label: string; hint?: string | null; cell: (c: CompareColumn, s: ServiceDetail) => ReactNode } | { label: string; hint?: string | null; span: ReactNode }

/**
 * Bảng so sánh 2–3 dịch vụ cùng hạng mục (3.4). Hàng đầu cố định khi cuộn: tên NCC, lịch ngày cưới, nút.
 * Thứ tự dòng: Chọn gói (đã cọc: khóa); Tổng chi phí ước tính; Giống nhau (dòng gộp); Số bàn tính phí (tiệc);
 * Vị trí; Sức chứa (tiệc); Đánh giá; Điểm nổi bật. NCC đã kín ngày cưới thì làm mờ cột. Không có đề xuất, chỉ nhãn theo dòng.
 */
export function CompareTable({ result, onPick, updating, renderAdd, renderQuote }: CompareTableProps) {
  const { columns, rows: show, sameNote, locationNote } = result.comparison
  const services = result.items
  const pairs = columns.map((c) => ({ c, s: services.find((x) => x.id === c.id)! }))
  // Lịch ngày cưới chỉ nhà cung cấp tiệc cập nhật; các hạng mục khác không có lịch nên không so (luôn "Chưa xác nhận")
  const withDay = result.category.slug === VENUE_SLUG
  const faded = (c: CompareColumn) => withDay && c.availability?.status === 'FULL'

  const rows: Row[] = [
    {
      label: 'Chọn gói',
      cell: (c) =>
        c.package && c.locked ? (
          // Đã cọc: khóa ở gói trong đơn, chỉ cách đổi (không để khách vào ngõ cụt)
          <>
            <select
              aria-label={`Gói của ${c.name}`}
              value={c.package.id}
              disabled
              className="w-full max-w-[240px] rounded-md border border-line bg-line/40 px-3 py-2 text-ink"
            >
              <option value={c.package.id}>{c.package.name}</option>
            </select>
            <Small>
              Đã cọc gói này. Muốn đổi gói, nhắn nhà cung cấp; muốn đổi nhà cung cấp, hủy đơn ở{' '}
              <Link to={paths.planTab.services} className="font-medium text-gold-700 underline underline-offset-[3px]">
                tab Dịch vụ
              </Link>
              .
            </Small>
          </>
        ) : c.package ? (
          <select
            aria-label={`Chọn gói của ${c.name}`}
            value={c.package.id}
            onChange={(e) => onPick(c.id, e.target.value)}
            className="w-full max-w-[240px] cursor-pointer rounded-md border border-line bg-surface px-3 py-2 text-ink focus:border-ring focus:outline-2 focus:outline-offset-0 focus:outline-ring"
          >
            {c.packages.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        ) : (
          <Muted>Chưa cập nhật gói</Muted>
        ),
    },
    {
      label: 'Tổng chi phí ước tính',
      cell: (c) => {
        if (!c.package) return <Muted>—</Muted>
        if (c.total === null) return <Muted>{formatMoney(c.package.price)} × số bàn</Muted>
        return (
          <>
            <b className="compare-total font-semibold">{formatMoney(c.total)}</b>
            {c.formula && <Small>{c.formula}</Small>}
            {c.assumption && <Small>{c.assumption}</Small>}
            {c.labels.cheapest && (
              <div>
                <RowBadge>Chi phí thấp nhất</RowBadge>
              </div>
            )}
          </>
        )
      },
    },
    // Không có dòng "So với mức gợi ý" và "Nếu chọn gói này": bảng chỉ để đối chiếu các bên; mức gợi ý đã ghi một lần trên bảng
    ...(sameNote ? [{ label: 'Giống nhau', span: <span>{sameNote.replace(/^Giống nhau: /, '')}</span> }] : []),
    ...(show.tables
      ? [
          {
            label: 'Số bàn tính phí',
            cell: (c: CompareColumn) =>
              !c.tables ? (
                <Muted>—</Muted>
              ) : (
                <>
                  {c.tables.text}
                  {c.tables.warning && <Small className="text-warn">{c.tables.warning}</Small>}
                </>
              ),
          },
        ]
      : []),
    ...(show.location ? [{ label: 'Vị trí', hint: locationNote, cell: (c: CompareColumn) => c.location?.text ?? <Muted>Chưa rõ khu vực</Muted> }] : []),
    ...(show.capacity
      ? [
          {
            label: 'Sức chứa',
            cell: (c: CompareColumn) =>
              !c.capacity ? (
                <Muted>Chưa ghi sức chứa</Muted>
              ) : (
                <>
                  <span className={cn(!c.capacity.fits && 'text-warn')}>{c.capacity.text}</span>
                  {c.labels.largestCapacity && (
                    <div>
                      <RowBadge>Sức chứa lớn nhất</RowBadge>
                    </div>
                  )}
                </>
              ),
          },
        ]
      : []),
    {
      label: 'Đánh giá',
      cell: (c) => (
        <>
          {c.rating.value === null ? (
            <Muted>{c.rating.text}</Muted>
          ) : (
            // 5 sao vàng như trang chi tiết dịch vụ, kèm điểm và số lượt đánh giá
            <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <StarRating value={c.rating.value} size={16} />
              <b className="font-semibold tabular-nums">{c.rating.value.toLocaleString('vi-VN')}</b>
              <span className="text-muted-foreground">({c.rating.count} đánh giá)</span>
            </span>
          )}
          {c.labels.topRated && (
            <div>
              <RowBadge>Điểm cao nhất</RowBadge>
            </div>
          )}
          {/* Bình luận của khách trích nguyên văn (mới nhất trước); dài thì gọn 4 dòng, rê chuột xem đủ */}
          {c.rating.quotes.length > 0 && (
            <ul className="mt-3 space-y-2.5">
              {c.rating.quotes.map((q, i) => (
                <li key={i} className="border-l-2 border-line pl-3">
                  <StarRating value={q.rating} size={12} />
                  <p className="mt-0.5 line-clamp-4 text-[14px] text-ink-2 italic" title={q.content}>
                    “{q.content}”
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      ),
    },
    {
      label: 'Điểm nổi bật',
      cell: (c) =>
        c.includes.length ? (
          <ul className="list-disc space-y-0.5 pl-4">
            {c.includes.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        ) : (
          <Muted>—</Muted>
        ),
    },
  ]

  const cell = 'border-b border-line px-4 py-[13px] align-top'

  return (
    // Màn rộng không cuộn ngang trong bảng để hàng đầu (tên NCC, lịch, nút) dính được khi cuộn trang
    <div
      className={cn('compare-card overflow-x-auto rounded-lg border border-line bg-surface transition-opacity lg:overflow-visible', updating && 'opacity-60')}
      aria-busy={updating || undefined}
    >
      <table className="w-full min-w-[620px] border-collapse text-[16px]">
        <thead className="sticky top-[76px] z-10 bg-surface shadow-[0_6px_10px_-8px_rgb(var(--shadow-rgb)/0.25)]">
          <tr>
            <th className="w-[160px] px-4 pt-[13px] pb-2.5">
              <span className="sr-only">Tiêu chí</span>
            </th>
            {pairs.map(({ c }) => (
              <th key={c.id} scope="col" className="compare-vendor px-4 pt-[18px] pb-2.5 text-left align-top font-normal">
                <div className={cn(faded(c) && 'opacity-55')}>
                  <span className="compare-vendor-name font-serif text-[17px] font-semibold" title={c.name}>
                    {shortVendorName(c.name)}
                  </span>
                </div>
                {withDay && c.availability && (
                  <div>
                    <DayBadge a={c.availability} />
                  </div>
                )}
              </th>
            ))}
          </tr>
          {/* Hàng nút riêng để mọi cột thẳng hàng (tên NCC dài ngắn khác nhau); nút vàng, cùng cỡ.
              Lý do khóa riêng của từng cột (đã kín, không đủ chỗ) ghi nhỏ dưới nút; đã cọc NCC khác thì chỉ có một cảnh báo chung ở đầu trang. */}
          <tr>
            <th className="border-b border-line px-4 pb-3">
              <span className="sr-only">Thao tác</span>
            </th>
            {pairs.map(({ c, s }) => (
              <td key={c.id} className="border-b border-line px-4 pb-3 align-top">
                <div className="flex flex-wrap items-center gap-2">
                  {!s.packages.length ? (
                    renderQuote?.(s)
                  ) : c.canAdd ? (
                    <span className="compare-primary contents">{renderAdd(s)}</span>
                  ) : (
                    // Bị khóa (đã cọc NCC khác, đã kín ngày, không đủ chỗ): cùng nút đen, mờ đi
                    <span className="compare-primary contents">
                      <Button size="sm" disabled title={c.blockReason ?? undefined}>
                        Thêm vào kế hoạch
                      </Button>
                    </span>
                  )}
                  <Button asChild variant="outline" size="sm" className="compare-secondary border-gold-500 text-gold-800 hover:bg-gold-100">
                    <Link to={paths.serviceDetail(c.id)}>Xem chi tiết</Link>
                  </Button>
                </div>
                {!c.canAdd && c.blockReason && c.blockKind !== 'LOCKED' && <Small className="max-w-[300px]">{c.blockReason}</Small>}
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className={cn(cell, 'text-left font-medium text-muted-foreground')}>
                {r.label}
                {r.hint && <span className="mt-0.5 block text-[13px] font-normal">{r.hint}</span>}
              </th>
              {'span' in r ? (
                <td colSpan={pairs.length} className={cn(cell, 'bg-surface-2/60')}>
                  {r.span}
                </td>
              ) : (
                pairs.map(({ c, s }) => (
                  <td key={c.id} className={cn(cell, faded(c) && 'opacity-55')}>
                    {r.cell(c, s)}
                  </td>
                ))
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

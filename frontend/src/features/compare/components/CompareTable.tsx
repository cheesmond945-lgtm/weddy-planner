import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { ServiceDetail } from '@/types/catalog'
import type { CompareColumn, CompareResult } from '@/types/compare'

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
  return <span className="mt-1.5 inline-flex rounded-pill bg-sage-soft px-2.5 py-[3px] text-xs font-semibold whitespace-nowrap text-sage">{children}</span>
}

const Muted = ({ children }: { children: ReactNode }) => <span className="text-muted-foreground">{children}</span>
const Small = ({ children, className }: { children: ReactNode; className?: string }) => <div className={cn('mt-1 text-[13px] text-muted-foreground', className)}>{children}</div>

type Row = { label: string; cell: (c: CompareColumn, s: ServiceDetail) => ReactNode }

/**
 * Bảng so sánh 2–3 dịch vụ cùng hạng mục (3.4). Thứ tự dòng: Chọn gói; Tổng chi phí ước tính; So với ngân sách hạng mục;
 * Số bàn tính phí (tiệc); Vị trí; Sức chứa (tiệc); Đánh giá; Bao gồm; Nút. Không có đề xuất, chỉ nhãn theo dòng.
 */
export function CompareTable({ result, onPick, updating, renderAdd, renderQuote }: CompareTableProps) {
  const { columns, rows: show } = result.comparison
  const services = result.items
  const pairs = columns.map((c) => ({ c, s: services.find((x) => x.id === c.id)! }))

  const rows: Row[] = [
    {
      label: 'Chọn gói',
      cell: (c) =>
        c.package ? (
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
            <b className="font-semibold">{formatMoney(c.total)}</b>
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
    ...(show.budget
      ? [
          {
            label: 'So với ngân sách hạng mục',
            cell: (c: CompareColumn) =>
              !c.budget ? (
                <Muted>—</Muted>
              ) : c.budget.kind === 'OVER' ? (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-warn-soft px-2 py-1 text-xs font-medium text-warn">
                  <TriangleAlert className="size-3.5" aria-hidden />
                  {c.budget.text}
                </span>
              ) : (
                <span className={c.budget.kind === 'LEFT' ? 'text-sage' : 'text-ink'}>{c.budget.text}</span>
              ),
          },
        ]
      : []),
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
    ...(show.location ? [{ label: 'Vị trí', cell: (c: CompareColumn) => c.location?.text ?? <Muted>Chưa rõ khu vực</Muted> }] : []),
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
          {c.rating.value === null ? <Muted>{c.rating.text}</Muted> : c.rating.text}
          {c.labels.topRated && (
            <div>
              <RowBadge>Điểm cao nhất</RowBadge>
            </div>
          )}
        </>
      ),
    },
    {
      label: 'Bao gồm',
      cell: (c) => (
        <>
          {c.includes.length ? (
            <ul className="list-disc space-y-0.5 pl-4">
              {c.includes.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          ) : (
            <Muted>—</Muted>
          )}
          <Link to={paths.serviceDetail(c.id)} className="mt-1.5 inline-block text-[13px] font-medium text-gold-700 underline underline-offset-[3px]">
            Xem chi tiết
          </Link>
        </>
      ),
    },
  ]

  const cell = 'border-b border-line px-4 py-[13px] align-top'

  return (
    <div className={cn('overflow-x-auto rounded-lg border border-line bg-surface transition-opacity', updating && 'opacity-60')} aria-busy={updating || undefined}>
      <table className="w-full min-w-[620px] border-collapse text-[14px]">
        <thead>
          <tr>
            <th className="w-[150px] border-b border-line px-4 py-[13px]">
              <span className="sr-only">Tiêu chí</span>
            </th>
            {pairs.map(({ c, s }) => (
              <th key={c.id} scope="col" className="border-b border-line px-4 py-[13px] text-left align-top">
                <span className="font-serif text-[17px] font-semibold">{c.name}</span>
                <div className="mt-0.5 text-[13px] font-medium text-muted-foreground">
                  {s.category.name} · {s.location}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className={cn(cell, 'text-left font-medium text-muted-foreground')}>
                {r.label}
              </th>
              {pairs.map(({ c, s }) => (
                <td key={c.id} className={cell}>
                  {r.cell(c, s)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <th scope="row" className="px-4 py-[13px]">
              <span className="sr-only">Thao tác</span>
            </th>
            {pairs.map(({ c, s }) => (
              <td key={c.id} className="px-4 py-[13px] align-top">
                {/* Cùng kiểu nút cho mọi cột */}
                <div className="flex flex-wrap items-center gap-2">
                  {!s.packages.length ? (
                    renderQuote?.(s)
                  ) : c.canAdd ? (
                    renderAdd(s)
                  ) : (
                    <Button variant="outline" size="sm" disabled title={c.blockReason ?? undefined}>
                      Thêm vào kế hoạch
                    </Button>
                  )}
                  <Button asChild variant="outline" size="sm">
                    <Link to={paths.serviceDetail(c.id)}>Xem chi tiết</Link>
                  </Button>
                </div>
                {!c.canAdd && c.blockReason && <Small className="text-warn">{c.blockReason}</Small>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

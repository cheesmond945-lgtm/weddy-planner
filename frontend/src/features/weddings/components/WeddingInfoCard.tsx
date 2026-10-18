import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useCategories } from '@/features/catalog/hooks'
import { daysBetween, formatDate, parseDate, today } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { paths } from '@/routes/paths'
import type { Wedding } from '@/types/wedding'
import { WeddingEditDialog } from './WeddingDialogs'

/** Khối "Thông tin đám cưới" đầu trang Kế hoạch (wedCard trong prototype). */
export function WeddingInfoCard({ wedding }: { wedding: Wedding | null }) {
  const [editing, setEditing] = useState(false)
  const { data: categories = [] } = useCategories()

  if (!wedding) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface p-[22px]">
        <span className="text-muted-foreground">Bạn chưa thiết lập thông tin đám cưới.</span>
        <Button asChild size="sm">
          <Link to={paths.timeline}>Thiết lập ngay</Link>
        </Button>
      </div>
    )
  }

  const left = Math.max(0, daysBetween(today(), parseDate(wedding.date)))
  const serviceNames = categories.filter((c) => wedding.categorySlugs.includes(c.slug)).map((c) => c.name)
  const fields: [string, ReactNode, boolean?][] = [
    ['Ngày tổ chức', <>{formatDate(wedding.date)} <small className="font-normal text-muted-foreground">(còn {left} ngày)</small></>],
    ['Địa điểm', wedding.location],
    ['Sức chứa dự kiến', wedding.guestCount ? `${wedding.guestCount} khách` : 'Chưa nhập'],
    ['Tổng ngân sách', formatMoney(wedding.budget)],
    ['Phong cách', wedding.styles.length ? wedding.styles.join(', ') : 'Chưa chọn'],
    ['Dịch vụ muốn sử dụng', serviceNames.length ? serviceNames.join(', ') : 'Chưa chọn', true],
  ]

  return (
    <section className="mb-4 rounded-lg border border-line bg-surface p-[22px]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <b className="font-serif text-[17px] font-semibold">Thông tin đám cưới</b>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Chỉnh sửa
        </Button>
      </div>
      <dl className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-5 gap-y-3">
        {fields.map(([label, value, wide]) => (
          <div key={label} className={wide ? 'col-span-full' : undefined}>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold">{value}</dd>
          </div>
        ))}
      </dl>
      <WeddingEditDialog open={editing} onOpenChange={setEditing} />
    </section>
  )
}

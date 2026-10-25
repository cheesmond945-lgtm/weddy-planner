import { ChevronRight, Clock } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { DataTable, td, th, TableCard } from '@/features/adminShared/components/AdminTable'
import { formatDay, waitingOf } from '@/features/adminShared/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { AdminDashboard, WaitingItem } from '@/types/admin'

type Tab = 'vendors' | 'packages'

function Rows({ items, tab }: { items: WaitingItem[]; tab: Tab }) {
  if (!items.length) {
    return <p className="px-6 py-10 text-center text-[13.5px] text-muted-foreground">Không có mục nào đang chờ duyệt.</p>
  }
  return (
    <DataTable>
      <thead>
        <tr>
          <th className={th}>{tab === 'vendors' ? 'Tên doanh nghiệp' : 'Tên gói'}</th>
          <th className={th}>{tab === 'vendors' ? 'Loại dịch vụ' : 'Nhà cung cấp'}</th>
          <th className={th}>Thành phố</th>
          <th className={th}>Ngày nộp</th>
          <th className={th}>Đã chờ</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const wait = waitingOf(it.submittedAt)
          return (
            <tr key={it.id} className="transition-colors last:[&>td]:border-b-0 hover:bg-surface-2">
              <td className={cn(td, 'font-semibold')}>{it.name}</td>
              <td className={td}>{tab === 'vendors' ? <span className="rounded-pill bg-sage-soft px-2.5 py-[3px] text-xs text-sage">{it.category.name}</span> : it.subtitle}</td>
              <td className={cn(td, 'text-muted-foreground')}>{it.city}</td>
              <td className={cn(td, 'whitespace-nowrap text-muted-foreground tabular-nums')}>{formatDay(it.submittedAt)}</td>
              <td className={cn(td, 'whitespace-nowrap')}>
                <span className={cn('inline-flex items-center gap-1.5 text-[13px] font-medium', wait.urgent ? 'text-warn' : 'text-gold-ink')}>
                  <Clock className="size-3.5" />
                  {wait.label}
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}

/** Danh sách phê duyệt: hồ sơ NCC và gói dịch vụ đang chờ, mục chờ lâu nhất ở trên. */
export function ApprovalList({ data }: { data: AdminDashboard }) {
  const [tab, setTab] = useState<Tab>('vendors')
  const items = tab === 'vendors' ? data.waitingVendors : data.waitingPackages
  const total = tab === 'vendors' ? data.pendingVendors : data.pendingPackages

  return (
    <TableCard className="mb-[30px]">
      <div className="flex flex-wrap items-start justify-between gap-3 px-6 pt-5 pb-4">
        <div>
          <h2 className="text-[19px] font-semibold">Danh sách phê duyệt</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {tab === 'vendors' ? 'Kiểm tra giấy tờ và phê duyệt hồ sơ của nhà cung cấp mới' : 'Thẩm định và phê duyệt các gói dịch vụ nhà cung cấp gửi lên'}
          </p>
        </div>
        <div role="tablist" aria-label="Loại cần duyệt" className="inline-flex gap-1 rounded-pill border border-line bg-surface-2 p-1">
          {(
            [
              ['vendors', 'Hồ sơ chờ duyệt'],
              ['packages', 'Dịch vụ chờ duyệt'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={tab === v}
              onClick={() => setTab(v)}
              className={cn('rounded-pill px-4 py-1.5 text-[13px] text-muted-foreground transition-colors', tab === v ? 'bg-surface font-semibold text-ink shadow-soft' : 'hover:text-ink')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <Rows items={items} tab={tab} />
      <Link
        to={`${tab === 'vendors' ? paths.admin.vendors : paths.admin.catalog}?tt=PENDING`}
        className="flex items-center justify-center gap-1.5 border-t border-line py-4 text-[13.5px] font-medium text-sage hover:underline"
      >
        {tab === 'vendors' ? 'Xem tất cả hồ sơ' : 'Xem tất cả gói dịch vụ'}
        {total > items.length && <span className="text-muted-foreground">({total})</span>}
        <ChevronRight className="size-4" />
      </Link>
    </TableCard>
  )
}

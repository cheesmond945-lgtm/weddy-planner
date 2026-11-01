import { Clock } from 'lucide-react'
import { useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { DataTable, num, td, th } from '@/features/adminShared/components/AdminTable'
import { formatDay, waitingOf } from '@/features/adminShared/format'
import { isVenue } from '@/features/vendorPackages/constants'
import { ReviewKindBadge } from '@/features/adminVendors/components/ReviewKindBadge'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { AdminPackage } from '@/types/admin'
import { ADMIN_PACKAGE_STATUS } from '../constants'

/** Bảng gói dịch vụ: bấm một dòng để mở chi tiết (duyệt, yêu cầu chỉnh sửa nằm trong trang chi tiết). Gói đang chờ duyệt hiện thời gian đã chờ. */
export function PackageTable({ packages, startIndex = 0 }: { packages: AdminPackage[]; startIndex?: number }) {
  const navigate = useNavigate()
  const head = cn(th, 'whitespace-nowrap')
  const showCapacity = packages.some((p) => isVenue(p.category))

  return (
    <DataTable className="w-max min-w-full">
      <thead>
        <tr>
          <th className={head}>STT</th>
          <th className={head}>Tên gói</th>
          <th className={head}>Nhà cung cấp</th>
          <th className={head}>Lĩnh vực</th>
          <th className={cn(head, 'text-right')}>Giá</th>
          <th className={head}>Tags</th>
          <th className={head}>Ngày nộp</th>
          <th className={head}>Trạng thái</th>
          {showCapacity && <th className={cn(head, 'text-right')}>Sức chứa</th>}
        </tr>
      </thead>
      <tbody>
        {packages.map((p, i) => {
          const wait = p.status === 'PENDING' && p.submittedAt ? waitingOf(p.submittedAt) : null
          const st = ADMIN_PACKAGE_STATUS[p.status]
          const open = () => navigate(paths.admin.package(p.id))
          return (
            <tr
              key={p.id}
              onClick={open}
              onKeyDown={(e) => e.key === 'Enter' && open()}
              tabIndex={0}
              className="cursor-pointer transition-colors last:[&>td]:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <td className={cn(td, 'text-muted-foreground tabular-nums')}>{startIndex + i + 1}</td>
              <td className={cn(td, 'max-w-[320px] min-w-[200px] font-semibold')}>{p.name}</td>
              <td className={td}>{p.vendor.name}</td>
              <td className={td}>
                <span className="rounded-pill bg-sage-soft px-2.5 py-[3px] text-xs whitespace-nowrap text-sage">{p.category.name}</span>
              </td>
              <td className={cn(td, num)}>{formatMoney(p.price)}</td>
              <td className={td}>
                {p.tags.length ? (
                  <div className="flex items-center gap-1">
                    {p.tags.map((t) => (
                      <span key={t} className="inline-block rounded-pill border border-line-strong bg-surface px-2 text-[11.5px] leading-5 whitespace-nowrap">
                        {t}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
              <td className={cn(td, 'whitespace-nowrap tabular-nums')}>
                {formatDay(p.submittedAt)}
                {wait && (
                  <span className={cn('mt-0.5 flex items-center gap-1 text-[12px] font-medium', wait.urgent ? 'text-warn' : 'text-gold-ink')}>
                    <Clock className="size-3" />
                    Đã chờ {wait.label}
                  </span>
                )}
              </td>
              <td className={td}>
                <Badge tone={st.tone}>
                  <i aria-hidden className="size-1.5 rounded-full bg-current opacity-75" />
                  {st.label}
                </Badge>
                {p.reviewKind && (
                  <span className="mt-1 block">
                    <ReviewKindBadge kind={p.reviewKind} />
                  </span>
                )}
              </td>
              {showCapacity && <td className={cn(td, 'text-right whitespace-nowrap tabular-nums')}>{p.capacity ? `${p.capacity} khách` : '—'}</td>}
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}

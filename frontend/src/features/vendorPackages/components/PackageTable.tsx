import { useLocation, useNavigate } from 'react-router'
import { Badge } from '@/components/Badge'
import { DataTable, td, th } from '@/features/adminShared/components/AdminTable'
import { formatDate, toISODate } from '@/lib/date'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { VendorPackage } from '@/types/vendorPackage'
import { PACKAGE_STATUS } from '../constants'

/** Nhãn trạng thái gói; `large` = to và nổi bật như nhãn trạng thái ở trang Hồ sơ NCC. */
export function PackageStatusBadge({ pkg, large }: { pkg: Pick<VendorPackage, 'status'>; large?: boolean }) {
  const { label, tone } = PACKAGE_STATUS[pkg.status]
  return (
    <Badge tone={tone} className={large ? 'gap-2 border border-current/25 px-5 py-2 text-base font-bold shadow-portal' : undefined}>
      <i aria-hidden className={large ? 'size-2.5 rounded-full bg-current' : 'size-1.5 rounded-full bg-current opacity-75'} />
      {label}
    </Badge>
  )
}

export const formatUpdated = (iso: string) => formatDate(toISODate(new Date(iso)))

/** Đi tới trang chi tiết gói, nhớ bộ lọc của danh sách để nút quay lại giữ nguyên. */
export function useOpenPackage() {
  const navigate = useNavigate()
  const { search } = useLocation()
  return (pkg: Pick<VendorPackage, 'id'>) => navigate(paths.vendor.package(pkg.id), { state: { listSearch: search } })
}

interface PackageTableProps {
  packages: VendorPackage[]
  /** Số thứ tự của dòng đầu (qua các trang) */
  startIndex?: number
  /** Hiện cột sức chứa (lĩnh vực trung tâm tổ chức sự kiện) */
  showCapacity?: boolean
}

/** Bảng gói dịch vụ: bấm một dòng để mở chi tiết (mọi thao tác nằm trong trang chi tiết). */
export function PackageTable({ packages, startIndex = 0, showCapacity }: PackageTableProps) {
  const open = useOpenPackage()
  const head = cn(th, 'whitespace-nowrap')

  return (
    <DataTable className="w-max min-w-full">
      <thead>
        <tr>
          <th className={head}>STT</th>
          <th className={head}>Tên gói</th>
          <th className={cn(head, 'text-right')}>Giá</th>
          <th className={head}>Tags</th>
          <th className={head}>Trạng thái</th>
          <th className={head}>Ngày cập nhật</th>
          {showCapacity && <th className={cn(head, 'text-right')}>Sức chứa</th>}
        </tr>
      </thead>
      <tbody>
        {packages.map((pkg, i) => (
          <tr
            key={pkg.id}
            onClick={() => open(pkg)}
            onKeyDown={(e) => e.key === 'Enter' && open(pkg)}
            tabIndex={0}
            className="cursor-pointer transition-colors last:[&>td]:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
          >
            <td className={cn(td, 'text-muted-foreground tabular-nums')}>{startIndex + i + 1}</td>
            <td className={cn(td, 'max-w-[320px] min-w-[200px] font-semibold')}>{pkg.name}</td>
            <td className={cn(td, 'text-right whitespace-nowrap tabular-nums')}>{formatMoney(pkg.price)}</td>
            <td className={td}>
              {pkg.tags.length ? (
                <div className="flex items-center gap-1">
                  {pkg.tags.map((t) => (
                    <span key={t} className="inline-block rounded-pill border border-line-strong bg-surface px-2 text-[11.5px] leading-5 whitespace-nowrap">
                      {t}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </td>
            <td className={td}>
              <PackageStatusBadge pkg={pkg} />
            </td>
            <td className={cn(td, 'whitespace-nowrap tabular-nums')}>{formatUpdated(pkg.updatedAt)}</td>
            {showCapacity && <td className={cn(td, 'text-right whitespace-nowrap tabular-nums')}>{pkg.capacity ? `${pkg.capacity} khách` : '—'}</td>}
          </tr>
        ))}
      </tbody>
    </DataTable>
  )
}

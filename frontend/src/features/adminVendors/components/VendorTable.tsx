import { Clock } from 'lucide-react'
import { useNavigate } from 'react-router'
import { DataTable, td, th } from '@/features/adminShared/components/AdminTable'
import { formatDay, waitingOf } from '@/features/adminShared/format'
import { ProfileStatusBadge } from '@/features/vendors/components/ProfileStatus'
import { cn } from '@/lib/utils'
import { paths } from '@/routes/paths'
import type { AdminVendor } from '@/types/admin'
import { ReviewKindBadge } from './ReviewKindBadge'

/** Bảng hồ sơ nhà cung cấp: bấm một dòng để mở chi tiết (duyệt, yêu cầu chỉnh sửa nằm trong trang chi tiết). */
export function VendorTable({ vendors, startIndex = 0 }: { vendors: AdminVendor[]; startIndex?: number }) {
  const navigate = useNavigate()
  return (
    <DataTable className="min-w-max">
      <thead>
        <tr>
          <th className={cn(th, 'whitespace-nowrap')}>STT</th>
          <th className={cn(th, 'whitespace-nowrap')}>Tên doanh nghiệp</th>
          <th className={cn(th, 'whitespace-nowrap')}>Tên người đại diện</th>
          <th className={cn(th, 'whitespace-nowrap')}>Lĩnh vực</th>
          <th className={cn(th, 'whitespace-nowrap')}>Tỉnh/Thành phố</th>
          <th className={cn(th, 'whitespace-nowrap')}>Phường/Xã</th>
          <th className={cn(th, 'whitespace-nowrap')}>Ngày nộp</th>
          <th className={cn(th, 'whitespace-nowrap')}>Trạng thái</th>
        </tr>
      </thead>
      <tbody>
        {vendors.map((v, i) => {
          const wait = v.status === 'PENDING' && v.submittedAt ? waitingOf(v.submittedAt) : null
          const open = () => navigate(paths.admin.vendor(v.id))
          return (
            <tr
              key={v.id}
              onClick={open}
              onKeyDown={(e) => e.key === 'Enter' && open()}
              tabIndex={0}
              className="cursor-pointer transition-colors last:[&>td]:border-b-0 hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <td className={cn(td, 'text-muted-foreground tabular-nums')}>{startIndex + i + 1}</td>
              <td className={td}>
                <span className="block font-semibold">{v.businessName}</span>
                <span className="text-[12.5px] text-muted-foreground">MST {v.taxCode ?? '—'}</span>
              </td>
              <td className={td}>{v.representativeName ?? '—'}</td>
              <td className={td}>
                <span className="rounded-pill bg-sage-soft px-2.5 py-[3px] text-xs whitespace-nowrap text-sage">{v.category.name}</span>
              </td>
              <td className={cn(td, 'text-muted-foreground')}>{v.province || '—'}</td>
              <td className={cn(td, 'text-muted-foreground')}>{v.ward ?? '—'}</td>
              <td className={cn(td, 'whitespace-nowrap tabular-nums')}>
                {formatDay(v.submittedAt)}
                {wait && (
                  <span className={cn('mt-0.5 flex items-center gap-1 text-[12px] font-medium', wait.urgent ? 'text-warn' : 'text-gold-ink')}>
                    <Clock className="size-3" />
                    Đã chờ {wait.label}
                  </span>
                )}
              </td>
              <td className={td}>
                <ProfileStatusBadge status={v.status} />
                {v.reviewKind && (
                  <span className="mt-1 block">
                    <ReviewKindBadge kind={v.reviewKind} />
                  </span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </DataTable>
  )
}

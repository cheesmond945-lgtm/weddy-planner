import { ChevronRight } from 'lucide-react'
import { Link, useLocation } from 'react-router'
import { PageTitle } from '@/components/PageTitle'
import { Notice } from '@/features/vendors/components/FormParts'
import { paths } from '@/routes/paths'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { VendorPackage } from '@/types/vendorPackage'
import { canSubmitPackage, PACKAGE_NOTICE } from '../constants'
import { formatUpdated, PackageStatusBadge } from './PackageTable'

/** Đường dẫn về danh sách, giữ bộ lọc lúc rời danh sách (nếu có). */
export function useListHref() {
  const state = useLocation().state as { listSearch?: string } | null
  return paths.vendor.catalog + (state?.listSearch ?? '')
}

interface PackageHeaderProps {
  pkg: VendorPackage | undefined
  profile: VendorProfile
  /** Lĩnh vực của gói (gói mới: lấy theo hồ sơ) */
  category: CategoryRef
}

/** Đường dẫn "Quản lý dịch vụ › tên gói", tiêu đề và thông báo theo trạng thái (như prototype NCC). */
export function PackageHeader({ pkg, profile, category }: PackageHeaderProps) {
  const listHref = useListHref()
  const notice = pkg && PACKAGE_NOTICE[pkg.status]
  const editable = !pkg || pkg.status === 'DRAFT'

  return (
    <>
      <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-2 text-[13px] text-muted-foreground">
        <Link to={listHref} className="text-gold-ink hover:underline">
          Quản lý dịch vụ
        </Link>
        <ChevronRight className="size-3.5" />
        <span aria-current="page" className="max-w-[60ch] truncate font-medium text-ink">
          {pkg?.name ?? 'Thêm gói dịch vụ'}
        </span>
      </nav>

      {pkg ? (
        <div className="mb-[22px]">
          <h1 className="text-[clamp(28px,3.6vw,40px)] leading-[1.1] [overflow-wrap:anywhere]">{pkg.name}</h1>
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5 text-[12.5px] text-muted-foreground">
            <span className="rounded-pill border border-line bg-surface-2 px-2.5 py-[3px] font-mono">{pkg.id}</span>
            <PackageStatusBadge pkg={pkg} />
            <span>Cập nhật {formatUpdated(pkg.updatedAt)}</span>
            <span>· {pkg.category.name}</span>
          </div>
        </div>
      ) : (
        <PageTitle
          title="Thêm gói dịch vụ"
          description={
            <>
              {profile.businessName ?? 'Nhà cung cấp'} · Lĩnh vực: <b className="text-ink">{category.name}</b>
            </>
          }
        />
      )}

      {notice && <Notice tone={notice.tone} title={notice.text} />}
      {editable && !canSubmitPackage(profile, category) && (
        <Notice tone="warn" title="Hồ sơ nhà cung cấp chưa được xác minh đúng lĩnh vực này: bạn có thể lưu nháp, chưa gửi duyệt được.">
          <Link to={paths.vendor.profile} className="font-medium underline-offset-2 hover:underline">
            Đến Hồ sơ nhà cung cấp →
          </Link>
        </Notice>
      )}
    </>
  )
}

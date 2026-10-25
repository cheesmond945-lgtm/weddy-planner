import { Link, useLocation } from 'react-router'
import { PageTitle } from '@/components/PageTitle'
import { Notice } from '@/features/vendors/components/FormParts'
import { paths } from '@/routes/paths'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { VendorPackage } from '@/types/vendorPackage'
import { canSubmitPackage, isEditablePackage, PACKAGE_NOTICE } from '../constants'
import { PackageStatusBadge } from './PackageTable'

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

/** Tiêu đề trang chi tiết gói: nhãn trạng thái to ở góc phải (cùng kiểu trang Hồ sơ NCC), thông báo theo trạng thái. */
export function PackageHeader({ pkg, profile, category }: PackageHeaderProps) {
  const notice = pkg && PACKAGE_NOTICE[pkg.status]

  return (
    <>
      <PageTitle title={pkg ? 'Chi tiết gói dịch vụ' : 'Thêm gói dịch vụ'} actions={pkg && <PackageStatusBadge pkg={pkg} large />} />

      {notice && <Notice tone={notice.tone} title={notice.text} />}
      {pkg?.status === 'NEEDS_REVISION' && (
        <Notice tone="warn" title="Admin yêu cầu chỉnh sửa / bổ sung gói dịch vụ">
          {pkg.reviewNote && (
            <p>
              <b>Lý do:</b> {pkg.reviewNote}
            </p>
          )}
          <p>Sửa các mục liên quan rồi gửi lại duyệt.</p>
        </Notice>
      )}
      {(!pkg || isEditablePackage(pkg.status)) && !canSubmitPackage(profile, category) && (
        <Notice tone="warn" title="Hồ sơ nhà cung cấp chưa được duyệt đúng lĩnh vực này: bạn có thể lưu nháp, chưa gửi duyệt được.">
          <Link to={paths.vendor.profile} className="font-medium underline-offset-2 hover:underline">
            Đến Hồ sơ nhà cung cấp →
          </Link>
        </Notice>
      )}
    </>
  )
}

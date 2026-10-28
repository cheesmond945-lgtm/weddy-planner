import { Link } from 'react-router'
import { Notice } from '@/features/vendors/components/FormParts'
import { paths } from '@/routes/paths'
import type { VendorProfile } from '@/types/vendor'

/** Thông báo đầu trang Quản lý gói dịch vụ khi hồ sơ nhà cung cấp chưa được duyệt (chưa thêm được gói). Hồ sơ đã duyệt thì không có. */
export function PackageStatusSummary({ profile }: { profile: VendorProfile }) {
  if (profile.status === 'VERIFIED') return null
  return (
    <Notice tone="warn" title="Hồ sơ nhà cung cấp chưa được duyệt nên chưa thêm được gói dịch vụ. Các gói đã có vẫn xem và sửa được.">
      <Link to={paths.vendor.profile} className="font-medium underline-offset-2 hover:underline">
        Đến Hồ sơ nhà cung cấp →
      </Link>
    </Notice>
  )
}

import { Link } from 'react-router'
import { Notice } from '@/features/vendors/components/FormParts'
import { ProfileStatusBadge } from '@/features/vendors/components/ProfileStatus'
import { paths } from '@/routes/paths'
import type { VendorProfile } from '@/types/vendor'
import { packageCategoryOf } from '../constants'

/**
 * Lĩnh vực và trạng thái hồ sơ ở đầu trang Quản lý dịch vụ.
 * notice = true: thông báo khi hồ sơ chưa xác minh (vẫn tạo được bản nháp) hoặc chưa chọn lĩnh vực.
 */
export function PackageStatusSummary({ profile, notice }: { profile: VendorProfile; notice?: boolean }) {
  const category = packageCategoryOf(profile)
  const toProfile = (
    <Link to={paths.vendor.profile} className="font-medium underline-offset-2 hover:underline">
      Đến Hồ sơ nhà cung cấp →
    </Link>
  )

  if (!notice) {
    return (
      <span className="inline-flex flex-wrap items-center gap-2">
        Lĩnh vực: <b className="text-ink">{category?.name ?? 'chưa chọn'}</b>
        <ProfileStatusBadge status={profile.status} />
      </span>
    )
  }
  if (!category) {
    return (
      <Notice tone="warn" title="Chưa chọn lĩnh vực cung cấp. Chọn lĩnh vực trong hồ sơ trước khi tạo gói dịch vụ.">
        {toProfile}
      </Notice>
    )
  }
  if (profile.status === 'VERIFIED') return null
  return (
    <Notice
      tone="warn"
      title={`Hồ sơ của ${profile.businessName ?? 'bạn'} chưa được xác minh, bạn vẫn tạo được bản nháp. Gửi duyệt mở sau khi hồ sơ được xác minh.`}
    >
      {toProfile}
    </Notice>
  )
}

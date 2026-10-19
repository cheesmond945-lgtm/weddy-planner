import { Link } from 'react-router'
import { Notice } from '@/features/vendors/components/FormParts'
import { paths } from '@/routes/paths'
import type { VendorProfile } from '@/types/vendor'

/** Nhắc hồ sơ chưa gửi xác minh / cần bổ sung, kèm link sang Hồ sơ. Đã gửi hoặc đã xác minh thì không hiện. */
export function ProfileReminder({ profile }: { profile: VendorProfile }) {
  if (profile.status !== 'NOT_SUBMITTED' && profile.status !== 'NEEDS_REVISION') return null
  const link = (
    <Link to={paths.vendor.profile} className="font-medium underline-offset-2 hover:underline">
      Đến Hồ sơ nhà cung cấp →
    </Link>
  )
  return profile.status === 'NEEDS_REVISION' ? (
    <Notice tone="warn" title="WebPlan yêu cầu bổ sung hồ sơ nhà cung cấp.">
      {profile.reviewNote && <p>Lý do: {profile.reviewNote}</p>}
      {link}
    </Notice>
  ) : (
    <Notice tone="warn" title="Hồ sơ nhà cung cấp chưa gửi xác minh. Gửi xác minh để được đăng gói dịch vụ.">
      {link}
    </Notice>
  )
}

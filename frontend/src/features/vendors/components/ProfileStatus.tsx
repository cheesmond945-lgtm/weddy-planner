import { Check } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { formatDate, toISODate } from '@/lib/date'
import type { VendorProfile, VendorProfileStatus } from '@/types/vendor'
import { PROFILE_STATUS } from '../constants'
import { Notice } from './FormParts'

export function ProfileStatusBadge({ status }: { status: VendorProfileStatus }) {
  const { label, tone } = PROFILE_STATUS[status]
  return (
    <Badge tone={tone}>
      {status === 'VERIFIED' ? <Check className="size-3" /> : <i aria-hidden className="size-1.5 rounded-full bg-current opacity-75" />}
      {label}
    </Badge>
  )
}

/** Thông báo đầu trang theo trạng thái hồ sơ (như prototype NCC). Chưa gửi xác minh thì không có. */
export function ProfileStatusNotice({ profile }: { profile: VendorProfile }) {
  switch (profile.status) {
    case 'VERIFIED':
      return (
        <Notice title={`Đã xác minh lĩnh vực ${profile.verifiedCategory?.name ?? profile.category?.name ?? ''}. Bạn được gửi duyệt gói thuộc lĩnh vực này.`}>
          Thông tin đã xác minh chỉ đọc. Liên hệ Admin WebPlan khi cần thay đổi.
        </Notice>
      )
    case 'PENDING':
      return (
        <Notice
          tone="info"
          title={`Hồ sơ đã gửi${profile.submittedAt ? ` ngày ${formatDate(toISODate(new Date(profile.submittedAt)))}` : ''} và đang chờ Admin xét duyệt, nội dung chỉ đọc.`}
        />
      )
    case 'NEEDS_REVISION':
      return (
        <Notice tone="warn" title="Admin yêu cầu bổ sung hồ sơ">
          {profile.reviewNote && (
            <p>
              <b>Lý do:</b> {profile.reviewNote}
            </p>
          )}
          <p>Sửa các mục liên quan rồi gửi xác minh lại.</p>
        </Notice>
      )
    default:
      return null
  }
}

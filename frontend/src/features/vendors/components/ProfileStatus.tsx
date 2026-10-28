import { Check } from 'lucide-react'
import { Badge } from '@/components/Badge'
import { formatDate, toISODate } from '@/lib/date'
import type { VendorProfile, VendorProfileStatus } from '@/types/vendor'
import { PROFILE_STATUS } from '../constants'
import { Notice } from './FormParts'

export function ProfileStatusBadge({ status, large }: { status: VendorProfileStatus; large?: boolean }) {
  const { label, tone } = PROFILE_STATUS[status]
  return (
    <Badge tone={tone} className={large ? 'gap-2 border border-current/25 px-5 py-2 text-base font-bold shadow-portal' : undefined}>
      {status === 'VERIFIED' ? (
        <Check className={large ? 'size-5' : 'size-3'} strokeWidth={large ? 3 : 2} />
      ) : (
        <i aria-hidden className={large ? 'size-2.5 rounded-full bg-current' : 'size-1.5 rounded-full bg-current opacity-75'} />
      )}
      {label}
    </Badge>
  )
}

/** Thông báo đầu trang theo trạng thái hồ sơ. Bản nháp thì không có. */
export function ProfileStatusNotice({ profile }: { profile: VendorProfile }) {
  switch (profile.status) {
    case 'VERIFIED':
      if (profile.pendingReview) {
        return <Notice tone="info" title="Bản cập nhật đang chờ Admin kiểm tra. Hồ sơ và các gói vẫn hiển thị, nội dung chỉ đọc cho tới khi Admin xử lý." />
      }
      return profile.revisionRequested ? (
        <Notice tone="warn" title="Admin yêu cầu chỉnh sửa / bổ sung bản cập nhật hồ sơ">
          {profile.reviewNote && (
            <p>
              <b>Lý do:</b> {profile.reviewNote}
            </p>
          )}
          <p>Hồ sơ và các gói của bạn vẫn hiển thị trong lúc bạn chỉnh sửa. Sửa xong bấm “Gửi cập nhật” để Admin kiểm tra lại.</p>
        </Notice>
      ) : null
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
          <p>Sửa các mục liên quan rồi gửi lại xác minh.</p>
        </Notice>
      )
    default:
      return null
  }
}

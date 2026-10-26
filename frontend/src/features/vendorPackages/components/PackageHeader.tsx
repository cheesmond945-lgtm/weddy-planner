import { Link, useLocation } from 'react-router'
import { PageTitle } from '@/components/PageTitle'
import { Notice } from '@/features/vendors/components/FormParts'
import { paths } from '@/routes/paths'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { VendorPackage } from '@/types/vendorPackage'
import { canSubmitPackage, isEditablePackage } from '../constants'
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

const reason = (note: string | null) =>
  note && (
    <p>
      <b>Lý do:</b> {note}
    </p>
  )

/**
 * Thông báo đầu trang theo trạng thái gói (cùng cách với Hồ sơ NCC): chỉ khi gói đang chờ duyệt, bị yêu cầu chỉnh sửa,
 * có bản cập nhật, hoặc đang ẩn. Bản nháp và gói đã đăng không có bản cập nhật thì không có.
 */
function PackageStatusNotice({ pkg }: { pkg: VendorPackage }) {
  const update = pkg.pendingUpdate?.status
  switch (pkg.status) {
    case 'PENDING':
      return <Notice tone="info" title="Gói đang chờ Admin duyệt, nội dung chỉ đọc." />
    case 'NEEDS_REVISION':
      return (
        <Notice tone="warn" title="Admin yêu cầu chỉnh sửa / bổ sung gói dịch vụ">
          {reason(pkg.reviewNote)}
          <p>Sửa các mục liên quan rồi gửi lại duyệt.</p>
        </Notice>
      )
    case 'PUBLISHED':
      if (update === 'DRAFT') return <Notice tone="info" title="Bạn có bản cập nhật chưa gửi duyệt. Khách vẫn thấy phiên bản đang đăng." />
      if (update === 'PENDING') {
        return <Notice tone="info" title="Bản cập nhật đang chờ Admin duyệt. Khách vẫn thấy phiên bản đang đăng, nội dung chỉ đọc cho tới khi Admin xử lý." />
      }
      return update === 'NEEDS_REVISION' ? (
        <Notice tone="warn" title="Admin yêu cầu chỉnh sửa / bổ sung bản cập nhật gói dịch vụ">
          {reason(pkg.reviewNote)}
          <p>Gói vẫn hiển thị phiên bản đang đăng trong lúc bạn chỉnh sửa. Sửa xong bấm “Gửi lại duyệt” để Admin kiểm tra lại.</p>
        </Notice>
      ) : null
    case 'HIDDEN':
      return (
        <Notice tone="info" title="Gói đang ẩn. Khôi phục để khách nhìn thấy và cập nhật gói.">
          {update && <p>Bạn có bản cập nhật chưa hoàn tất, sửa tiếp được sau khi khôi phục.</p>}
        </Notice>
      )
    default:
      return null
  }
}

/** Tiêu đề trang chi tiết gói: nhãn trạng thái to ở góc phải (cùng kiểu trang Hồ sơ NCC), thông báo theo trạng thái. */
export function PackageHeader({ pkg, profile, category }: PackageHeaderProps) {
  return (
    <>
      <PageTitle title={pkg ? 'Chi tiết gói dịch vụ' : 'Thêm gói dịch vụ'} actions={pkg && <PackageStatusBadge pkg={pkg} large />} />

      {pkg && <PackageStatusNotice pkg={pkg} />}
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

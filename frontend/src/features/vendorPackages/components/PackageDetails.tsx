import { EyeOff, PencilLine, RotateCcw } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import { Notice } from '@/features/vendors/components/FormParts'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { VendorPackage } from '@/types/vendorPackage'
import { usePackageAction } from '../hooks'
import { PackageEditor } from './PackageEditor'
import { useListHref } from './PackageHeader'

interface PackageDetailsProps {
  pkg: VendorPackage
  profile: VendorProfile
  category: CategoryRef
  /** Bấm "Cập nhật" (gói đã đăng, chưa có bản cập nhật): chuyển sang form sửa */
  onEdit: () => void
  /** Tab "Công việc" (sửa được ở mọi trạng thái gói, kể cả khi form gói chỉ đọc) */
  editorExtras?: Pick<ComponentProps<typeof PackageEditor>, 'tasks' | 'tab' | 'onTabChange' | 'tasksPanel'>
}

/**
 * Gói chờ duyệt / đã đăng / đang ẩn: xem trên cùng form ở chế độ chỉ đọc.
 * - Chờ duyệt, hoặc bản cập nhật đang chờ duyệt: không có thao tác.
 * - Đã đăng: Cập nhật, Ẩn.
 * - Đang ẩn: chỉ Khôi phục (khôi phục rồi mới cập nhật được). Gói do Admin ẩn thì không có nút, hiện lý do.
 */
export function PackageDetails({ pkg, profile, category, onEdit, editorExtras }: PackageDetailsProps) {
  const action = usePackageAction()
  const listHref = useListHref()
  const [confirm, setConfirm] = useState<'hide' | 'republish' | null>(null)
  const published = pkg.status === 'PUBLISHED' && !pkg.pendingUpdate
  const hiddenByAdmin = pkg.status === 'HIDDEN' && pkg.hiddenBy === 'ADMIN'

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:[&>*]:flex-1">
      <Button asChild variant="outline" className="h-10 border-line-strong">
        <Link to={listHref}>Quay lại</Link>
      </Button>
      {published && (
        <>
          <Button variant="outline" className="h-10 border-line-strong" disabled={action.isPending} onClick={() => setConfirm('hide')}>
            <EyeOff />
            Ẩn dịch vụ
          </Button>
          <Button className="h-10" disabled={action.isPending} onClick={onEdit}>
            <PencilLine />
            Cập nhật
          </Button>
        </>
      )}
      {pkg.status === 'HIDDEN' && !hiddenByAdmin && (
        <Button className="h-10" disabled={action.isPending} onClick={() => setConfirm('republish')}>
          <RotateCcw />
          Khôi phục
        </Button>
      )}
      <ConfirmDialog open={confirm === 'hide'} onOpenChange={(o) => !o && setConfirm(null)} title="Ẩn dịch vụ?" confirmLabel="Ẩn dịch vụ" onConfirm={() => action.mutate({ action: 'hide', pkg })}>
        <p>Khách sẽ không còn thấy dịch vụ này. Dữ liệu và ảnh được giữ nguyên, bạn có thể khôi phục bất cứ lúc nào.</p>
      </ConfirmDialog>
      <ConfirmDialog open={confirm === 'republish'} onOpenChange={(o) => !o && setConfirm(null)} title="Khôi phục dịch vụ?" confirmLabel="Khôi phục" onConfirm={() => action.mutate({ action: 'republish', pkg })}>
        <p>Khách sẽ thấy lại dịch vụ “{pkg.name}” theo phiên bản đã được duyệt.</p>
      </ConfirmDialog>
    </div>
  )

  return (
    <>
      {hiddenByAdmin && (
        <Notice tone="warn" title="Gói đã bị Admin ẩn">
          <p>
            <b>Lý do:</b> {pkg.hiddenReason}
          </p>
          <p>Bạn chưa tự khôi phục được gói này. Vui lòng liên hệ Forever để được hỗ trợ.</p>
        </Notice>
      )}
      <PackageEditor key={pkg.updatedAt} pkg={pkg} profile={profile} category={category} readOnly actions={actions} {...editorExtras} />
    </>
  )
}

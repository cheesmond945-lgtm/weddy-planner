import { EyeOff, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/features/vendors/components/ConfirmDialog'
import type { CategoryRef } from '@/types/catalog'
import type { VendorProfile } from '@/types/vendor'
import type { VendorPackage } from '@/types/vendorPackage'
import { usePackageAction } from '../hooks'
import { PackageEditor } from './PackageEditor'
import { useListHref } from './PackageHeader'

/** Gói chờ duyệt / đã đăng / đang ẩn: xem trên cùng form ở chế độ chỉ đọc; đã đăng thì ẩn được, đang ẩn thì đăng lại được. */
export function PackageDetails({ pkg, profile, category }: { pkg: VendorPackage; profile: VendorProfile; category: CategoryRef }) {
  const action = usePackageAction()
  const listHref = useListHref()
  const [confirmHide, setConfirmHide] = useState(false)

  const actions = (
    <div className="flex flex-wrap items-center justify-end gap-2.5 max-sm:[&>*]:flex-1">
      <Button asChild variant="outline" className="h-10 border-line-strong">
        <Link to={listHref}>Quay lại</Link>
      </Button>
      {pkg.status === 'PUBLISHED' && (
        <Button className="h-10" disabled={action.isPending} onClick={() => setConfirmHide(true)}>
          <EyeOff />
          Ẩn dịch vụ
        </Button>
      )}
      {pkg.status === 'HIDDEN' && (
        <Button className="h-10" disabled={action.isPending} onClick={() => action.mutate({ action: 'republish', pkg })}>
          <RotateCcw />
          Đăng lại
        </Button>
      )}
      <ConfirmDialog open={confirmHide} onOpenChange={setConfirmHide} title="Ẩn dịch vụ?" confirmLabel="Ẩn dịch vụ" onConfirm={() => action.mutate({ action: 'hide', pkg })}>
        <p>Khách sẽ không còn thấy dịch vụ này. Dữ liệu và ảnh được giữ nguyên, bạn có thể đăng lại phiên bản đã duyệt bất cứ lúc nào.</p>
      </ConfirmDialog>
    </div>
  )

  return <PackageEditor key={pkg.updatedAt} pkg={pkg} profile={profile} category={category} readOnly actions={actions} />
}

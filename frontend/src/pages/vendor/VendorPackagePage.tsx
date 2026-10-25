import { Link, useParams } from 'react-router'
import { ApiError } from '@/api'
import { EmptyState } from '@/components/EmptyState'
import { Button } from '@/components/ui/button'
import { isEditablePackage, packageCategoryOf } from '@/features/vendorPackages/constants'
import { PackageDetails } from '@/features/vendorPackages/components/PackageDetails'
import { PackageEditor } from '@/features/vendorPackages/components/PackageEditor'
import { PackageHeader } from '@/features/vendorPackages/components/PackageHeader'
import { usePackage } from '@/features/vendorPackages/hooks'
import { useVendorProfile } from '@/features/vendors/hooks'
import { paths } from '@/routes/paths'

/** Thêm gói (/vendor/catalog/new) hoặc xem/sửa một gói (/vendor/catalog/:packageId). */
export default function VendorPackagePage() {
  const { packageId } = useParams()
  const profile = useVendorProfile()
  const pkg = usePackage(packageId)

  const back = (
    <Button asChild variant="outline" size="sm">
      <Link to={paths.vendor.catalog}>Về Quản lý gói dịch vụ</Link>
    </Button>
  )

  if (profile.isPending || (packageId && pkg.isPending)) {
    return <div aria-busy="true" aria-label="Đang tải gói dịch vụ" className="mx-auto h-[560px] max-w-[980px] animate-pulse rounded-md bg-muted" />
  }
  if (pkg.isError) {
    return pkg.error instanceof ApiError && pkg.error.status === 404 ? (
      <EmptyState title="Không tìm thấy dịch vụ" description={`Dịch vụ ${packageId} không tồn tại hoặc thuộc tài khoản khác.`} action={back} />
    ) : (
      <EmptyState title="Chưa tải được gói dịch vụ" description={pkg.error.message} action={<Button onClick={() => pkg.refetch()}>Thử lại</Button>} />
    )
  }
  if (profile.isError) {
    return <EmptyState title="Chưa tải được hồ sơ nhà cung cấp" description={profile.error.message} action={<Button onClick={() => profile.refetch()}>Thử lại</Button>} />
  }

  // Gói mới: chỉ NCC có hồ sơ đã được duyệt mới thêm được
  if (!pkg.data && profile.data.status !== 'VERIFIED') {
    return (
      <EmptyState
        title="Chưa thêm được gói dịch vụ"
        description="Chỉ nhà cung cấp có hồ sơ đã được duyệt mới thêm được gói dịch vụ."
        action={
          <Button asChild>
            <Link to={paths.vendor.profile}>Đến Hồ sơ nhà cung cấp</Link>
          </Button>
        }
      />
    )
  }

  const category = pkg.data?.category ?? packageCategoryOf(profile.data)
  if (!category) {
    return (
      <EmptyState
        title="Chưa chọn lĩnh vực cung cấp"
        description="Chọn lĩnh vực trong Hồ sơ nhà cung cấp trước khi tạo gói dịch vụ."
        action={
          <Button asChild>
            <Link to={paths.vendor.profile}>Đến Hồ sơ nhà cung cấp</Link>
          </Button>
        }
      />
    )
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <PackageHeader pkg={pkg.data} profile={profile.data} category={category} />
      {pkg.data && !isEditablePackage(pkg.data.status) ? (
        <PackageDetails pkg={pkg.data} profile={profile.data} category={category} />
      ) : (
        <PackageEditor key={pkg.data?.updatedAt ?? 'new'} pkg={pkg.data} profile={profile.data} category={category} />
      )}
    </div>
  )
}

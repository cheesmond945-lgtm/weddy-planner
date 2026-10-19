import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { PackageStatusSummary } from '@/features/vendorPackages/components/PackageStatusSummary'
import { PackageToolbar, StatusTabs } from '@/features/vendorPackages/components/PackageFilters'
import { PackageTable } from '@/features/vendorPackages/components/PackageTable'
import { allTagsOf, matchPackages, sortPackages, usePackageFilters } from '@/features/vendorPackages/filters'
import { usePackages } from '@/features/vendorPackages/hooks'
import { useVendorProfile } from '@/features/vendors/hooks'
import { paths } from '@/routes/paths'

/** Quản lý dịch vụ: danh sách gói theo trạng thái, tìm, lọc tag, sắp xếp, thao tác nhanh. */
export default function VendorCatalogPage() {
  const { data: profile } = useVendorProfile()
  const { data: packages, isPending, isError, error, refetch } = usePackages()
  const { filters, update, reset } = usePackageFilters()

  const all = packages ?? []
  const matched = matchPackages(all, filters)
  const shown = sortPackages(matched, filters)
  const hasFilter = !!filters.q || filters.tags.length > 0

  const addButton = (
    <Button asChild>
      <Link to={paths.vendor.packageNew}>
        <Plus />
        Thêm gói dịch vụ
      </Link>
    </Button>
  )

  return (
    <>
      <PageTitle title="Quản lý dịch vụ" description={profile && <PackageStatusSummary profile={profile} />} actions={addButton} />
      {profile && <PackageStatusSummary profile={profile} notice />}

      <StatusTabs value={filters.status} onChange={(status) => update({ status })} matched={matched} />
      <PackageToolbar filters={filters} allTags={allTagsOf(all)} onChange={update} onReset={reset} />

      <section className="min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-portal">
        {isPending ? (
          <div aria-busy="true" aria-label="Đang tải gói dịch vụ" className="h-[320px] animate-pulse bg-muted" />
        ) : isError ? (
          <EmptyState className="border-0" title="Chưa tải được gói dịch vụ" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
        ) : shown.length ? (
          <PackageTable packages={shown} profile={profile} />
        ) : !all.length ? (
          <EmptyState
            className="border-0"
            title="Chưa có gói dịch vụ"
            description="Tạo gói để giới thiệu dịch vụ tới khách."
            action={
              <Button asChild variant="outline" size="sm">
                <Link to={paths.vendor.packageNew}>
                  <Plus />
                  Tạo gói đầu tiên
                </Link>
              </Button>
            }
          />
        ) : (
          <EmptyState
            className="border-0"
            title="Không có gói phù hợp"
            description={hasFilter ? 'Thử bỏ bớt điều kiện lọc.' : 'Không có gói ở trạng thái này.'}
            action={
              hasFilter && (
                <Button variant="outline" size="sm" onClick={reset}>
                  Đặt lại bộ lọc
                </Button>
              )
            }
          />
        )}
      </section>
    </>
  )
}

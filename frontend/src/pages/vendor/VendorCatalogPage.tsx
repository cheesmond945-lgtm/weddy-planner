import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { TableCard, TableSkeleton } from '@/features/adminShared/components/AdminTable'
import { Pagination } from '@/features/adminShared/components/Pagination'
import { isVenue, packageCategoryOf } from '@/features/vendorPackages/constants'
import { PackageStatusSummary } from '@/features/vendorPackages/components/PackageStatusSummary'
import { PackageStatusChips, PackageToolbar } from '@/features/vendorPackages/components/PackageFilters'
import { PackageTable } from '@/features/vendorPackages/components/PackageTable'
import { allTagsOf, matchPackages, sortPackages, usePackageFilters } from '@/features/vendorPackages/filters'
import { usePackages } from '@/features/vendorPackages/hooks'
import { useVendorProfile } from '@/features/vendors/hooks'
import { paths } from '@/routes/paths'

const PAGE_SIZE = 10

/** Quản lý gói dịch vụ: tìm kiếm, bộ lọc, nhãn trạng thái, bảng gói có phân trang (10 gói một trang). */
export default function VendorCatalogPage() {
  const { data: profile } = useVendorProfile()
  const { data: packages, isPending, isError, error, refetch } = usePackages()
  const { filters, update, reset } = usePackageFilters()

  const all = packages ?? []
  const matched = matchPackages(all, filters)
  const shown = sortPackages(matched, filters)
  const hasFilter = !!filters.q || filters.tags.length > 0
  // Chỉ NCC có hồ sơ đã được duyệt mới thêm được gói
  const canAdd = profile?.status === 'VERIFIED'
  const showCapacity = isVenue(profile && packageCategoryOf(profile))
  const page = Math.min(filters.page, Math.max(1, Math.ceil(shown.length / PAGE_SIZE)))
  const rows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <>
      <PageTitle
        title="Quản lý gói dịch vụ"
        actions={
          canAdd ? (
            <Button asChild>
              <Link to={paths.vendor.packageNew}>
                <Plus />
                Thêm gói dịch vụ
              </Link>
            </Button>
          ) : (
            profile && (
              <Button disabled title="Hồ sơ nhà cung cấp chưa được duyệt">
                <Plus />
                Thêm gói dịch vụ
              </Button>
            )
          )
        }
      />
      {profile && <PackageStatusSummary profile={profile} />}

      <TableCard>
        <PackageToolbar filters={filters} allTags={allTagsOf(all)} onChange={update} onReset={reset} />
        <PackageStatusChips value={filters.status} onChange={(status) => update({ status })} matched={matched} />

        {isPending ? (
          <TableSkeleton label="Đang tải gói dịch vụ" />
        ) : isError ? (
          <div className="p-5">
            <EmptyState title="Chưa tải được gói dịch vụ" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
          </div>
        ) : rows.length ? (
          <>
            <PackageTable packages={rows} startIndex={(page - 1) * PAGE_SIZE} showCapacity={showCapacity} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={shown.length} noun="gói dịch vụ" onPage={(p) => update({ page: p })} />
          </>
        ) : (
          <div className="p-5">
            <EmptyState
              title={!all.length ? 'Chưa có gói dịch vụ' : 'Không có gói phù hợp'}
              description={!all.length ? 'Các gói dịch vụ của bạn sẽ hiện ở đây.' : hasFilter ? 'Thử bỏ bớt điều kiện lọc.' : 'Không có gói ở trạng thái này.'}
              action={
                hasFilter && (
                  <Button variant="outline" size="sm" onClick={reset}>
                    Đặt lại bộ lọc
                  </Button>
                )
              }
            />
          </div>
        )}
      </TableCard>
    </>
  )
}

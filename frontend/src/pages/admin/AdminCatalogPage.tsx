import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { PackageTable } from '@/features/adminCatalog/components/PackageTable'
import { ADMIN_PACKAGE_STATUS } from '@/features/adminCatalog/constants'
import { useAdminPackages } from '@/features/adminCatalog/hooks'
import { TableCard, TableSkeleton } from '@/features/adminShared/components/AdminTable'
import { ClearFilters, FilterBar, FilterSelect, SearchBox } from '@/features/adminShared/components/Filters'
import { Pagination } from '@/features/adminShared/components/Pagination'
import { StatusChips, type ChipItem } from '@/features/adminShared/components/StatusChips'
import { useDebounced } from '@/features/adminShared/hooks'
import { useCategories } from '@/features/catalog/hooks'
import type { AdminPackageStatus } from '@/types/admin'

type Tab = 'ALL' | AdminPackageStatus

const PAGE_SIZE = 10

/** Lọc theo thời gian nộp: nộp trong N ngày gần đây (cùng bộ lọc với trang Quản lý hồ sơ). */
const DAY_OPTIONS = [
  { value: 1, label: 'Nộp trong 1 ngày qua' },
  { value: 3, label: 'Nộp trong 3 ngày qua' },
  { value: 7, label: 'Nộp trong 1 tuần qua' },
  { value: 30, label: 'Nộp trong 1 tháng qua' },
  { value: 90, label: 'Nộp trong 3 tháng qua' },
]

/** Quản lý gói dịch vụ: danh sách, lọc theo trạng thái, lĩnh vực, thời gian nộp. Bấm một gói để mở trang chi tiết và xử lý. */
export default function AdminCatalogPage() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tt') ?? 'ALL') as Tab
  const categorySlug = params.get('linhvuc') ?? ''
  const days = DAY_OPTIONS.find((d) => String(d.value) === params.get('nop'))?.value ?? 0
  const page = Math.max(1, Number(params.get('trang')) || 1)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounced(search.trim())

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('trang' in patch)) next.delete('trang')
    setParams(next, { replace: true })
  }

  const { data: categories = [] } = useCategories()
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminPackages({
    q: q || undefined,
    categorySlug: categorySlug || undefined,
    status: tab === 'ALL' ? undefined : tab,
    days: days || undefined,
    page,
    pageSize: PAGE_SIZE,
  })

  const counts = data?.counts
  const chips: ChipItem<Tab>[] = [
    { value: 'ALL', label: 'Tất cả', count: counts?.ALL ?? 0, tone: 'neutral' },
    { value: 'PENDING', label: ADMIN_PACKAGE_STATUS.PENDING.label, count: counts?.PENDING ?? 0, tone: 'info' },
    { value: 'NEEDS_REVISION', label: ADMIN_PACKAGE_STATUS.NEEDS_REVISION.label, count: counts?.NEEDS_REVISION ?? 0, tone: 'warn' },
    { value: 'PUBLISHED', label: ADMIN_PACKAGE_STATUS.PUBLISHED.label, count: counts?.PUBLISHED ?? 0, tone: 'done' },
    { value: 'HIDDEN', label: ADMIN_PACKAGE_STATUS.HIDDEN.label, count: counts?.HIDDEN ?? 0, tone: 'neutral' },
  ]
  const filtering = !!(search || categorySlug || days)
  const clear = () => {
    setSearch('')
    set({ q: null, linhvuc: null, nop: null })
  }

  return (
    <>
      <PageTitle title="Quản lý gói dịch vụ" />

      <TableCard>
        <FilterBar>
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm theo tên gói hoặc nhà cung cấp..." />
          <FilterSelect label="Lọc theo lĩnh vực" value={categorySlug} onChange={(v) => set({ linhvuc: v })}>
            <option value="">Tất cả lĩnh vực</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Lọc theo thời gian nộp" value={days ? String(days) : ''} onChange={(v) => set({ nop: v })} className="min-w-[190px]">
            <option value="">Mọi thời gian nộp</option>
            {DAY_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </FilterSelect>
          <ClearFilters show={filtering} onClick={clear} />
        </FilterBar>
        <StatusChips items={chips} value={tab} onChange={(v) => set({ tt: v === 'ALL' ? null : v })} label="Lọc theo trạng thái gói" />

        {isPending ? (
          <TableSkeleton label="Đang tải gói dịch vụ" />
        ) : isError ? (
          <div className="p-5">
            <EmptyState title="Chưa tải được gói dịch vụ" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
          </div>
        ) : !data.items.length ? (
          <div className="p-5">
            <EmptyState title={tab === 'PENDING' && !filtering ? 'Không có gói nào đang chờ duyệt' : 'Không có gói phù hợp'} description={filtering ? 'Thử đổi tiêu chí tìm kiếm hoặc xóa bộ lọc.' : undefined} />
          </div>
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <PackageTable packages={data.items} startIndex={(page - 1) * PAGE_SIZE} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} noun="gói dịch vụ" onPage={(p) => set({ trang: p > 1 ? String(p) : null })} />
          </div>
        )}
      </TableCard>
    </>
  )
}

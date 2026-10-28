import { CheckCircle2, Download, Hourglass, Percent } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { adminApi } from '@/api/admin'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { toast } from '@/components/ui/toast'
import { TableCard, TableSkeleton } from '@/features/adminShared/components/AdminTable'
import { ClearFilters, FilterBar, FilterSelect, SearchBox } from '@/features/adminShared/components/Filters'
import { Pagination } from '@/features/adminShared/components/Pagination'
import { formatPeriod } from '@/features/adminShared/format'
import { useDebounced } from '@/features/adminShared/hooks'
import { PaymentTable } from '@/features/adminPayments/components/PaymentTable'
import { useAdminStatements } from '@/features/adminPayments/hooks'
import { StatCard } from '@/features/commissions/components/StatCard'
import { formatMoney } from '@/lib/format'
import type { AdminStatementQuery, AdminStatementStatus } from '@/types/admin'

const PAGE_SIZE = 10

/** Ô trong tệp CSV: bọc nháy kép, nhân đôi nháy kép bên trong. */
const csv = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`

/** Quản lý thanh toán: bảng kê hoa hồng nhà cung cấp trả WebPlan theo kỳ tháng, ghi nhận đã thanh toán. */
export default function AdminPaymentsPage() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('tt') ?? '') as AdminStatementStatus | ''
  const year = params.get('nam') ?? ''
  const month = params.get('thang') ?? ''
  const page = Math.max(1, Number(params.get('trang')) || 1)
  const [search, setSearch] = useState(params.get('q') ?? '')
  const q = useDebounced(search.trim())
  const [exporting, setExporting] = useState(false)

  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (!('trang' in patch)) next.delete('trang')
    setParams(next, { replace: true })
  }

  const query: AdminStatementQuery = { q: q || undefined, status: status || undefined, year: Number(year) || undefined, month: Number(month) || undefined }
  const { data, isPending, isError, error, refetch, isPlaceholderData } = useAdminStatements({ ...query, page, pageSize: PAGE_SIZE })
  const filtering = !!(search || status || year || month)
  const clear = () => {
    setSearch('')
    setParams(new URLSearchParams(), { replace: true })
  }

  /** Xuất toàn bộ bảng kê đang lọc (mọi trang) ra tệp CSV mở được bằng Excel. */
  async function exportData() {
    setExporting(true)
    try {
      const all = await adminApi.listStatements({ ...query, page: 1, pageSize: 5000 })
      const head = ['Mã bảng kê', 'Nhà cung cấp', 'Lĩnh vực', 'Kỳ', 'Số đơn hàng', 'Doanh thu', 'Hoa hồng', 'Hạn thanh toán', 'Trạng thái', 'Ngày thanh toán', 'Mã giao dịch']
      const rows = all.items.map((s) => [
        s.code,
        s.vendor.name,
        s.category.name,
        formatPeriod(s.period),
        s.orderCount,
        s.revenue,
        s.commissionAmount,
        s.dueDate,
        s.status === 'PAID' ? 'Đã thanh toán' : 'Chưa thanh toán',
        s.paidAt ?? '',
        s.transactionCode ?? '',
      ])
      const text = '﻿' + [head, ...rows].map((r) => r.map(csv).join(',')).join('\r\n')
      const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `bang-ke-hoa-hong${year ? `-${year}` : ''}${month ? `-T${month}` : ''}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast(`Đã xuất ${rows.length} bảng kê.`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Không xuất được dữ liệu.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageTitle
        title="Quản lý thanh toán"
        actions={
          <Button variant="outline" className="rounded-pill border-line-strong" onClick={exportData} disabled={exporting || isPending}>
            <Download />
            Xuất dữ liệu
          </Button>
        }
      />

      <div className="mb-[18px] grid grid-cols-3 gap-4 max-sm:grid-cols-1 max-sm:gap-2.5">
        <StatCard icon={Percent} label="Tổng hoa hồng" value={formatMoney(data?.stats.total ?? 0)} foot={filtering ? 'Theo bộ lọc hiện tại' : 'Tất cả các kỳ'} />
        <StatCard icon={CheckCircle2} label="Đã thanh toán" value={formatMoney(data?.stats.paid ?? 0)} tone="text-sage" />
        <StatCard icon={Hourglass} label="Chưa thanh toán" value={formatMoney(data?.stats.unpaid ?? 0)} tone={data?.stats.unpaid ? 'text-warn' : ''} />
      </div>

      <TableCard>
        <FilterBar>
          <SearchBox value={search} onChange={setSearch} placeholder="Tìm kiếm mã bảng kê, tên nhà cung cấp..." />
          <FilterSelect label="Lọc theo trạng thái" value={status} onChange={(v) => set({ tt: v })}>
            <option value="">Tất cả trạng thái</option>
            <option value="UNPAID">Chưa thanh toán</option>
            <option value="PAID">Đã thanh toán</option>
          </FilterSelect>
          <FilterSelect label="Lọc theo năm" value={year} onChange={(v) => set({ nam: v })}>
            <option value="">Tất cả các năm</option>
            {(data?.years ?? []).map((y) => (
              <option key={y} value={y}>
                Năm {y}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Lọc theo tháng" value={month} onChange={(v) => set({ thang: v })}>
            <option value="">Tất cả các tháng</option>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                Tháng {m}
              </option>
            ))}
          </FilterSelect>
          <ClearFilters show={filtering} onClick={clear} />
        </FilterBar>

        {isPending ? (
          <TableSkeleton label="Đang tải bảng kê" />
        ) : isError ? (
          <div className="p-5">
            <EmptyState title="Chưa tải được bảng kê" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
          </div>
        ) : !data.items.length ? (
          <div className="p-5">
            <EmptyState
              title="Không có bảng kê nào phù hợp"
              description="Thử đổi tiêu chí tìm kiếm hoặc xóa bộ lọc để xem lại danh sách."
            />
          </div>
        ) : (
          <div className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
            <PaymentTable statements={data.items} startIndex={(page - 1) * PAGE_SIZE} />
            <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} noun="bảng kê" onPage={(p) => set({ trang: p > 1 ? String(p) : null })} />
          </div>
        )}
      </TableCard>

    </>
  )
}

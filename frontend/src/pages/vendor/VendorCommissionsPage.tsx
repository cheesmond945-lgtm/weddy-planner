import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { CommissionOverview, PeriodSelect } from '@/features/commissions/components/CommissionOverview'
import { StatementDetailDialog } from '@/features/commissions/components/StatementDetailDialog'
import { StatementTable } from '@/features/commissions/components/StatementTable'
import { useCommissionStatements } from '@/features/commissions/hooks'

/** Tài chính & đối soát: hoa hồng phải trả WebPlan theo kỳ tháng, bảng kê, minh chứng thanh toán. */
export default function VendorCommissionsPage() {
  const { data: statements, isPending, isError, error, refetch } = useCommissionStatements()
  // ?ky=<mã bảng kê> chọn kỳ xem số liệu, ?ds=<mã> mở chi tiết; mặc định kỳ mới nhất
  const [params, setParams] = useSearchParams()
  const set = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }
  const selected = statements?.find((s) => s.id === params.get('ky')) ?? statements?.[0]
  const openId = params.get('ds')

  return (
    <>
      <PageTitle
        title="Tài chính & đối soát"
        description="Hoa hồng phải thanh toán cho WebPlan theo kỳ tháng."
        actions={statements?.length ? <PeriodSelect statements={statements} value={selected?.id ?? ''} onChange={(id) => set({ ky: id })} /> : undefined}
      />
      {isPending ? (
        <div aria-busy="true" aria-label="Đang tải đối soát" className="h-[420px] animate-pulse rounded-md bg-muted" />
      ) : isError ? (
        <EmptyState title="Chưa tải được bảng kê" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
      ) : !selected ? (
        <EmptyState title="Chưa có bảng kê" description="Chọn lĩnh vực trong Hồ sơ nhà cung cấp để bắt đầu tính hoa hồng." />
      ) : (
        <>
          <CommissionOverview statement={selected} />
          <section className="min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-portal">
            <div className="px-5 py-[18px]">
              <h2 className="font-sans text-[15px] font-semibold tracking-normal">Danh sách đối soát</h2>
            </div>
            <StatementTable statements={statements} onOpen={(id) => set({ ds: id })} />
          </section>
        </>
      )}
      {openId && <StatementDetailDialog key={openId} id={openId} onClose={() => set({ ds: null })} />}
    </>
  )
}

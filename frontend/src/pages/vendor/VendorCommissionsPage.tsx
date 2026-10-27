import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { PeriodHero } from '@/features/commissions/components/PeriodHero'
import { PeriodOrders } from '@/features/commissions/components/PeriodOrders'
import { PeriodSelect } from '@/features/commissions/components/PeriodSelect'
import { StatementTable } from '@/features/commissions/components/StatementTable'
import { useCommissionStatement, useCommissionStatements } from '@/features/commissions/hooks'

/**
 * Tài chính & đối soát: kỳ đang xem (hoa hồng cần thanh toán, hạn, nút thanh toán VNPay), các đơn hoàn thành của kỳ,
 * và lịch sử các kỳ.
 */
export default function VendorCommissionsPage() {
  const { data: all, isPending, isError, error, refetch } = useCommissionStatements()
  // ?nam=<năm> lọc các kỳ theo năm (mặc định năm của kỳ mới nhất); ?ky=<mã bảng kê> chọn kỳ xem,
  // mặc định kỳ đầu tiên cần thanh toán trong năm, không có thì kỳ mới nhất của năm
  const [params, setParams] = useSearchParams()
  const years = [...new Set((all ?? []).map((s) => s.period.slice(0, 4)))]
  const year = years.includes(params.get('nam') ?? '') ? params.get('nam')! : years[0]
  const statements = (all ?? []).filter((s) => s.period.startsWith(year ?? ''))
  const selected =
    statements?.find((s) => s.id === params.get('ky')) ?? statements?.find((s) => s.status === 'UNPAID' && s.commissionAmount > 0) ?? statements?.[0]
  const detail = useCommissionStatement(selected?.id ?? null)

  function update(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  function select(id: string) {
    update({ ky: id })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      <PageTitle
        title="Tài chính & đối soát"
        actions={
          statements?.length ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                aria-label="Năm"
                value={year}
                // Đổi năm thì bỏ kỳ đang chọn, trang tự chọn kỳ mặc định của năm đó
                onChange={(e) => update({ nam: e.target.value, ky: null })}
                className="h-10 w-[120px] rounded-sm border border-line-strong bg-surface px-3 text-[13.5px] focus:border-gold focus:outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    Năm {y}
                  </option>
                ))}
              </select>
              <PeriodSelect statements={statements} value={selected?.id ?? ''} onChange={select} />
            </div>
          ) : undefined
        }
      />
      {isPending ? (
        <div className="grid gap-5">
          <div aria-busy="true" aria-label="Đang tải đối soát" className="h-[300px] animate-pulse rounded-lg bg-muted" />
          <div className="h-[220px] animate-pulse rounded-md bg-muted" />
        </div>
      ) : isError ? (
        <EmptyState title="Chưa tải được bảng kê" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
      ) : !selected ? (
        <EmptyState title="Chưa có bảng kê" description="Chọn lĩnh vực trong Hồ sơ nhà cung cấp để bắt đầu tính hoa hồng." />
      ) : (
        <>
          <PeriodHero summary={selected} detail={detail.data} />
          <PeriodOrders summary={selected} detail={detail.data} loading={detail.isPending} />
          <section className="min-w-0 overflow-hidden rounded-md border border-line bg-surface shadow-portal">
            <header className="px-5 py-[18px]">
              <h2 className="font-sans text-[15px] font-semibold tracking-normal">Lịch sử đối soát</h2>
              <p className="mt-0.5 text-[12.5px] text-muted-foreground">Bấm vào một kỳ để xem đơn và thanh toán kỳ đó.</p>
            </header>
            <StatementTable statements={statements} selectedId={selected.id} onSelect={select} />
          </section>
        </>
      )}
    </>
  )
}

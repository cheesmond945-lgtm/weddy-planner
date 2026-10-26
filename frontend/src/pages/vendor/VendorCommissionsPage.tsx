import { Percent, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EmptyState } from '@/components/EmptyState'
import { PageTitle } from '@/components/PageTitle'
import { Button } from '@/components/ui/button'
import { commissionTiles, withCurrentPeriod } from '@/features/commissions/calc'
import { CommissionTiles } from '@/features/commissions/components/CommissionTiles'
import { PayStatementDialog } from '@/features/commissions/components/PayStatementDialog'
import { StatementDetailDialog } from '@/features/commissions/components/StatementDetailDialog'
import { StatementTable } from '@/features/commissions/components/StatementTable'
import { useCommissions, usePayStatement } from '@/features/commissions/hooks'
import { useClock } from '@/lib/clock'
import { TimeTravelMenu } from '@/features/vendorOrders/components/TimeTravelMenu'
import type { CommissionStatement } from '@/types/commission'

/**
 * Tài chính & đối soát: hoa hồng phải nộp WebPlan theo từng tháng (CommissionStatements). Kỳ của tháng hiện tại đang tạm tính;
 * kỳ đã qua và chưa nộp thì nộp một lần qua VNPay. ?ds=<id> mở chi tiết một kỳ.
 */
export default function VendorCommissionsPage() {
  const { data, isPending, isError, error, refetch } = useCommissions()
  const pay = usePayStatement()
  const [params, setParams] = useSearchParams()
  const [paying, setPaying] = useState<CommissionStatement | null>(null)

  // Trạng thái Quá hạn và kỳ hiện tại phụ thuộc ngày hôm nay: dựng lại khi tua giờ giả lập
  const clock = useClock()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const statements = useMemo(() => (data ? withCurrentPeriod(data.statements) : []), [data, clock])
  const tiles = commissionTiles(statements)
  const open = statements.find((s) => s.id === params.get('ds'))
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params)
    if (id) next.set('ds', id)
    else next.delete('ds')
    setParams(next, { replace: true })
  }

  return (
    <>
      <PageTitle
        title="Tài chính & đối soát"
        description={
          <>
            Hoa hồng phải nộp WebPlan theo từng tháng, tính trên các đơn đã hoàn tất.
            {data?.rate && (
              <span className="mt-1.5 flex items-center gap-1.5 text-[13px]">
                <Percent className="size-3.5" aria-hidden />
                Tỷ lệ hoa hồng của bạn: <b className="font-semibold text-ink">{data.rate.percent}%</b> ({data.rate.categoryName})
              </span>
            )}
          </>
        }
        actions={<TimeTravelMenu />}
      />

      {isPending ? (
        <div aria-busy="true" aria-label="Đang tải đối soát" className="h-[420px] animate-pulse rounded-md bg-muted" />
      ) : isError ? (
        <EmptyState title="Chưa tải được bảng kê" description={error.message} action={<Button onClick={() => refetch()}>Thử lại</Button>} />
      ) : (
        <>
          <CommissionTiles tiles={tiles} />
          <section className="min-w-0 overflow-hidden rounded-[22px] border border-line bg-surface shadow-panel">
            {data.statements.length ? (
              <StatementTable statements={statements} busy={pay.isPending} onOpen={setOpen} onPay={setPaying} />
            ) : (
              <div className="grid place-items-center px-6 py-14 text-center">
                <span className="mb-3 grid size-14 place-items-center rounded-full bg-gold-soft text-gold-ink">
                  <Wallet className="size-6" />
                </span>
                <h3 className="mb-1.5 text-xl">Chưa có bảng kê hoa hồng</h3>
                <p className="max-w-[48ch] text-muted-foreground">Bảng kê của tháng được tạo khi bạn bấm Hoàn tất đơn đầu tiên trong tháng. Mỗi tháng nộp một lần, trước ngày 25 tháng sau.</p>
              </div>
            )}
          </section>
        </>
      )}

      {open && <StatementDetailDialog key={open.id} statement={open} onClose={() => setOpen(null)} onPay={setPaying} />}
      <PayStatementDialog statement={paying} onClose={() => setPaying(null)} onConfirm={(s) => pay.mutate(s, { onSuccess: () => setPaying(null) })} />
    </>
  )
}
